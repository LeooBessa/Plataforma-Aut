"""Entidades de agendamento."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from uuid import UUID

from src.domain.scheduling.enums import AppointmentStatus


@dataclass(frozen=True, slots=True)
class AppointmentDraft:
    """Pedido de visita, ainda não persistido."""

    vehicle_id: UUID
    customer_name: str
    phone: str
    email: str
    scheduled_date: date
    scheduled_time: time
    whatsapp: str | None = None
    notes: str | None = None
    ip_address: str | None = None


@dataclass(frozen=True, slots=True)
class VehicleRef:
    """O mínimo do veículo que um agendamento precisa exibir.

    O painel lista agendamentos, não veículos: mostrar "Toyota Corolla" ao lado
    do cliente basta. Carregar a ficha completa de cada carro para montar uma
    tabela de leads seria desperdício.
    """

    id: UUID
    slug: str
    title: str
    cover_image_url: str | None


@dataclass(frozen=True, slots=True)
class Appointment:
    id: UUID
    vehicle: VehicleRef
    customer_name: str
    phone: str
    whatsapp: str | None
    email: str
    scheduled_date: date
    scheduled_time: time
    notes: str | None
    status: AppointmentStatus
    created_at: datetime


@dataclass(frozen=True, slots=True)
class DashboardStats:
    """Números do painel."""

    total_vehicles: int
    active_vehicles: int
    sold_vehicles: int
    draft_vehicles: int
    featured_vehicles: int
    total_appointments: int
    pending_appointments: int
    appointments_this_week: int
    total_views: int
    inventory_value: float
