"""Filtros da listagem de interesses."""

from __future__ import annotations

from dataclasses import dataclass, field

from src.domain.interest.enums import InterestStatus


@dataclass(frozen=True, slots=True)
class InterestFilters:
    """Busca livre por pessoa, marca ou modelo, mais recorte por status.

    Mesma decisão da consignação: uma busca só sobre os campos que importam. O
    vendedor digita "Ana" ou "Onix" sem parar para pensar em qual coluna aquilo
    é.

    `only_with_matches` é o filtro que dá utilidade à tela: mostra apenas quem
    tem carro esperando por ele no pátio — a fila do que dá para fazer HOJE.
    """

    query: str | None = None
    statuses: list[InterestStatus] = field(default_factory=list)
    only_with_matches: bool = False
