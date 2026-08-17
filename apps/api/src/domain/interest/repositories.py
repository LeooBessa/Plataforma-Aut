"""Porta de persistência do interesse."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from src.domain.catalog.value_objects import Page, Pagination
from src.domain.interest.entities import InterestDraft, VehicleInterest
from src.domain.interest.enums import InterestStatus
from src.domain.interest.value_objects import InterestFilters


class InterestRepository(Protocol):
    async def create(self, draft: InterestDraft) -> VehicleInterest: ...

    async def search(
        self, filters: InterestFilters, pagination: Pagination
    ) -> Page[VehicleInterest]: ...

    async def update_status(
        self, interest_id: UUID, status: InterestStatus
    ) -> VehicleInterest | None: ...

    async def brand_exists(self, brand_id: UUID) -> bool: ...

    async def model_belongs_to_brand(self, model_id: UUID, brand_id: UUID) -> bool: ...
