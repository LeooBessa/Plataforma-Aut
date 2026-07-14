"""Objetos de valor do catálogo: filtros, ordenação e paginação."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum
from math import ceil

from src.domain.catalog.enums import BodyType, FuelType, TransmissionType

MAX_PAGE_SIZE = 48


class VehicleSort(StrEnum):
    RELEVANCE = "relevance"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"
    YEAR_DESC = "year_desc"
    MILEAGE_ASC = "mileage_asc"
    NEWEST = "newest"


@dataclass(frozen=True, slots=True)
class VehicleFilters:
    """Critérios de busca.

    Listas em vez de valor único em combustível, câmbio e categoria: o usuário
    quer poder marcar "flex E gasolina" de uma vez. Um valor só forçaria ele a
    fazer duas buscas.
    """

    query: str | None = None
    brand_slug: str | None = None
    model_slug: str | None = None
    year_min: int | None = None
    year_max: int | None = None
    price_min: Decimal | None = None
    price_max: Decimal | None = None
    city: str | None = None
    fuel_types: list[FuelType] = field(default_factory=list)
    transmissions: list[TransmissionType] = field(default_factory=list)
    body_types: list[BodyType] = field(default_factory=list)
    feature_slugs: list[str] = field(default_factory=list)
    only_featured: bool = False
    sort: VehicleSort = VehicleSort.RELEVANCE

    @property
    def has_text_query(self) -> bool:
        return bool(self.query and self.query.strip())


@dataclass(frozen=True, slots=True)
class Pagination:
    page: int = 1
    page_size: int = 12

    def __post_init__(self) -> None:
        # Um `page_size=100000` derrubaria o banco. O teto é defesa, não estética.
        if self.page < 1:
            raise ValueError("page deve ser >= 1")
        if not 1 <= self.page_size <= MAX_PAGE_SIZE:
            raise ValueError(f"page_size deve estar entre 1 e {MAX_PAGE_SIZE}")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


@dataclass(frozen=True, slots=True)
class Page[T]:
    """Uma página de resultados, com o que o frontend precisa para paginar."""

    items: list[T]
    total: int
    page: int
    page_size: int

    @property
    def total_pages(self) -> int:
        return ceil(self.total / self.page_size) if self.page_size else 0

    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

    @property
    def has_previous(self) -> bool:
        return self.page > 1
