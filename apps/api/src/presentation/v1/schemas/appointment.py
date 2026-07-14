from __future__ import annotations

import re
from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from src.domain.catalog.value_objects import Page
from src.domain.scheduling.entities import Appointment
from src.domain.scheduling.enums import AppointmentStatus

# Telefone brasileiro: 10 dígitos (fixo) ou 11 (celular, com o 9).
_PHONE_DIGITS = re.compile(r"^\d{10,11}$")


def _clean_phone(value: str) -> str:
    """Guarda só os dígitos.

    O usuário digita "(11) 99999-8888"; um vendedor busca por "11999998888".
    Gravar a máscara faria as duas coisas não se encontrarem, e ainda impediria
    montar um link de WhatsApp — que exige só números.
    """
    digits = re.sub(r"\D", "", value)

    if not _PHONE_DIGITS.match(digits):
        raise ValueError("Telefone inválido. Use DDD + número, ex: (11) 99999-8888.")

    return digits


class AppointmentCreateIn(BaseModel):
    vehicle_slug: str = Field(max_length=200)
    customer_name: str = Field(min_length=2, max_length=120)
    phone: str
    whatsapp: str | None = None
    email: EmailStr
    scheduled_date: date
    scheduled_time: time
    notes: str | None = Field(default=None, max_length=1000)

    # Campo-armadilha para robôs.
    #
    # Fica escondido no formulário por CSS, então um humano nunca o vê nem o
    # preenche. Robôs de spam preenchem TODOS os campos que encontram no HTML —
    # e se preencherem este, sabemos que não é gente.
    #
    # Não substitui o rate limit; complementa. Custa zero para o usuário legítimo
    # (sem CAPTCHA, sem fricção) e derruba a maior parte do spam automatizado.
    website: str | None = Field(default=None, max_length=200)

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, value: str) -> str:
        return _clean_phone(value)

    @field_validator("whatsapp")
    @classmethod
    def _validate_whatsapp(cls, value: str | None) -> str | None:
        return _clean_phone(value) if value else None


class VehicleRefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    title: str
    cover_image_url: str | None


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vehicle: VehicleRefOut
    customer_name: str
    phone: str
    whatsapp: str | None
    email: str
    scheduled_date: date
    scheduled_time: time
    notes: str | None
    status: AppointmentStatus
    created_at: datetime


class AppointmentCreatedOut(BaseModel):
    """Resposta ao visitante.

    Devolve o mínimo. Ecoar de volta o e-mail e o telefone do cliente
    transformaria o endpoint num verificador de dados alheios — e ele é público,
    sem autenticação.
    """

    id: UUID
    scheduled_date: date
    scheduled_time: time
    message: str = "Visita agendada! Entraremos em contato para confirmar."


class AppointmentStatusIn(BaseModel):
    status: AppointmentStatus


class PageMeta(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class AppointmentPageOut(BaseModel):
    items: list[AppointmentOut]
    meta: PageMeta

    @classmethod
    def from_page(cls, page: Page[Appointment]) -> AppointmentPageOut:
        return cls(
            items=[AppointmentOut.model_validate(a) for a in page.items],
            meta=PageMeta(
                total=page.total,
                page=page.page,
                page_size=page.page_size,
                total_pages=page.total_pages,
                has_next=page.has_next,
                has_previous=page.has_previous,
            ),
        )


class DashboardStatsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
