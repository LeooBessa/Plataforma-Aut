"""Implementação Postgres do repositório de interesse."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.value_objects import Page, Pagination
from src.domain.interest.entities import InterestDraft, MatchingVehicle, VehicleInterest
from src.domain.interest.enums import InterestStatus
from src.domain.interest.value_objects import InterestFilters
from src.infrastructure.database.models import Brand, Vehicle, VehicleModel
from src.infrastructure.database.models import VehicleInterest as InterestModel

#: Quantos carros compatíveis o painel mostra por pedido. Três bastam para o
#: vendedor escolher o que oferecer; a lista inteira só encheria a tela.
_MAX_SUGESTOES = 3


def _casa_com() -> ColumnElement[bool]:
    """A REGRA DO CRUZAMENTO, num lugar só.

    Campo vazio no pedido não restringe — é assim que "qualquer Fiat até 40 mil"
    funciona. Cada condição só entra quando a pessoa escolheu aquilo:

      • marca      sempre (é o único campo obrigatório do pedido)
      • modelo     só se escolhido
      • categoria  só se escolhida
      • preço      teto do orçamento, sempre

    Expressa SEMPRE em colunas, nunca a partir de valores Python de um pedido
    já carregado. Assim a mesma expressão serve aos dois usos — filtrar "só quem
    tem carro esperando" e buscar os compatíveis de UM pedido (que vira esta
    junção mais um `where` pelo id). Se as duas divergissem, o painel mostraria
    "2 compatíveis" numa linha que o próprio filtro esconde.
    """
    return and_(
        Vehicle.status == VehicleStatus.ACTIVE,
        Vehicle.brand_id == InterestModel.brand_id,
        or_(InterestModel.model_id.is_(None), Vehicle.model_id == InterestModel.model_id),
        or_(InterestModel.body_type.is_(None), Vehicle.body_type == InterestModel.body_type),
        Vehicle.price <= InterestModel.max_price,
    )


class SqlAlchemyInterestRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, draft: InterestDraft) -> VehicleInterest:
        modelo = InterestModel(
            name=draft.name,
            phone=draft.phone,
            email=draft.email,
            brand_id=draft.brand_id,
            model_id=draft.model_id,
            body_type=draft.body_type,
            max_price=draft.max_price,
            notes=draft.notes,
            ip_address=draft.ip_address,
        )
        self._session.add(modelo)
        await self._session.flush()
        await self._session.refresh(modelo)
        return await self._para_entidade(modelo)

    async def search(
        self, filters: InterestFilters, pagination: Pagination
    ) -> Page[VehicleInterest]:
        condicoes: list[ColumnElement[bool]] = []

        if filters.statuses:
            condicoes.append(InterestModel.status.in_(filters.statuses))

        if filters.query:
            termo = f"%{filters.query.strip()}%"
            # Uma busca sobre pessoa, marca e modelo: o vendedor digita "Ana" ou
            # "Onix" sem parar para pensar em qual coluna aquilo é.
            condicoes.append(
                or_(
                    InterestModel.name.ilike(termo),
                    Brand.name.ilike(termo),
                    VehicleModel.name.ilike(termo),
                )
            )

        if filters.only_with_matches:
            condicoes.append(select(Vehicle.id).where(_casa_com()).exists())

        base = (
            select(InterestModel)
            .join(Brand, Brand.id == InterestModel.brand_id)
            .outerjoin(VehicleModel, VehicleModel.id == InterestModel.model_id)
        )
        if condicoes:
            base = base.where(*condicoes)

        total = await self._session.scalar(
            select(func.count()).select_from(base.subquery())
        )

        linhas = await self._session.scalars(
            base.order_by(InterestModel.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )

        itens = [await self._para_entidade(m) for m in linhas.unique()]
        return Page(
            items=itens,
            total=total or 0,
            page=pagination.page,
            page_size=pagination.page_size,
        )

    async def update_status(
        self, interest_id: UUID, status: InterestStatus
    ) -> VehicleInterest | None:
        modelo = await self._session.get(InterestModel, interest_id)
        if modelo is None:
            return None
        modelo.status = status
        await self._session.flush()
        return await self._para_entidade(modelo)

    async def brand_exists(self, brand_id: UUID) -> bool:
        return await self._session.scalar(
            select(func.count()).select_from(Brand).where(Brand.id == brand_id)
        ) == 1

    async def model_belongs_to_brand(self, model_id: UUID, brand_id: UUID) -> bool:
        return await self._session.scalar(
            select(func.count())
            .select_from(VehicleModel)
            .where(VehicleModel.id == model_id, VehicleModel.brand_id == brand_id)
        ) == 1

    # ------------------------------------------------------------------ mapa

    async def _para_entidade(self, modelo: InterestModel) -> VehicleInterest:
        """Converte o model em entidade, JÁ COM os carros compatíveis.

        A consulta dos compatíveis roda por pedido. É N+1 por definição, e aqui
        é aceitável: a página traz 20 linhas, o índice `ix_interest_brand_price`
        cobre o filtro, e cada consulta devolve no máximo três. Trocar isso por
        um `LATERAL` único economizaria milissegundos e custaria a legibilidade
        de toda esta classe — se a lista de espera chegar a milhares, aí sim.
        """
        marca = await self._session.get(Brand, modelo.brand_id)
        submodelo = (
            await self._session.get(VehicleModel, modelo.model_id) if modelo.model_id else None
        )

        # A regra do cruzamento vira a CONDIÇÃO DA JUNÇÃO, e o `where` recorta o
        # pedido em questão. É o que permite ter uma expressão só: montar a
        # condição a partir dos valores já carregados exigiria uma segunda
        # versão da regra, e duas versões acabam divergindo.
        compativeis = (
            await self._session.execute(
                select(
                    Vehicle.slug,
                    Vehicle.brand_name,
                    Vehicle.model_name,
                    Vehicle.version,
                    Vehicle.price,
                )
                .join(InterestModel, _casa_com())
                .where(InterestModel.id == modelo.id)
                .order_by(Vehicle.price.asc())
                .limit(_MAX_SUGESTOES)
            )
        ).all()

        return VehicleInterest(
            id=modelo.id,
            name=modelo.name,
            phone=modelo.phone,
            email=modelo.email,
            brand_id=modelo.brand_id,
            brand_name=marca.name if marca else "",
            model_id=modelo.model_id,
            model_name=submodelo.name if submodelo else None,
            body_type=modelo.body_type,
            max_price=modelo.max_price,
            notes=modelo.notes,
            status=modelo.status,
            created_at=modelo.created_at,
            matches=[
                MatchingVehicle(
                    slug=c.slug,
                    title=" ".join(p for p in (c.brand_name, c.model_name, c.version) if p),
                    price=c.price,
                )
                for c in compativeis
            ],
        )
