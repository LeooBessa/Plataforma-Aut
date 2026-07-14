"""Modelos de escrita do catálogo.

Separados dos de leitura (`entities.py`) de propósito. O que o admin ENVIA para
criar um anúncio não é o que o site DEVOLVE ao visitante: o envio traz
`brand_id`, `model_id` e uma lista de ids de opcionais; a devolução traz nomes,
imagens e a parcela calculada.

Fundir os dois num objeto só produziria um monstro cheio de campos opcionais que
ora existem, ora não — e ninguém consegue mais dizer quais são obrigatórios.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

from src.domain.catalog.enums import BodyType, FuelType, TransmissionType, VehicleStatus


@dataclass(frozen=True, slots=True)
class VehicleWrite:
    """Dados de um anúncio, vindos do painel."""

    brand_id: UUID
    model_id: UUID

    year_manufacture: int
    year_model: int
    price: Decimal
    mileage: int

    fuel_type: FuelType
    transmission: TransmissionType
    body_type: BodyType

    color: str
    city: str
    state: str

    version: str | None = None
    doors: int | None = None
    engine: str | None = None
    horsepower: int | None = None

    owners_count: int | None = None
    has_manual: bool = False
    has_spare_key: bool = False
    ipva_paid: bool = False
    licensing_paid: bool = False
    service_history: str | None = None

    description: str | None = None

    accepts_financing: bool = True
    accepts_trade: bool = True
    down_payment: Decimal | None = None
    installments_count: int | None = None

    is_featured: bool = False
    status: VehicleStatus = VehicleStatus.DRAFT

    feature_ids: list[UUID] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class ImageWrite:
    """Registro de uma foto JÁ enviada ao Storage pelo browser."""

    storage_path: str
    url: str
    alt_text: str | None = None
    width: int | None = None
    height: int | None = None
