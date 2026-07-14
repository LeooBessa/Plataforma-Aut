"""Vocabulário do domínio de catálogo.

Os valores são em inglês e minúsculos porque viram valores de enum no Postgres e
strings no JSON da API. Os rótulos em português vivem na camada de i18n do
frontend — misturar as duas coisas amarraria o banco ao idioma da interface.
"""

from __future__ import annotations

from enum import StrEnum


class FuelType(StrEnum):
    FLEX = "flex"
    GASOLINE = "gasoline"
    ETHANOL = "ethanol"
    DIESEL = "diesel"
    ELECTRIC = "electric"
    HYBRID = "hybrid"
    GNV = "gnv"


class TransmissionType(StrEnum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"
    CVT = "cvt"
    AUTOMATED = "automated"  # automatizado (single-clutch)
    DUAL_CLUTCH = "dual_clutch"


class BodyType(StrEnum):
    """Categoria da carroceria."""

    HATCH = "hatch"
    SEDAN = "sedan"
    SUV = "suv"
    PICKUP = "pickup"
    COUPE = "coupe"
    CONVERTIBLE = "convertible"
    WAGON = "wagon"
    MINIVAN = "minivan"
    VAN = "van"


class VehicleStatus(StrEnum):
    """Ciclo de vida do anúncio.

    Um booleano `vendido` não daria conta: o briefing pede publicar, marcar como
    vendido, arquivar e excluir — e "excluir" aqui é ARCHIVED, não DELETE. Um
    anúncio apagado por engano é receita perdida e histórico destruído.
    """

    DRAFT = "draft"
    ACTIVE = "active"
    RESERVED = "reserved"
    SOLD = "sold"
    ARCHIVED = "archived"

    @property
    def is_publicly_visible(self) -> bool:
        """Estados que o visitante pode ver.

        RESERVED continua visível de propósito: gera urgência e ainda capta lead
        para veículos parecidos. SOLD some da listagem, mas a página individual
        segue de pé (SEO acumulado, com selo de vendido).
        """
        return self in {VehicleStatus.ACTIVE, VehicleStatus.RESERVED}


class FeatureCategory(StrEnum):
    """Agrupamento dos opcionais na ficha do veículo."""

    COMFORT = "comfort"
    SAFETY = "safety"
    TECHNOLOGY = "technology"
    PERFORMANCE = "performance"
    EXTERIOR = "exterior"
    INTERIOR = "interior"
