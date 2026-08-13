"""Porta de persistência da consignação."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from src.domain.catalog.value_objects import Page, Pagination
from src.domain.consignment.entities import ConsignmentDraft, ConsignmentRequest
from src.domain.consignment.enums import ConsignmentStatus
from src.domain.consignment.value_objects import ConsignmentFilters


class ConsignmentRepository(Protocol):
    async def create(self, draft: ConsignmentDraft) -> ConsignmentRequest: ...

    async def search(
        self, filters: ConsignmentFilters, pagination: Pagination
    ) -> Page[ConsignmentRequest]: ...

    async def update_status(
        self, request_id: UUID, status: ConsignmentStatus
    ) -> ConsignmentRequest | None: ...

    async def count_open(self) -> int:
        """Pedidos ainda esperando resposta.

        Existe para o painel poder mostrar um contador: pedido de consignação
        parado é estoque que a loja deixou de ter.
        """
        ...
