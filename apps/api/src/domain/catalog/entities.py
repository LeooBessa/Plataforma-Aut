"""Entidades do catálogo — o modelo de leitura do domínio.

Estes objetos são puros: dataclasses sem SQLAlchemy, sem Pydantic, sem FastAPI.
É isso que permite testar as regras de negócio sem banco e sem HTTP, e é o que
faz a Clean Architecture valer o esforço.

São *read models*: representam o veículo como o domínio o expõe para leitura.
A separação entre `VehicleSummary` (card da listagem) e `VehicleDetail` (página
do veículo) é deliberada — a listagem devolve dezenas de itens por request, e
carregar a ficha completa de cada um seria desperdício puro de banco e de banda.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from src.domain.catalog.enums import (
    BodyType,
    FeatureCategory,
    FuelType,
    TransmissionType,
    VehicleStatus,
)


@dataclass(frozen=True, slots=True)
class Image:
    id: UUID
    url: str
    alt_text: str | None
    width: int | None
    height: int | None
    position: int
    is_cover: bool


@dataclass(frozen=True, slots=True)
class FeatureItem:
    id: UUID
    name: str
    slug: str
    category: FeatureCategory


@dataclass(frozen=True, slots=True)
class VehicleSummary:
    """O card da listagem. Só o que a home e a busca precisam mostrar."""

    id: UUID
    slug: str
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
    cover_image: Image | None

    @property
    def title(self) -> str:
        """Título do anúncio: 'Toyota Corolla XEi 2.0 Flex'."""
        parts = [self.brand_name, self.model_name]
        if self.version:
            parts.append(self.version)
        return " ".join(parts)


@dataclass(frozen=True, slots=True)
class VehicleDetail:
    """A ficha completa. Uma por request, então pode ser generosa."""

    id: UUID
    slug: str
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

    is_featured: bool
    status: VehicleStatus
    published_at: datetime | None
    created_at: datetime

    images: list[Image] = field(default_factory=list)
    features: list[FeatureItem] = field(default_factory=list)

    @property
    def title(self) -> str:
        parts = [self.brand_name, self.model_name]
        if self.version:
            parts.append(self.version)
        return " ".join(parts)

    @property
    def cover_image(self) -> Image | None:
        return next((i for i in self.images if i.is_cover), self.images[0] if self.images else None)

    @property
    def estimated_installment(self) -> Decimal | None:
        """Parcela estimada, quando o anúncio aceita financiamento.

        Cálculo simples e transparente: (preço - entrada) / nº de parcelas. NÃO
        embute juros de propósito — apresentar uma parcela "com juros" inventada
        pela plataforma seria informação financeira enganosa. O número real sai
        do banco na simulação, e é isso que a interface deve deixar claro.
        """
        if not self.accepts_financing or not self.installments_count:
            return None

        entrada = self.down_payment or Decimal(0)
        financiado = self.price - entrada
        if financiado <= 0:
            return None

        return (financiado / self.installments_count).quantize(Decimal("0.01"))


@dataclass(frozen=True, slots=True)
class BrandOption:
    """Marca com seus modelos — alimenta os selects encadeados da busca."""

    slug: str
    name: str
    models: list[ModelOption] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class ModelOption:
    slug: str
    name: str


@dataclass(frozen=True, slots=True)
class FilterOptions:
    """Tudo que o formulário de busca precisa para se montar.

    Vem do banco, não de uma constante no frontend: se um dia existir um veículo
    em Curitiba, "Curitiba" aparece no filtro sozinho. Filtro fixo no código
    envelhece e passa a oferecer opção que não retorna nada.
    """

    brands: list[BrandOption] = field(default_factory=list)
    cities: list[str] = field(default_factory=list)
    features: list[FeatureItem] = field(default_factory=list)
    price_min: Decimal | None = None
    price_max: Decimal | None = None
    year_min: int | None = None
    year_max: int | None = None
