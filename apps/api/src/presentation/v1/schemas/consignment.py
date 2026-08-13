from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.domain.catalog.value_objects import Page
from src.domain.consignment.entities import ConsignmentDraft, ConsignmentRequest
from src.domain.consignment.enums import ConsignmentStatus
from src.presentation.v1.schemas.common import clean_phone


class ConsignmentCreateIn(BaseModel):
    """O que o site envia quando alguém quer anunciar o carro.

    CURTO DE PROPÓSITO. Cada campo a mais derruba o número de envios, e este
    formulário existe para começar uma conversa, não para cadastrar o anúncio.
    Versão, câmbio, cor e fotos vêm depois, no WhatsApp, onde a loja pergunta o
    que precisa saber sobre aquele carro específico.
    """

    owner_name: str = Field(min_length=2, max_length=120)
    phone: str
    #: Marca, modelo e versão em texto livre — ver `ConsignmentDraft`.
    vehicle: str = Field(min_length=2, max_length=160)
    year: int = Field(ge=1950, le=2100)
    mileage: int = Field(ge=0, le=2_000_000)
    asking_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)

    city: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=1000)

    # Campo-armadilha para robôs, igual ao do agendamento: escondido por CSS, um
    # humano nunca o vê. Robô de spam preenche tudo que encontra no HTML.
    website: str | None = Field(default=None, max_length=200)

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, value: str) -> str:
        return clean_phone(value)

    def to_domain(self, ip_address: str | None) -> ConsignmentDraft:
        return ConsignmentDraft(
            owner_name=self.owner_name.strip(),
            phone=self.phone,
            vehicle=self.vehicle.strip(),
            year=self.year,
            mileage=self.mileage,
            asking_price=self.asking_price,
            city=self.city.strip() if self.city else None,
            notes=self.notes,
            ip_address=ip_address,
        )


class ConsignmentCreatedOut(BaseModel):
    """Resposta a quem enviou.

    Devolve o mínimo. Ecoar de volta telefone e dados do carro transformaria o
    endpoint — que é público e sem autenticação — num verificador de dados
    alheios.
    """

    id: UUID
    message: str = "Recebemos seu carro! Vamos te chamar no WhatsApp."


class ConsignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_name: str
    phone: str
    vehicle: str
    year: int
    mileage: int
    asking_price: Decimal
    city: str | None
    notes: str | None
    status: ConsignmentStatus
    created_at: datetime


class ConsignmentStatusIn(BaseModel):
    status: ConsignmentStatus


class PageMeta(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class ConsignmentPageOut(BaseModel):
    items: list[ConsignmentOut]
    meta: PageMeta

    @classmethod
    def from_page(cls, page: Page[ConsignmentRequest]) -> ConsignmentPageOut:
        return cls(
            items=[ConsignmentOut.model_validate(c) for c in page.items],
            meta=PageMeta(
                total=page.total,
                page=page.page,
                page_size=page.page_size,
                total_pages=page.total_pages,
                has_next=page.has_next,
                has_previous=page.has_previous,
            ),
        )
