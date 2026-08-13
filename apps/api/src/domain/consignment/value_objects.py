"""Filtros da listagem de consignação."""

from __future__ import annotations

from dataclasses import dataclass, field

from src.domain.consignment.enums import ConsignmentStatus


@dataclass(frozen=True, slots=True)
class ConsignmentFilters:
    """Busca livre por dono ou carro, mais recorte por status.

    Uma busca só, sobre os dois campos: quem procura no painel digita "Toro" ou
    "Marcos" sem pensar em qual coluna aquilo é. Dois campos separados
    obrigariam o vendedor a acertar a caixinha certa antes de achar o que quer.
    """

    query: str | None = None
    statuses: list[ConsignmentStatus] = field(default_factory=list)
