"""Rotas públicas do catálogo.

Os routers são finos de propósito: validam a entrada, chamam o caso de uso e
serializam a saída. Nenhuma regra de negócio mora aqui — se morasse, ela ficaria
inacessível para o app mobile, para um job em background ou para um teste que
não queira subir HTTP.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query, status

from src.core.exceptions import ValidationError
from src.domain.catalog.enums import BodyType, FuelType, TransmissionType
from src.domain.catalog.value_objects import (
    MAX_PAGE_SIZE,
    Pagination,
    VehicleFilters,
    VehicleSort,
)
from src.presentation.v1.deps import (
    FilterOptionsDep,
    GetVehicleDep,
    ListFeaturedDep,
    ListVehiclesDep,
)
from src.presentation.v1.schemas.vehicle import (
    FilterOptionsOut,
    VehicleDetailOut,
    VehiclePageOut,
    VehicleSummaryOut,
)

router = APIRouter(prefix="/vehicles", tags=["veículos"])


@router.get(
    "",
    response_model=VehiclePageOut,
    summary="Listar e filtrar veículos",
)
async def list_vehicles(
    use_case: ListVehiclesDep,
    q: Annotated[str | None, Query(max_length=120, description="Busca livre")] = None,
    brand: Annotated[str | None, Query(max_length=90)] = None,
    model: Annotated[str | None, Query(max_length=90)] = None,
    year_min: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    year_max: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    price_min: Annotated[Decimal | None, Query(ge=0)] = None,
    price_max: Annotated[Decimal | None, Query(ge=0)] = None,
    city: Annotated[str | None, Query(max_length=80)] = None,
    fuel: Annotated[list[FuelType] | None, Query()] = None,
    transmission: Annotated[list[TransmissionType] | None, Query()] = None,
    body: Annotated[list[BodyType] | None, Query()] = None,
    features: Annotated[list[str] | None, Query(description="Slugs; casa com TODOS")] = None,
    featured: Annotated[bool, Query()] = False,
    sort: Annotated[VehicleSort, Query()] = VehicleSort.RELEVANCE,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 12,
) -> VehiclePageOut:
    """Listagem paginada com filtros combináveis.

    Os intervalos são validados aqui (min <= max) porque um `price_min` maior que
    o `price_max` não é erro de tipo — passa pelo Pydantic e devolve uma lista
    vazia, que o usuário lê como "não há carros", e não como "seu filtro está
    invertido".
    """
    if year_min is not None and year_max is not None and year_min > year_max:
        raise ValidationError("O ano inicial não pode ser maior que o ano final.")

    if price_min is not None and price_max is not None and price_min > price_max:
        raise ValidationError("O preço mínimo não pode ser maior que o máximo.")

    filters = VehicleFilters(
        query=q,
        brand_slug=brand,
        model_slug=model,
        year_min=year_min,
        year_max=year_max,
        price_min=price_min,
        price_max=price_max,
        city=city,
        fuel_types=fuel or [],
        transmissions=transmission or [],
        body_types=body or [],
        feature_slugs=features or [],
        only_featured=featured,
        sort=sort,
    )

    result = await use_case.execute(filters, Pagination(page=page, page_size=page_size))
    return VehiclePageOut.from_page(result)


@router.get(
    "/featured",
    response_model=list[VehicleSummaryOut],
    summary="Veículos em destaque (home)",
)
async def list_featured(
    use_case: ListFeaturedDep,
    limit: Annotated[int, Query(ge=1, le=12)] = 6,
) -> list[VehicleSummaryOut]:
    vehicles = await use_case.execute(limit)
    return [VehicleSummaryOut.model_validate(v) for v in vehicles]


@router.get(
    "/filters",
    response_model=FilterOptionsOut,
    summary="Opções do formulário de busca",
)
async def get_filter_options(use_case: FilterOptionsDep) -> FilterOptionsOut:
    """Marcas, modelos, cidades e opcionais que REALMENTE existem no catálogo.

    Precisa vir antes de `/{slug}` na ordem de declaração: o FastAPI casa as
    rotas na ordem em que foram registradas, e `/{slug}` engoliria "/filters"
    como se fosse o slug de um veículo.
    """
    options = await use_case.execute()
    return FilterOptionsOut.from_domain(options)


@router.get(
    "/{slug}",
    response_model=VehicleDetailOut,
    summary="Ficha completa do veículo",
    responses={status.HTTP_404_NOT_FOUND: {"description": "Veículo não encontrado"}},
)
async def get_vehicle(slug: str, use_case: GetVehicleDep) -> VehicleDetailOut:
    vehicle = await use_case.execute(slug)
    return VehicleDetailOut.model_validate(vehicle)
