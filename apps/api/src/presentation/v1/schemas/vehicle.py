"""Schemas de resposta da API pública.

São o *contrato* com o frontend, e por isso são separados das entidades de
domínio. Se fossem a mesma coisa, um refactor interno viraria breaking change na
API — e o app mobile do ano que vem quebraria porque alguém renomeou um atributo.

O OpenAPI gerado a partir daqui vira os tipos TypeScript do frontend.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.domain.catalog.entities import FilterOptions, VehicleSummary
from src.domain.catalog.enums import (
    BodyType,
    FeatureCategory,
    FuelType,
    TransmissionType,
    VehicleStatus,
)
from src.domain.catalog.value_objects import Page


class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    url: str
    alt_text: str | None
    width: int | None
    height: int | None
    position: int
    is_cover: bool


class FeatureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    category: FeatureCategory


class VehicleSummaryOut(BaseModel):
    """O card da listagem."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    title: str  # "Toyota Corolla XEi 2.0 Flex" — pronto para o card, sem lógica no front
    brand_name: str
    model_name: str
    version: str | None
    year_manufacture: int
    year_model: int
    price: Decimal
    mileage: int
    fuel_type: FuelType
    transmission: TransmissionType
    city: str
    state: str
    is_featured: bool
    status: VehicleStatus
    cover_image: ImageOut | None


class VehicleDetailOut(BaseModel):
    """A ficha completa da página do veículo."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    title: str

    # Os IDs alimentam o formulário de edição do painel; os nomes, a exibição.
    brand_id: UUID
    model_id: UUID
    brand_name: str
    model_name: str
    version: str | None

    year_manufacture: int
    year_model: int
    price: Decimal
    mileage: int

    fuel_type: FuelType
    transmission: TransmissionType
    body_type: BodyType

    color: str
    doors: int | None
    engine: str | None
    horsepower: int | None

    owners_count: int | None
    has_manual: bool
    has_spare_key: bool
    ipva_paid: bool
    licensing_paid: bool
    service_history: str | None

    city: str
    state: str
    description: str | None

    accepts_financing: bool
    accepts_trade: bool
    down_payment: Decimal | None
    installments_count: int | None
    # Calculada no domínio (sem juros — ver VehicleDetail.estimated_installment).
    estimated_installment: Decimal | None

    is_featured: bool
    status: VehicleStatus
    published_at: datetime | None
    created_at: datetime

    images: list[ImageOut]
    features: list[FeatureOut]


class PageMeta(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class VehiclePageOut(BaseModel):
    items: list[VehicleSummaryOut]
    meta: PageMeta

    @classmethod
    def from_page(cls, page: Page[VehicleSummary]) -> VehiclePageOut:
        return cls(
            items=[VehicleSummaryOut.model_validate(item) for item in page.items],
            meta=PageMeta(
                total=page.total,
                page=page.page,
                page_size=page.page_size,
                total_pages=page.total_pages,
                has_next=page.has_next,
                has_previous=page.has_previous,
            ),
        )


class ModelOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str


class BrandOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    models: list[ModelOptionOut]


class FilterOptionsOut(BaseModel):
    """Alimenta o formulário de busca. Tudo derivado do que existe no banco."""

    model_config = ConfigDict(from_attributes=True)

    brands: list[BrandOptionOut]
    cities: list[str]
    features: list[FeatureOut]
    price_min: Decimal | None
    price_max: Decimal | None
    year_min: int | None
    year_max: int | None
    fuel_types: list[FuelType] = Field(default_factory=lambda: list(FuelType))
    transmissions: list[TransmissionType] = Field(default_factory=lambda: list(TransmissionType))
    body_types: list[BodyType] = Field(default_factory=lambda: list(BodyType))

    @classmethod
    def from_domain(cls, options: FilterOptions) -> FilterOptionsOut:
        return cls(
            brands=[BrandOptionOut.model_validate(b) for b in options.brands],
            cities=options.cities,
            features=[FeatureOut.model_validate(f) for f in options.features],
            price_min=options.price_min,
            price_max=options.price_max,
            year_min=options.year_min,
            year_max=options.year_max,
        )
