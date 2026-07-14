"""Models SQLAlchemy.

Importar tudo aqui não é organização: é requisito. O Alembic gera migrations a
partir de `Base.metadata`, e um model que ninguém importou simplesmente não
existe para ele — a tabela sumiria da migration, em silêncio.
"""

from __future__ import annotations

from src.infrastructure.database.models.catalog import (
    Brand,
    Feature,
    Vehicle,
    VehicleImage,
    VehicleModel,
    vehicle_features,
)
from src.infrastructure.database.models.dealership import Dealership
from src.infrastructure.database.models.identity import RefreshToken, User
from src.infrastructure.database.models.scheduling import Appointment

__all__ = [
    "Appointment",
    "Brand",
    "Dealership",
    "Feature",
    "RefreshToken",
    "User",
    "Vehicle",
    "VehicleImage",
    "VehicleModel",
    "vehicle_features",
]
