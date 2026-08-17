"""Schemas do interesse — "me avise quando chegar"."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from src.domain.catalog.enums import BodyType
from src.domain.catalog.value_objects import Page
from src.domain.interest.entities import InterestDraft, VehicleInterest
from src.domain.interest.enums import InterestStatus
from src.presentation.v1.schemas.common import clean_phone


class InterestCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=20)
    email: EmailStr | None = None

    brand_id: UUID
    model_id: UUID | None = None
    body_type: BodyType | None = None

    # `gt=0` aqui é só a barreira grosseira; o piso real (R$ 1.000) mora no caso
    # de uso, porque vale para qualquer entrada, não só para a que vem por HTTP.
    max_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)

    notes: str | None = Field(default=None, max_length=1000)

    #: Campo-armadilha. Escondido por CSS; humano nenhum preenche.
    website: str | None = None

    _normaliza_telefone = field_validator("phone")(clean_phone)

    def to_domain(self, ip: str | None) -> InterestDraft:
        return InterestDraft(
            name=self.name.strip(),
            phone=self.phone,
            email=str(self.email) if self.email else None,
            brand_id=self.brand_id,
            model_id=self.model_id,
            body_type=self.body_type,
            max_price=self.max_price,
            notes=self.notes.strip() if self.notes else None,
            ip_address=ip,
        )


class InterestCreatedOut(BaseModel):
    """Resposta enxuta de propósito.

    A rota é pública: devolver os dados enviados a transformaria num verificador
    de dados alheios — bastaria enviar um id para descobrir o telefone de quem
    se cadastrou.
    """

    id: UUID
    message: str = "Pedido recebido! Avisamos assim que aparecer algo com esse perfil."


class MatchingVehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    price: Decimal


class InterestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str
    email: str | None
    brand_name: str
    model_name: str | None
    body_type: BodyType | None
    max_price: Decimal
    notes: str | None
    status: InterestStatus
    created_at: datetime
    matches: list[MatchingVehicleOut]


class InterestStatusIn(BaseModel):
    status: InterestStatus


class InterestPageOut(BaseModel):
    items: list[InterestOut]
    meta: dict[str, int]

    @classmethod
    def from_page(cls, page: Page[VehicleInterest]) -> InterestPageOut:
        return cls(
            items=[InterestOut.model_validate(i) for i in page.items],
            meta={"total": page.total, "page": page.page, "page_size": page.page_size},
        )
