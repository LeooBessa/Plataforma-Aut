from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Computed,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.domain.catalog.enums import (
    BodyType,
    FeatureCategory,
    FuelType,
    TransmissionType,
    VehicleStatus,
)
from src.infrastructure.database.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from src.infrastructure.database.models.dealership import Dealership
    from src.infrastructure.database.models.identity import User
    from src.infrastructure.database.models.scheduling import Appointment


def _pg_enum(enum_cls: type, name: str) -> Enum:
    """Enum nativo do Postgres guardando o *valor* (não o nome) do membro."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


# Tabela de associação veículo <-> opcional.
#
# Normalizada de propósito, em vez de uma coluna JSON com a lista de opcionais:
# o briefing pede *filtrar* por opcionais ("com teto solar"), e um array JSON não
# se indexa bem para isso. Com a associação, o filtro vira um JOIN indexado.
vehicle_features = Table(
    "vehicle_features",
    Base.metadata,
    Column(
        "vehicle_id",
        PGUUID(as_uuid=True),
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "feature_id",
        PGUUID(as_uuid=True),
        ForeignKey("features.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Index("ix_vehicle_features_feature", "feature_id"),
)


class Brand(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Marca (Toyota, Volkswagen...)."""

    __tablename__ = "brands"

    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(90), nullable=False, unique=True, index=True)

    models: Mapped[list[VehicleModel]] = relationship(
        back_populates="brand", cascade="all, delete-orphan"
    )


class VehicleModel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Modelo dentro de uma marca (Corolla, Golf...)."""

    __tablename__ = "vehicle_models"
    __table_args__ = (UniqueConstraint("brand_id", "slug", name="uq_vehicle_models_brand_slug"),)

    brand_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("brands.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(90), nullable=False)

    brand: Mapped[Brand] = relationship(back_populates="models")


class Feature(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Opcional / item de série (ar-condicionado, teto solar, câmera de ré...)."""

    __tablename__ = "features"

    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(90), nullable=False, unique=True, index=True)
    category: Mapped[FeatureCategory] = mapped_column(
        _pg_enum(FeatureCategory, "feature_category"), nullable=False
    )


