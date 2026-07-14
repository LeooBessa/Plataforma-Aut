"""Implementação Postgres do `VehicleRepository`.

Toda a tradução domínio -> SQL vive aqui. É a única camada que sabe que existe
um Postgres do outro lado; o resto do sistema conversa com a interface.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Select, distinct, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.catalog.entities import (
    BrandOption,
    FeatureItem,
    FilterOptions,
    Image,
    ModelOption,
    VehicleDetail,
    VehicleSummary,
)
from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.value_objects import Page, Pagination, VehicleFilters, VehicleSort
from src.infrastructure.database.models import (
    Brand,
    Feature,
    Vehicle,
    VehicleImage,
    VehicleModel,
    vehicle_features,
)

# A configuração de busca criada na primeira migration. Precisa ser exatamente a
# mesma usada na coluna gerada `search_vector` — se divergir, a query não casa
# com nada e a busca devolve vazio em silêncio.
TS_CONFIG = "portuguese_unaccent"


class SqlAlchemyVehicleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------ busca

    def _build_conditions(
        self, filters: VehicleFilters, statuses: Sequence[VehicleStatus]
    ) -> list[ColumnElement[bool]]:
        """Traduz os filtros em condições WHERE.

        Extraído num método porque a busca e a contagem TÊM que usar exatamente
        as mesmas condições. Duplicar essa lógica levaria, mais cedo ou mais
        tarde, a um total que não bate com os itens da página.
        """
        conditions: list[ColumnElement[bool]] = [Vehicle.status.in_(statuses)]

        if filters.has_text_query:
            assert filters.query is not None
            tsquery = func.plainto_tsquery(TS_CONFIG, filters.query.strip())
            conditions.append(Vehicle.search_vector.bool_op("@@")(tsquery))

        # Marca e modelo entram por subconsulta em vez de JOIN. Assim as
        # condições são puramente WHERE e podem ser reaproveitadas pela contagem
        # sem arrastar junto a topologia de joins.
        if filters.brand_slug:
            conditions.append(
                Vehicle.brand_id.in_(select(Brand.id).where(Brand.slug == filters.brand_slug))
            )

        if filters.model_slug:
            conditions.append(
                Vehicle.model_id.in_(
                    select(VehicleModel.id).where(VehicleModel.slug == filters.model_slug)
                )
            )

        if filters.year_min is not None:
            conditions.append(Vehicle.year_model >= filters.year_min)
        if filters.year_max is not None:
            conditions.append(Vehicle.year_model <= filters.year_max)

        if filters.price_min is not None:
            conditions.append(Vehicle.price >= filters.price_min)
        if filters.price_max is not None:
            conditions.append(Vehicle.price <= filters.price_max)

        if filters.city:
            conditions.append(Vehicle.city == filters.city)

        if filters.fuel_types:
            conditions.append(Vehicle.fuel_type.in_(filters.fuel_types))
        if filters.transmissions:
            conditions.append(Vehicle.transmission.in_(filters.transmissions))
        if filters.body_types:
            conditions.append(Vehicle.body_type.in_(filters.body_types))

        if filters.only_featured:
            conditions.append(Vehicle.is_featured.is_(True))

        if filters.feature_slugs:
            # Semântica E, não OU. Quem marca "teto solar" e "câmera de ré" quer
            # os carros que têm AS DUAS coisas — não os que têm qualquer uma
            # delas. O HAVING com a contagem distinta é o que garante isso: só
            # passa o veículo cuja quantidade de opcionais casados é igual à
            # quantidade de opcionais pedidos.
            matching = (
                select(vehicle_features.c.vehicle_id)
                .join(Feature, Feature.id == vehicle_features.c.feature_id)
                .where(Feature.slug.in_(filters.feature_slugs))
                .group_by(vehicle_features.c.vehicle_id)
                .having(func.count(distinct(Feature.id)) == len(set(filters.feature_slugs)))
            )
            conditions.append(Vehicle.id.in_(matching))

        return conditions

    def _apply_sort(self, stmt: Select[Any], filters: VehicleFilters) -> Select[Any]:
        order: list[Any] = []

        match filters.sort:
            case VehicleSort.PRICE_ASC:
                order.append(Vehicle.price.asc())
            case VehicleSort.PRICE_DESC:
                order.append(Vehicle.price.desc())
            case VehicleSort.YEAR_DESC:
                order.append(Vehicle.year_model.desc())
            case VehicleSort.MILEAGE_ASC:
                order.append(Vehicle.mileage.asc())
            case VehicleSort.NEWEST:
                order.append(Vehicle.published_at.desc().nullslast())
            case VehicleSort.RELEVANCE:
                if filters.has_text_query:
                    assert filters.query is not None
                    tsquery = func.plainto_tsquery(TS_CONFIG, filters.query.strip())
                    order.append(func.ts_rank(Vehicle.search_vector, tsquery).desc())
                # Sem termo de busca, "relevância" é o critério comercial:
                # destaque primeiro, depois o mais recente.
                order.append(Vehicle.is_featured.desc())
                order.append(Vehicle.published_at.desc().nullslast())

        # Desempate estável, SEMPRE. Sem uma chave única no final, duas linhas
        # com o mesmo preço podem sair em ordens diferentes a cada consulta — e
        # aí o mesmo carro aparece na página 1 e na 2, enquanto outro some. É um
        # bug de paginação clássico e quase invisível em teste manual.
        order.append(Vehicle.id.asc())

        return stmt.order_by(*order)

    async def search(
        self,
        filters: VehicleFilters,
        pagination: Pagination,
        *,
        statuses: list[VehicleStatus],
    ) -> Page[VehicleSummary]:
        conditions = self._build_conditions(filters, statuses)

        total = await self._session.scalar(
            select(func.count()).select_from(Vehicle).where(*conditions)
        )

        stmt = (
            select(Vehicle)
            .where(*conditions)
            # selectinload evita o N+1: sem ele, seriam 12 consultas extras para
            # buscar as imagens de cada card da página.
            .options(selectinload(Vehicle.images))
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )
        stmt = self._apply_sort(stmt, filters)

        rows = await self._session.scalars(stmt)

        return Page(
            items=[_to_summary(v) for v in rows.unique()],
            total=total or 0,
            page=pagination.page,
            page_size=pagination.page_size,
        )

    async def get_by_slug(
        self, slug: str, *, statuses: list[VehicleStatus]
    ) -> VehicleDetail | None:
        stmt = (
            select(Vehicle)
            .where(Vehicle.slug == slug, Vehicle.status.in_(statuses))
            .options(selectinload(Vehicle.images), selectinload(Vehicle.features))
        )
        vehicle = await self._session.scalar(stmt)
        return _to_detail(vehicle) if vehicle else None

    async def list_featured(
        self, limit: int, *, statuses: list[VehicleStatus]
    ) -> list[VehicleSummary]:
        stmt = (
            select(Vehicle)
            .where(Vehicle.status.in_(statuses), Vehicle.is_featured.is_(True))
            .options(selectinload(Vehicle.images))
            .order_by(Vehicle.published_at.desc().nullslast(), Vehicle.id.asc())
            .limit(limit)
        )
        rows = await self._session.scalars(stmt)
        return [_to_summary(v) for v in rows.unique()]

    # ---------------------------------------------------------------- filtros

    async def get_filter_options(self, *, statuses: list[VehicleStatus]) -> FilterOptions:
        visible = Vehicle.status.in_(statuses)

        # Só marcas e modelos que TÊM veículo visível. Oferecer "Ferrari" num
        # filtro que devolve zero resultados é pior do que não oferecer.
        brand_rows = await self._session.execute(
            select(Brand.slug, Brand.name, VehicleModel.slug, VehicleModel.name)
            .join(Vehicle, Vehicle.brand_id == Brand.id)
            .join(VehicleModel, VehicleModel.id == Vehicle.model_id)
            .where(visible)
            .distinct()
            .order_by(Brand.name, VehicleModel.name)
        )

        models_by_brand: dict[tuple[str, str], list[ModelOption]] = {}
        for brand_slug, brand_name, model_slug, model_name in brand_rows:
            models_by_brand.setdefault((brand_slug, brand_name), []).append(
                ModelOption(slug=model_slug, name=model_name)
            )

        brands = [
            BrandOption(slug=slug, name=name, models=models)
            for (slug, name), models in models_by_brand.items()
        ]

        city_rows = await self._session.scalars(
            select(Vehicle.city).where(visible).distinct().order_by(Vehicle.city)
        )

        feature_rows = await self._session.scalars(
            select(Feature)
            .join(vehicle_features, vehicle_features.c.feature_id == Feature.id)
            .join(Vehicle, Vehicle.id == vehicle_features.c.vehicle_id)
            .where(visible)
            .distinct()
            .order_by(Feature.category, Feature.name)
        )

        bounds = (
            await self._session.execute(
                select(
                    func.min(Vehicle.price),
                    func.max(Vehicle.price),
                    func.min(Vehicle.year_model),
                    func.max(Vehicle.year_model),
                ).where(visible)
            )
        ).one()

        return FilterOptions(
            brands=brands,
            cities=list(city_rows),
            features=[_to_feature(f) for f in feature_rows],
            price_min=bounds[0],
            price_max=bounds[1],
            year_min=bounds[2],
            year_max=bounds[3],
        )

    async def increment_views(self, vehicle_id: UUID) -> None:
        """Incrementa no próprio banco (`views_count + 1`), não em Python.

        Ler, somar e gravar em Python perderia contagens sob concorrência: dois
        visitantes simultâneos leriam o mesmo valor e gravariam o mesmo +1.
        """
        await self._session.execute(
            update(Vehicle)
            .where(Vehicle.id == vehicle_id)
            .values(views_count=Vehicle.views_count + 1)
        )


# --------------------------------------------------------------------- mapeadores
#
# Convertem o model do SQLAlchemy na entidade pura do domínio. É a fronteira: da
# porta para dentro, ninguém sabe que SQLAlchemy existe.


def _to_image(image: VehicleImage) -> Image:
    return Image(
        id=image.id,
        url=image.url,
        alt_text=image.alt_text,
        width=image.width,
        height=image.height,
        position=image.position,
        is_cover=image.is_cover,
    )


def _to_feature(feature: Feature) -> FeatureItem:
    return FeatureItem(
        id=feature.id,
        name=feature.name,
        slug=feature.slug,
        category=feature.category,
    )


def _pick_cover(images: list[VehicleImage]) -> Image | None:
    if not images:
        return None
    # `is_cover` manda; se ninguém foi marcado como capa, a primeira da ordem
    # serve. Um card sem foto é um card que ninguém clica.
    cover = next((i for i in images if i.is_cover), None)
    return _to_image(cover or min(images, key=lambda i: i.position))


def _to_summary(vehicle: Vehicle) -> VehicleSummary:
    return VehicleSummary(
        id=vehicle.id,
        slug=vehicle.slug,
        brand_name=vehicle.brand_name,
        model_name=vehicle.model_name,
        version=vehicle.version,
        year_manufacture=vehicle.year_manufacture,
        year_model=vehicle.year_model,
        price=vehicle.price,
        mileage=vehicle.mileage,
        fuel_type=vehicle.fuel_type,
        transmission=vehicle.transmission,
        city=vehicle.city,
        state=vehicle.state,
        is_featured=vehicle.is_featured,
        status=vehicle.status,
        cover_image=_pick_cover(list(vehicle.images)),
    )


def _to_detail(vehicle: Vehicle) -> VehicleDetail:
    return VehicleDetail(
        id=vehicle.id,
        slug=vehicle.slug,
        brand_name=vehicle.brand_name,
        model_name=vehicle.model_name,
        version=vehicle.version,
        year_manufacture=vehicle.year_manufacture,
        year_model=vehicle.year_model,
        price=vehicle.price,
        mileage=vehicle.mileage,
        fuel_type=vehicle.fuel_type,
        transmission=vehicle.transmission,
        body_type=vehicle.body_type,
        color=vehicle.color,
        doors=vehicle.doors,
        engine=vehicle.engine,
        horsepower=vehicle.horsepower,
        owners_count=vehicle.owners_count,
        has_manual=vehicle.has_manual,
        has_spare_key=vehicle.has_spare_key,
        ipva_paid=vehicle.ipva_paid,
        licensing_paid=vehicle.licensing_paid,
        service_history=vehicle.service_history,
        city=vehicle.city,
        state=vehicle.state,
        description=vehicle.description,
        accepts_financing=vehicle.accepts_financing,
        accepts_trade=vehicle.accepts_trade,
        down_payment=vehicle.down_payment,
        installments_count=vehicle.installments_count,
        is_featured=vehicle.is_featured,
        status=vehicle.status,
        published_at=vehicle.published_at,
        created_at=vehicle.created_at,
        images=sorted((_to_image(i) for i in vehicle.images), key=lambda i: i.position),
        features=[_to_feature(f) for f in vehicle.features],
    )
