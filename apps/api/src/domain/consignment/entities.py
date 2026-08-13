"""Entidades de consignação — quem quer anunciar o carro pela loja."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from src.domain.consignment.enums import ConsignmentStatus


@dataclass(frozen=True, slots=True)
class ConsignmentDraft:
    """Pedido recém-enviado pelo site, ainda não gravado.

    O CARRO VEM COMO TEXTO LIVRE, e isso é decisão de produto, não preguiça.
    O catálogo tem marcas e modelos cadastrados, mas exigir que o dono do carro
    encontre o dele numa lista de centenas de opções, no celular, é a diferença
    entre receber o contato e não receber. Quem vende um carro sabe descrever o
    que tem; quem compra é que precisa de filtro.

    A loja normaliza depois, na hora de cadastrar o anúncio de verdade.
    """

    owner_name: str
    phone: str
    vehicle: str
    year: int
    mileage: int
    asking_price: Decimal
    city: str | None = None
    notes: str | None = None
    ip_address: str | None = None


@dataclass(frozen=True, slots=True)
class ConsignmentRequest:
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
