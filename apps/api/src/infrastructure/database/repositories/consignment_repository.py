"""Implementação Postgres do repositório de consignação."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.catalog.value_objects import Page, Pagination
from src.domain.consignment.entities import ConsignmentDraft, ConsignmentRequest
from src.domain.consignment.enums import ConsignmentStatus
from src.domain.consignment.value_objects import ConsignmentFilters
from src.infrastructure.database.models import ConsignmentRequest as ConsignmentModel


def _to_entity(model: ConsignmentModel) -> ConsignmentRequest:
    return ConsignmentRequest(
        id=model.id,
        owner_name=model.owner_name,
        phone=model.phone,
        vehicle=model.vehicle,
        year=model.year,
        mileage=model.mileage,
        asking_price=model.asking_price,
        city=model.city,
        notes=model.notes,
        status=model.status,
        created_at=model.created_at,
    )


class SqlAlchemyConsignmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, draft: ConsignmentDraft) -> ConsignmentRequest:
        model = ConsignmentModel(
            owner_name=draft.owner_name,
            phone=draft.phone,
            vehicle=draft.vehicle,
            year=draft.year,
            mileage=draft.mileage,
            asking_price=draft.asking_price,
            city=draft.city,
            notes=draft.notes,
            status=ConsignmentStatus.NEW,
            ip_address=draft.ip_address,
        )
        self._session.add(model)
        await self._session.flush()
        return _to_entity(model)

    async def search(
        self, filters: ConsignmentFilters, pagination: Pagination
    ) -> Page[ConsignmentRequest]:
        conditions: list[ColumnElement[bool]] = []

        if filters.query:
            # Uma busca sobre DOIS campos: quem procura no painel digita "Toro"
            # ou "Marcos" sem parar para pensar em qual coluna aquilo é.
            like = f"%{filters.query.strip()}%"
            conditions.append(
                or_(
                    ConsignmentModel.owner_name.ilike(like),
                    ConsignmentModel.vehicle.ilike(like),
                )
            )

        if filters.statuses:
            conditions.append(ConsignmentModel.status.in_(filters.statuses))

        total = await self._session.scalar(
            select(func.count()).select_from(ConsignmentModel).where(*conditions)
        )

        rows = await self._session.scalars(
            select(ConsignmentModel)
            .where(*conditions)
            # Mais recentes primeiro — o oposto do agendamento, e por um motivo:
            # lá o vendedor precisa da visita mais PRÓXIMA; aqui, do pedido que
            # acabou de chegar, porque quem quer vender o carro está falando com
            # outras lojas ao mesmo tempo. O id no fim é o desempate estável,
            # sem o qual a paginação repete e pula registros.
            .order_by(ConsignmentModel.created_at.desc(), ConsignmentModel.id.asc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )

        return Page(
            items=[_to_entity(r) for r in rows],
            total=total or 0,
            page=pagination.page,
            page_size=pagination.page_size,
        )

    async def update_status(
        self, request_id: UUID, status: ConsignmentStatus
    ) -> ConsignmentRequest | None:
        row = await self._session.scalar(
            update(ConsignmentModel)
            .where(ConsignmentModel.id == request_id)
            .values(status=status)
            .returning(ConsignmentModel)
        )
        return _to_entity(row) if row else None

    async def count_open(self) -> int:
        abertos = [s for s in ConsignmentStatus if s.is_open]
        total = await self._session.scalar(
            select(func.count())
            .select_from(ConsignmentModel)
            .where(ConsignmentModel.status.in_(abertos))
        )
        return total or 0
