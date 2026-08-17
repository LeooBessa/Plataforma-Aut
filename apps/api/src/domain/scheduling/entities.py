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
class TopVehicle:
    """Um carro na lista dos mais vistos."""

    slug: str
    title: str
    price: float
    views: int
    appointments: int


@dataclass(frozen=True, slots=True)
class WeekLeads:
    """Contatos recebidos numa semana — a série do gráfico."""

    week_start: date
    appointments: int
    consignments: int


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

    # ------------------------------------------------------------------ novos
    # Os três abaixo existem porque o painel antigo só sabia contar. Contagem
    # informa; estes apontam o que fazer hoje.

    #: Pedidos de "anuncie seu carro" ainda em aberto. Faltava no painel: era um
    #: canal inteiro de entrada que só aparecia se alguém abrisse a página dele.
    pending_consignments: int

    #: À venda e sem foto nenhuma. Anúncio sem foto praticamente não é clicado —
    #: é o carro que está no site sem estar de verdade.
    vehicles_without_photo: int

    #: À venda há mais de 60 dias. É o número que dói numa revenda: capital
    #: parado, e quanto mais tempo passa, menos o carro vale.
    stale_vehicles: int

    #: Gente na lista de espera que JÁ TEM carro compatível no pátio. É a
    #: pendência mais fácil de resolver do painel: o carro está lá, a pessoa
    #: pediu para ser avisada, e falta só alguém mandar a mensagem.
    interests_with_match: int

    #: Os mais vistos, para saber o que atrai — e o que atrai mas não converte.
    top_viewed: list[TopVehicle]

    #: Últimas 8 semanas de contatos recebidos.
    leads_by_week: list[WeekLeads]