class Vehicle(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Anúncio de veículo — a entidade central da plataforma."""

    __tablename__ = "vehicles"
    __table_args__ = (
        CheckConstraint("price > 0", name="ck_vehicles_price_positive"),
        CheckConstraint("mileage >= 0", name="ck_vehicles_mileage_non_negative"),
        CheckConstraint(
            "year_model >= year_manufacture", name="ck_vehicles_year_model_gte_manufacture"
        ),
        CheckConstraint("year_manufacture >= 1900", name="ck_vehicles_year_sane"),
        # Índice da listagem e da home: filtra por status, prioriza destaques e
        # ordena por publicação. Cobre a query mais quente do site inteiro.
        Index(
            "ix_vehicles_listing",
            "status",
            "is_featured",
            "published_at",
            postgresql_using="btree",
        ),
        Index("ix_vehicles_brand_model", "brand_id", "model_id"),
        Index("ix_vehicles_price", "price"),
        Index("ix_vehicles_year_model", "year_model"),
        Index("ix_vehicles_city", "city"),
        Index("ix_vehicles_dealership_status", "dealership_id", "status"),
        # GIN sobre o tsvector: é o que faz a busca textual responder em
        # milissegundos em vez de varrer a tabela.
        Index("ix_vehicles_search", "search_vector", postgresql_using="gin"),
    )

    dealership_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("dealerships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    brand_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("brands.id", ondelete="RESTRICT"), nullable=False
    )
    model_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vehicle_models.id", ondelete="RESTRICT"), nullable=False
    )

    # --- Cópia denormalizada de marca e modelo -------------------------------
    # Existe por causa da busca textual. O `search_vector` é uma coluna GERADA
    # pelo Postgres, e uma coluna gerada só enxerga colunas da *própria* linha —
    # não pode fazer JOIN. Sem esta cópia, quem digitasse "corolla" na busca não
    # acharia nada, porque o nome do modelo mora em outra tabela.
    #
    # O preço disso: renomear uma marca exige repopular estas colunas. É raro, e
    # o caso de uso de renomeação cuida do backfill. Em troca, o vetor de busca
    # nunca pode divergir dos dados — o Postgres o recalcula sozinho a cada
    # escrita, e não há trigger nem código de aplicação para esquecer de rodar.
    brand_name: Mapped[str] = mapped_column(String(80), nullable=False)
    model_name: Mapped[str] = mapped_column(String(80), nullable=False)

    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    version: Mapped[str | None] = mapped_column(String(120))  # "XEi 2.0 Flex"

    # Fabricação e modelo são anos distintos no Brasil, e o comprador olha os
    # dois. Um campo "ano" único seria um erro de modelagem de domínio.
    year_manufacture: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    year_model: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    mileage: Mapped[int] = mapped_column(Integer, nullable=False)

    fuel_type: Mapped[FuelType] = mapped_column(_pg_enum(FuelType, "fuel_type"), nullable=False)
    transmission: Mapped[TransmissionType] = mapped_column(
        _pg_enum(TransmissionType, "transmission_type"), nullable=False
    )
    body_type: Mapped[BodyType] = mapped_column(_pg_enum(BodyType, "body_type"), nullable=False)

    color: Mapped[str] = mapped_column(String(40), nullable=False)
    doors: Mapped[int | None] = mapped_column(SmallInteger)
    engine: Mapped[str | None] = mapped_column(String(40))  # "2.0"
    horsepower: Mapped[int | None] = mapped_column(SmallInteger)

    # `server_default` além de `default`: o `default` é do ORM (Python), o
    # `server_default` é do banco. Sem o segundo, qualquer escrita que não passe
    # pelo SQLAlchemy — um script de correção, um seed em SQL, o painel do
    # Supabase — quebra num NOT NULL sem valor. O schema tem que se defender
    # sozinho, sem depender de quem está escrevendo.
    owners_count: Mapped[int | None] = mapped_column(SmallInteger)
    has_manual: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    has_spare_key: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    ipva_paid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    licensing_paid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    service_history: Mapped[str | None] = mapped_column(Text)  # histórico de revisões

    city: Mapped[str] = mapped_column(String(80), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False)

    description: Mapped[str | None] = mapped_column(Text)

    # --- Informações financeiras ---
    accepts_financing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    accepts_trade: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    down_payment: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    installments_count: Mapped[int | None] = mapped_column(SmallInteger)

    is_featured: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false"), index=True
    )
    status: Mapped[VehicleStatus] = mapped_column(
        _pg_enum(VehicleStatus, "vehicle_status"),
        nullable=False,
        default=VehicleStatus.DRAFT,
        server_default=text("'draft'"),
    )

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sold_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    views_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )

    # Coluna GERADA e persistida (STORED): o Postgres a recalcula a cada INSERT
    # ou UPDATE. Impossível ficar dessincronizada dos dados.
    #
    # A configuração é `portuguese_unaccent`, criada na primeira migration — NÃO
    # é a `portuguese` nativa. A diferença é acento, e ela é decisiva:
    #
    #   to_tsvector('portuguese', 'revisões')  →  radical com til
    #   plainto_tsquery('portuguese', 'revisao') → radical sem til  →  NÃO CASA
    #
    # Ou seja: com a config nativa, quem digitasse "sedan" não acharia "sedã",
    # "cambio" não acharia "câmbio", "revisao" não acharia "revisões". A busca
    # degradaria em silêncio — ninguém vê um erro, só resultados faltando.
    #
    # A `portuguese_unaccent` remove o acento ANTES do stemmer, então as duas
    # grafias convergem para o mesmo radical. Como brasileiro digita sem acento
    # na barra de busca, isso não é refinamento: é requisito.
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed(
            "to_tsvector('portuguese_unaccent', "
            "coalesce(brand_name, '') || ' ' || "
            "coalesce(model_name, '') || ' ' || "
            "coalesce(version, '') || ' ' || "
            "coalesce(color, '') || ' ' || "
            "coalesce(city, '') || ' ' || "
            "coalesce(description, '')"
            ")",
            persisted=True,
        ),
        nullable=False,
    )

    dealership: Mapped[Dealership] = relationship(back_populates="vehicles")
    brand: Mapped[Brand] = relationship()
    model: Mapped[VehicleModel] = relationship()
    created_by: Mapped[User | None] = relationship()

    images: Mapped[list[VehicleImage]] = relationship(
        back_populates="vehicle",
        cascade="all, delete-orphan",
        order_by="VehicleImage.position",
    )
    features: Mapped[list[Feature]] = relationship(secondary=vehicle_features)
    appointments: Mapped[list[Appointment]] = relationship(back_populates="vehicle")


class VehicleImage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Foto do veículo, armazenada no Supabase Storage.

    O binário nunca passa pelo backend (limite de payload da função serverless):
    o browser envia direto ao Storage via signed URL e depois registra a foto
    aqui. Por isso guardamos `storage_path` — é o que permite deletar o arquivo
    lá quando o registro morre aqui.

    `width` e `height` são guardados para o `next/image` reservar o espaço da
    imagem antes de ela carregar. Sem isso, o layout "pula" quando a foto chega,
    e Cumulative Layout Shift é uma das métricas do Core Web Vitals.
    """

    __tablename__ = "vehicle_images"
    __table_args__ = (Index("ix_vehicle_images_vehicle_position", "vehicle_id", "position"),)

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False
    )

    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(String(700), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(200))

    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)

    position: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default=text("0")
    )
    is_cover: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    vehicle: Mapped[Vehicle] = relationship(back_populates="images")
