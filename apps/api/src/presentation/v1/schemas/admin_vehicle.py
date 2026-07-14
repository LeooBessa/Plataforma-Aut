from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.domain.catalog.enums import (
    BodyType,
    FuelType,
    TransmissionType,
    VehicleStatus,
)
from src.domain.catalog.write_models import ImageWrite, VehicleWrite
from src.presentation.v1.schemas.vehicle import FeatureOut

# Teto de ano. Concessionária anuncia modelo do ano seguinte (é normal em
# outubro já ter o modelo do ano que vem), mas não do ano depois desse.
_MAX_YEAR = 2100
_MIN_YEAR = 1900


class VehicleIn(BaseModel):
    """Payload de criação e edição de anúncio."""

    brand_id: UUID
    model_id: UUID

    year_manufacture: int = Field(ge=_MIN_YEAR, le=_MAX_YEAR)
    year_model: int = Field(ge=_MIN_YEAR, le=_MAX_YEAR)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    mileage: int = Field(ge=0, le=2_000_000)

    fuel_type: FuelType
    transmission: TransmissionType
    body_type: BodyType

    color: str = Field(min_length=2, max_length=40)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=2)

    version: str | None = Field(default=None, max_length=120)
    doors: int | None = Field(default=None, ge=1, le=6)
    engine: str | None = Field(default=None, max_length=40)
    horsepower: int | None = Field(default=None, ge=1, le=2000)

    owners_count: int | None = Field(default=None, ge=0, le=50)
    has_manual: bool = False
    has_spare_key: bool = False
    ipva_paid: bool = False
    licensing_paid: bool = False
    service_history: str | None = Field(default=None, max_length=2000)

    # A descrição é TEXTO PURO, e é renderizada como texto pelo React (que escapa
    # tudo por padrão). Nada de HTML aqui: aceitar HTML do admin e injetá-lo na
    # página abriria XSS armazenado — e o admin é justamente quem tem mais poder
    # para causar dano se a conta dele for comprometida.
    description: str | None = Field(default=None, max_length=5000)

    accepts_financing: bool = True
    accepts_trade: bool = True
    down_payment: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    installments_count: int | None = Field(default=None, ge=1, le=120)

    is_featured: bool = False
    status: VehicleStatus = VehicleStatus.DRAFT

    feature_ids: list[UUID] = Field(default_factory=list, max_length=60)

    @field_validator("state")
    @classmethod
    def _upper_state(cls, value: str) -> str:
        return value.upper()

    def to_domain(self) -> VehicleWrite:
        return VehicleWrite(
            brand_id=self.brand_id,
            model_id=self.model_id,
            year_manufacture=self.year_manufacture,
            year_model=self.year_model,
            price=self.price,
            mileage=self.mileage,
            fuel_type=self.fuel_type,
            transmission=self.transmission,
            body_type=self.body_type,
            color=self.color.strip(),
            city=self.city.strip(),
            state=self.state,
            version=self.version.strip() if self.version else None,
            doors=self.doors,
            engine=self.engine,
            horsepower=self.horsepower,
            owners_count=self.owners_count,
            has_manual=self.has_manual,
            has_spare_key=self.has_spare_key,
            ipva_paid=self.ipva_paid,
            licensing_paid=self.licensing_paid,
            service_history=self.service_history,
            description=self.description,
            accepts_financing=self.accepts_financing,
            accepts_trade=self.accepts_trade,
            down_payment=self.down_payment,
            installments_count=self.installments_count,
            is_featured=self.is_featured,
            status=self.status,
            feature_ids=self.feature_ids,
        )


class VehicleStatusIn(BaseModel):
    status: VehicleStatus


class AdminModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class AdminBrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    models: list[AdminModelOut]


class AdminCatalogOut(BaseModel):
    """Marcas, modelos e opcionais do formulário de cadastro.

    Todos — inclusive os que ainda não têm veículo. Diferente do endpoint público
    de filtros, que só mostra o que está publicado.
    """

    model_config = ConfigDict(from_attributes=True)

    brands: list[AdminBrandOut]
    features: list[FeatureOut]


class UploadUrlIn(BaseModel):
    content_type: str = Field(max_length=60)


class UploadUrlOut(BaseModel):
    """Autorização para o browser escrever UM arquivo no Storage.

    O `storage_path` volta na confirmação: assim o backend não precisa confiar
    num caminho enviado pelo cliente, que poderia apontar para o arquivo de
    outro anúncio.
    """

    upload_url: str
    token: str
    storage_path: str
    public_url: str


class ImageRegisterIn(BaseModel):
    storage_path: str = Field(max_length=500)
    url: str = Field(max_length=700)
    alt_text: str | None = Field(default=None, max_length=200)
    width: int | None = Field(default=None, ge=1, le=20000)
    height: int | None = Field(default=None, ge=1, le=20000)

    def to_domain(self) -> ImageWrite:
        return ImageWrite(
            storage_path=self.storage_path,
            url=self.url,
            alt_text=self.alt_text,
            width=self.width,
            height=self.height,
        )


class ImageReorderIn(BaseModel):
    image_ids: list[UUID] = Field(min_length=1, max_length=20)
