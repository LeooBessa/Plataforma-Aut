"""Portas de persistência de agendamento."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from src.domain.catalog.value_objects import Page, Pagination
from src.domain.scheduling.entities import (
    Appointment,
    AppointmentDraft,
    DashboardStats,
)
from src.domain.scheduling.enums import AppointmentStatus
from src.domain.scheduling.value_objects import AppointmentFilters


class AppointmentRepository(Protocol):
    async def create(self, draft: AppointmentDraft) -> Appointment:
        """A concessionária é derivada do veículo, não recebida de fora.

        O veículo já sabe a qual concessionária pertence. Fazer o caso de uso
        carregar esse dado só para repassá-lo abriria espaço para um agendamento
        ser gravado na concessionária errada — o tipo de bug que só aparece
        quando a plataforma virar multi-concessionária, e aí já é tarde.
        """
        ...

    async def search(
        self, filters: AppointmentFilters, pagination: Pagination
    ) -> Page[Appointment]: ...

    async def get_by_id(self, appointment_id: UUID) -> Appointment | None: ...

    async def update_status(
        self, appointment_id: UUID, status: AppointmentStatus
    ) -> Appointment | None: ...


class StatsRepository(Protocol):
    """Números do dashboard.

    Interface separada de propósito: as estatísticas cruzam veículos E
    agendamentos, então não pertencem a nenhum dos dois repositórios. Enfiá-las
    no de agendamentos faria ele consultar tabelas que não são dele — e essa é a
    primeira rachadura por onde as camadas começam a vazar uma na outra.
    """

    async def get_dashboard_stats(self) -> DashboardStats: ...
