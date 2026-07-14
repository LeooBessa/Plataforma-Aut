"""Portas de persistência do catálogo.

Estas são *interfaces*, declaradas no domínio e implementadas na infraestrutura.
É a inversão de dependência do SOLID em forma concreta: o domínio dita o
contrato, o Postgres obedece — e não o contrário.

Consequências práticas:
- Os casos de uso são testáveis com um repositório falso, sem subir banco.
- Trocar Postgres por outra coisa não toca em nenhuma regra de negócio.
- O domínio não importa SQLAlchemy. Se importasse, essa camada seria decoração.
"""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from src.domain.catalog.entities import FilterOptions, VehicleDetail, VehicleSummary
from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.value_objects import Page, Pagination, VehicleFilters


class VehicleRepository(Protocol):
    async def search(
        self,
        filters: VehicleFilters,
        pagination: Pagination,
        *,
        statuses: list[VehicleStatus],
    ) -> Page[VehicleSummary]:
        """Busca paginada.

        `statuses` é explícito e obrigatório: é o que impede um rascunho ou um
        anúncio arquivado de vazar para o site público. Deixá-lo opcional, com
        um default permissivo, seria confiar que ninguém vai esquecer de passá-lo
        — e alguém vai.
        """
        ...

    async def get_by_slug(
        self, slug: str, *, statuses: list[VehicleStatus]
    ) -> VehicleDetail | None: ...

    async def list_featured(
        self, limit: int, *, statuses: list[VehicleStatus]
    ) -> list[VehicleSummary]: ...

    async def get_filter_options(self, *, statuses: list[VehicleStatus]) -> FilterOptions: ...

    async def increment_views(self, vehicle_id: UUID) -> None: ...
