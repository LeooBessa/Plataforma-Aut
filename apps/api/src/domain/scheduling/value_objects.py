"""Regras e filtros de agendamento."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from uuid import UUID

from src.domain.scheduling.enums import AppointmentStatus

# Horário de funcionamento da loja. Um agendamento às 3 da manhã não é um lead:
# é robô, ou é engano — e nos dois casos vira uma visita que ninguém vai atender.
BUSINESS_HOURS_START = time(8, 0)
BUSINESS_HOURS_END = time(18, 30)

# Janela de agendamento. Passado é erro; um ano à frente é lixo no painel.
MAX_DAYS_AHEAD = 60


@dataclass(frozen=True, slots=True)
class AppointmentFilters:
    customer: str | None = None
    vehicle_id: UUID | None = None
    date_from: date | None = None
    date_to: date | None = None
    statuses: list[AppointmentStatus] | None = None
