"""Entidades de interesse — quem quer ser avisado quando o carro certo chegar."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from src.domain.catalog.enums import BodyType
from src.domain.interest.enums import InterestStatus


@dataclass(frozen=True, slots=True)
class InterestDraft:
    """Pedido recém-enviado pelo site, ainda não gravado.

    AQUI A MARCA É REFERÊNCIA DE CATÁLOGO, ao contrário da consignação — e a
    inversão é proposital. Quem VENDE sabe descrever o carro que tem e digita
    livre; quem COMPRA precisa que a escolha dele case com o que a loja
    cadastra, senão o cruzamento com o estoque não acontece. "Fiat Toro" digitado
    à mão nunca encontraria o veículo cujo `brand_id` aponta para Fiat.

    Modelo e categoria são OPCIONAIS de propósito: "qualquer Fiat até 40 mil" é
    um pedido legítimo, e provavelmente o mais comum.
    """

    name: str
    phone: str
    brand_id: UUID
    max_price: Decimal
    model_id: UUID | None = None
    body_type: BodyType | None = None
    email: str | None = None
    notes: str | None = None
    ip_address: str | None = None


@dataclass(frozen=True, slots=True)
class MatchingVehicle:
    """Um carro do estoque que atende a um interesse.

    Vai junto na listagem do painel para que o vendedor monte a oferta sem
    precisar abrir outra tela e cruzar na cabeça.
    """

    slug: str
    title: str
    price: Decimal


@dataclass(frozen=True, slots=True)
class VehicleInterest:
    id: UUID
    name: str
    phone: str
    email: str | None
    brand_id: UUID
    brand_name: str
    model_id: UUID | None
    model_name: str | None
    body_type: BodyType | None
    max_price: Decimal
    notes: str | None
    status: InterestStatus
    created_at: datetime
    #: Carros à venda que batem com este pedido, no momento da consulta.
    matches: list[MatchingVehicle]
