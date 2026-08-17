"""Implementação Postgres dos repositórios de agendamento e estatísticas."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import ColumnElement, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, InstrumentedAttribute, selectinload

from src.core.exceptions import NotFoundError
from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.value_objects import Page, Pagination
from src.domain.consignment.enums import ConsignmentStatus
from src.domain.interest.enums import InterestStatus
from src.domain.scheduling.entities import (
    Appointment,
    AppointmentDraft,
    DashboardStats,
    TopVehicle,
    VehicleRef,
    WeekLeads,
)
from src.domain.scheduling.enums import AppointmentStatus
from src.domain.scheduling.value_objects import AppointmentFilters
from src.infrastructure.database.models import Appointment as AppointmentModel
from src.infrastructure.database.models import ConsignmentRequest as ConsignmentModel
from src.infrastructure.database.models import Vehicle, VehicleImage
from src.infrastructure.database.models import VehicleInterest as InterestModel
from src.infrastructure.database.repositories.interest_repository import (
    _casa_com as _interesse_casa_com,
)

#: Dias à venda a partir dos quais o carro conta como encalhado. Sessenta é a
#: régua usual da revenda de usado: passou disso, o giro parou e o preço precisa
#: de conversa.
_DIAS_PARA_ENCALHE = 60


def _vehicle_title(vehicle: Vehicle) -> str:
    parts = [vehicle.brand_name, vehicle.model_name]
    if vehicle.version:
        parts.append(vehicle.version)
    return " ".join(parts)


def _cover_url(images: list[VehicleImage]) -> str | None:
    if not images:
        return None
    cover = next((i for i in images if i.is_cover), None)
    return (cover or min(images, key=lambda i: i.position)).url


def _to_appointment(model: AppointmentModel) -> Appointment:
    return Appointment(
        id=model.id,
        vehicle=VehicleRef(
            id=model.vehicle.id,
            slug=model.vehicle.slug,
            title=_vehicle_title(model.vehicle),
            cover_image_url=_cover_url(list(model.vehicle.images)),
        ),
        customer_name=model.customer_name,
        phone=model.phone,
        whatsapp=model.whatsapp,
        email=model.email,
        scheduled_date=model.scheduled_date,
        scheduled_time=model.scheduled_time,
        notes=model.notes,
        status=model.status,
        created_at=model.created_at,
    )


# Carrega o veículo e as imagens junto do agendamento. Sem isto, listar 20
# agendamentos dispararia 40 consultas extras (o clássico N+1) — e o painel
# ficaria lento justamente na tela mais usada pelo vendedor.
_WITH_VEHICLE = selectinload(AppointmentModel.vehicle).selectinload(Vehicle.images)


class SqlAlchemyAppointmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, draft: AppointmentDraft) -> Appointment:
        dealership_id = await self._session.scalar(
            select(Vehicle.dealership_id).where(Vehicle.id == draft.vehicle_id)
        )
        if dealership_id is None:
            raise NotFoundError("Veículo não encontrado.")

        model = AppointmentModel(
            vehicle_id=draft.vehicle_id,
            dealership_id=dealership_id,
            customer_name=draft.customer_name,
            phone=draft.phone,
            whatsapp=draft.whatsapp,
            email=draft.email,
            scheduled_date=draft.scheduled_date,
            scheduled_time=draft.scheduled_time,
            notes=draft.notes,
            status=AppointmentStatus.PENDING,
            ip_address=draft.ip_address,
        )
        self._session.add(model)
        await self._session.flush()

        created = await self._session.scalar(
            select(AppointmentModel).where(AppointmentModel.id == model.id).options(_WITH_VEHICLE)
        )
        assert created is not None
        return _to_appointment(created)

    async def search(
        self, filters: AppointmentFilters, pagination: Pagination
    ) -> Page[Appointment]:
        conditions: list[ColumnElement[bool]] = []

        if filters.customer:
            # Busca parcial e sem diferenciar maiúsculas: o vendedor digita
            # "silva" e quer achar "João da Silva".
            like = f"%{filters.customer.strip()}%"
            conditions.append(AppointmentModel.customer_name.ilike(like))

        if filters.vehicle_id:
            conditions.append(AppointmentModel.vehicle_id == filters.vehicle_id)

        if filters.date_from:
            conditions.append(AppointmentModel.scheduled_date >= filters.date_from)
        if filters.date_to:
            conditions.append(AppointmentModel.scheduled_date <= filters.date_to)

        if filters.statuses:
            conditions.append(AppointmentModel.status.in_(filters.statuses))

        total = await self._session.scalar(
            select(func.count()).select_from(AppointmentModel).where(*conditions)
        )

        rows = await self._session.scalars(
            select(AppointmentModel)
            .where(*conditions)
            .options(_WITH_VEHICLE)
            # Os mais próximos primeiro: é a visita que o vendedor precisa
            # atender hoje, não a de mês que vem. O id no fim é o desempate
            # estável — sem ele, a paginação repete e pula registros.
            .order_by(
                AppointmentModel.scheduled_date.asc(),
                AppointmentModel.scheduled_time.asc(),
                AppointmentModel.id.asc(),
            )
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )

        return Page(
            items=[_to_appointment(a) for a in rows.unique()],
            total=total or 0,
            page=pagination.page,
            page_size=pagination.page_size,
        )

    async def get_by_id(self, appointment_id: UUID) -> Appointment | None:
        model = await self._session.scalar(
            select(AppointmentModel)
            .where(AppointmentModel.id == appointment_id)
            .options(_WITH_VEHICLE)
        )
        return _to_appointment(model) if model else None

    async def update_status(
        self, appointment_id: UUID, status: AppointmentStatus
    ) -> Appointment | None:
        await self._session.execute(
            update(AppointmentModel)
            .where(AppointmentModel.id == appointment_id)
            .values(status=status)
        )
        return await self.get_by_id(appointment_id)


class SqlAlchemyStatsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_dashboard_stats(self) -> DashboardStats:
        """Todos os números em SEIS consultas, não em vinte.

        Cada contador vira um `count(*) FILTER (WHERE ...)` dentro da mesma
        varredura, em vez de uma consulta por métrica. O dashboard é a primeira
        tela que o admin abre — vinte viagens ao banco (com a latência de rede
        até o Supabase somando em cada uma) apareceriam como lentidão logo no
        login.

        As seis são: os contadores de veículo, os de agendamento, os de
        consignação, os da lista de espera com carro compatível, os mais vistos e
        a série semanal. As duas últimas devolvem LINHAS, não números, e por isso
        não cabem nas outras.
        """
        agora = datetime.now(UTC)
        week_ago = agora - timedelta(days=7)
        parado_desde = agora - timedelta(days=_DIAS_PARA_ENCALHE)
        a_venda = Vehicle.status.in_([VehicleStatus.ACTIVE, VehicleStatus.RESERVED])

        # "Sem foto" é um NOT EXISTS, não um LEFT JOIN com count: basta saber se
        # existe UMA imagem, e o Postgres para de procurar na primeira que achar.
        sem_foto = ~select(VehicleImage.id).where(VehicleImage.vehicle_id == Vehicle.id).exists()

        vehicle_row = (
            await self._session.execute(
                select(
                    func.count().label("total"),
                    func.count().filter(Vehicle.status == VehicleStatus.ACTIVE).label("active"),
                    func.count().filter(Vehicle.status == VehicleStatus.SOLD).label("sold"),
                    func.count().filter(Vehicle.status == VehicleStatus.DRAFT).label("draft"),
                    func.count().filter(Vehicle.is_featured.is_(True)).label("featured"),
                    func.coalesce(func.sum(Vehicle.views_count), 0).label("views"),
                    func.count().filter(a_venda, sem_foto).label("sem_foto"),
                    # `published_at` e não `created_at`: o relógio do encalhe
                    # começa quando o carro entra no site, não quando alguém
                    # começou a escrever o rascunho.
                    func.count()
                    .filter(a_venda, Vehicle.published_at < parado_desde)
                    .label("parados"),
                    # Valor do estoque = só o que está à venda. Somar os vendidos
                    # inflaria o número e ele deixaria de significar qualquer coisa.
                    func.coalesce(func.sum(Vehicle.price).filter(a_venda), 0).label(
                        "inventory_value"
                    ),
                ).select_from(Vehicle)
            )
        ).one()

        appointment_row = (
            await self._session.execute(
                select(
                    func.count().label("total"),
                    func.count()
                    .filter(AppointmentModel.status == AppointmentStatus.PENDING)
                    .label("pending"),
                    func.count().filter(AppointmentModel.created_at >= week_ago).label("this_week"),
                ).select_from(AppointmentModel)
            )
        ).one()

        pendentes_consignacao = (
            await self._session.scalar(
                select(func.count())
                .select_from(ConsignmentModel)
                .where(
                    ConsignmentModel.status.in_(
                        [ConsignmentStatus.NEW, ConsignmentStatus.CONTACTED]
                    )
                )
            )
        ) or 0

        # A regra do cruzamento vem do repositório de interesse, importada, e não
        # copiada: é a MESMA que o painel de lista de espera usa. Duas cópias
        # divergiriam, e aí o número aqui apontaria para uma tela que mostra
        # outra coisa.
        esperando_com_carro = (
            await self._session.scalar(
                select(func.count())
                .select_from(InterestModel)
                .where(
                    InterestModel.status.in_([InterestStatus.NEW, InterestStatus.NOTIFIED]),
                    select(Vehicle.id).where(_interesse_casa_com()).exists(),
                )
            )
        ) or 0

        top_viewed = await self._top_viewed()
        leads_by_week = await self._leads_by_week(agora)

        return DashboardStats(
            total_vehicles=vehicle_row.total,
            active_vehicles=vehicle_row.active,
            sold_vehicles=vehicle_row.sold,
            draft_vehicles=vehicle_row.draft,
            featured_vehicles=vehicle_row.featured,
            total_views=int(vehicle_row.views),
            inventory_value=float(vehicle_row.inventory_value),
            total_appointments=appointment_row.total,
            pending_appointments=appointment_row.pending,
            appointments_this_week=appointment_row.this_week,
            pending_consignments=pendentes_consignacao,
            interests_with_match=esperando_com_carro,
            vehicles_without_photo=vehicle_row.sem_foto,
            stale_vehicles=vehicle_row.parados,
            top_viewed=top_viewed,
            leads_by_week=leads_by_week,
        )

    async def _top_viewed(self) -> list[TopVehicle]:
        """Os cinco mais vistos, com quantas visitas cada um gerou.

        As duas colunas juntas é que dizem alguma coisa: muita visualização e
        nenhum agendamento é anúncio que atrai e decepciona — foto ruim, preço
        fora ou descrição que não responde o que a pessoa queria saber.
        """
        agendamentos = (
            select(func.count())
            .select_from(AppointmentModel)
            .where(AppointmentModel.vehicle_id == Vehicle.id)
            .scalar_subquery()
        )

        rows = (
            await self._session.execute(
                select(
                    Vehicle.slug,
                    Vehicle.brand_name,
                    Vehicle.model_name,
                    Vehicle.version,
                    Vehicle.price,
                    Vehicle.views_count,
                    agendamentos.label("agendamentos"),
                )
                .where(Vehicle.status.in_([VehicleStatus.ACTIVE, VehicleStatus.RESERVED]))
                .order_by(Vehicle.views_count.desc())
                .limit(5)
            )
        ).all()

        return [
            TopVehicle(
                slug=r.slug,
                title=" ".join(p for p in (r.brand_name, r.model_name, r.version) if p),
                price=float(r.price),
                views=r.views_count,
                appointments=r.agendamentos,
            )
            for r in rows
        ]

    async def _leads_by_week(self, agora: datetime) -> list[WeekLeads]:
        """Oito semanas de contatos, agendamento e consignação lado a lado.

        As semanas SEM contato precisam aparecer no gráfico, e o banco não
        devolve linha para o que não existe — um `GROUP BY` puro entregaria só
        as semanas movimentadas e o gráfico mostraria uma sequência falsa de
        barras cheias. Por isso as oito são criadas aqui e preenchidas depois.
        """
        # Segunda-feira da semana corrente, à meia-noite UTC.
        inicio_semana = (agora - timedelta(days=agora.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        primeira = inicio_semana - timedelta(weeks=7)

        async def por_semana(
            coluna: InstrumentedAttribute[datetime], modelo: type[DeclarativeBase]
        ) -> dict[date, int]:
            semana = func.date_trunc("week", coluna).label("semana")
            rows = (
                await self._session.execute(
                    select(semana, func.count())
                    .select_from(modelo)
                    .where(coluna >= primeira)
                    .group_by(semana)
                )
            ).all()
            return {r[0].date(): r[1] for r in rows}

        visitas = await por_semana(AppointmentModel.created_at, AppointmentModel)
        ofertas = await por_semana(ConsignmentModel.created_at, ConsignmentModel)

        return [
            WeekLeads(
                week_start=(dia := (primeira + timedelta(weeks=i)).date()),
                appointments=visitas.get(dia, 0),
                consignments=ofertas.get(dia, 0),
            )
            for i in range(8)
        ]
