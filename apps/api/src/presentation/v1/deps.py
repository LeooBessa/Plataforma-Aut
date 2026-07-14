"""Injeção de dependência.

Este é o *composition root*: o único lugar que sabe amarrar uma interface do
domínio à sua implementação concreta. Os casos de uso recebem o repositório
pronto e nunca souberam que ele é Postgres.

Trocar a implementação (um repositório em memória num teste, outro banco amanhã)
é mexer aqui — e em nenhum outro lugar.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.catalog.use_cases import (
    GetFilterOptionsUseCase,
    GetVehicleBySlugUseCase,
    ListFeaturedVehiclesUseCase,
    ListVehiclesUseCase,
)
from src.core.database import get_session
from src.domain.catalog.repositories import VehicleRepository
from src.infrastructure.database.repositories.vehicle_repository import (
    SqlAlchemyVehicleRepository,
)

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_vehicle_repository(session: SessionDep) -> VehicleRepository:
    return SqlAlchemyVehicleRepository(session)


VehicleRepositoryDep = Annotated[VehicleRepository, Depends(get_vehicle_repository)]


def get_list_vehicles_use_case(repository: VehicleRepositoryDep) -> ListVehiclesUseCase:
    return ListVehiclesUseCase(repository)


def get_vehicle_by_slug_use_case(repository: VehicleRepositoryDep) -> GetVehicleBySlugUseCase:
    return GetVehicleBySlugUseCase(repository)


def get_list_featured_use_case(repository: VehicleRepositoryDep) -> ListFeaturedVehiclesUseCase:
    return ListFeaturedVehiclesUseCase(repository)


def get_filter_options_use_case(repository: VehicleRepositoryDep) -> GetFilterOptionsUseCase:
    return GetFilterOptionsUseCase(repository)


ListVehiclesDep = Annotated[ListVehiclesUseCase, Depends(get_list_vehicles_use_case)]
GetVehicleDep = Annotated[GetVehicleBySlugUseCase, Depends(get_vehicle_by_slug_use_case)]
ListFeaturedDep = Annotated[ListFeaturedVehiclesUseCase, Depends(get_list_featured_use_case)]
FilterOptionsDep = Annotated[GetFilterOptionsUseCase, Depends(get_filter_options_use_case)]
