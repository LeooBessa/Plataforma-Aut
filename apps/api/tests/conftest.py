from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from src.core.config import get_settings
from src.core.database import get_session
from src.domain.catalog.enums import (
    BodyType,
    FeatureCategory,
    FuelType,
    TransmissionType,
    VehicleStatus,
)
from src.infrastructure.database.models import (
    Brand,
    Dealership,
    Feature,
    Vehicle,
    VehicleImage,
    VehicleModel,
)
from src.main import create_app


def _test_database_url() -> str:
    url = get_settings().test_database_url
    if not url:
        pytest.skip("TEST_DATABASE_URL não configurada — testes de integração pulados")
    return url


@pytest.fixture(scope="session", autouse=True)
def _migrate() -> Iterator[None]:
    """Aplica as migrations no banco de teste, uma vez por sessão.

    Roda a MIGRATION de verdade, não `Base.metadata.create_all()`. A diferença
    importa: a configuração de busca `portuguese_unaccent` existe apenas dentro
    da migration. Com `create_all`, a coluna gerada `search_vector` nem seria
    criada — e os testes de busca estariam validando um schema que não é o que
    vai para produção.

    É o argumento inteiro a favor de testar contra a migration: o que está sob
    teste é exatamente o schema que vai para o ar.
    """
    url = _test_database_url()

    # O env.py do Alembic lê DATABASE_DIRECT_URL do ambiente.
    previous = os.environ.get("DATABASE_DIRECT_URL")
    os.environ["DATABASE_DIRECT_URL"] = url
    get_settings.cache_clear()

    config = Config("alembic.ini")
    command.downgrade(config, "base")  # parte sempre de um estado limpo
    command.upgrade(config, "head")

    yield

    if previous is None:
        os.environ.pop("DATABASE_DIRECT_URL", None)
    else:
        os.environ["DATABASE_DIRECT_URL"] = previous
    get_settings.cache_clear()


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    """Uma sessão por teste, dentro de uma transação que SEMPRE sofre rollback.

    O teste pode até chamar `commit()`: com `join_transaction_mode="create_savepoint"`,
    esse commit vira um savepoint dentro da transação externa, que é descartada
    no fim.

    Resultado: isolamento total entre testes, sem TRUNCATE e sem lentidão. Uma
    suíte cujos testes dependem da ordem em que rodaram é uma das piores dores
    que um projeto desenvolve — isto previne por construção.
    """
    engine = create_async_engine(_test_database_url(), poolclass=NullPool)

    async with engine.connect() as connection:
        transaction = await connection.begin()
        db_session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )

        try:
            yield db_session
        finally:
            await db_session.close()
            await transaction.rollback()

    await engine.dispose()


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """Cliente HTTP falando com a app ASGI, amarrado à sessão transacional do teste."""
    app = create_app()

    async def _override_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _override_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client

    app.dependency_overrides.clear()


# --------------------------------------------------------------------- fábricas


@pytest.fixture
async def dealership(session: AsyncSession) -> Dealership:
    obj = Dealership(name="Auto Teste", slug="auto-teste", city="São Paulo", state="SP")
    session.add(obj)
    await session.flush()
    return obj


@pytest.fixture
async def features(session: AsyncSession) -> dict[str, Feature]:
    items = {
        "teto-solar": Feature(
            name="Teto solar", slug="teto-solar", category=FeatureCategory.EXTERIOR
        ),
        "camera-de-re": Feature(
            name="Câmera de ré", slug="camera-de-re", category=FeatureCategory.TECHNOLOGY
        ),
        "airbags": Feature(name="Airbags", slug="airbags", category=FeatureCategory.SAFETY),
    }
    session.add_all(list(items.values()))
    await session.flush()
    return items


class VehicleFactory:
    """Cria veículos nos testes sem repetir 25 campos obrigatórios a cada chamada."""

    def __init__(self, session: AsyncSession, dealership: Dealership) -> None:
        self._session = session
        self._dealership = dealership
        self._brands: dict[str, Brand] = {}
        self._models: dict[tuple[str, str], VehicleModel] = {}

    async def _brand(self, name: str) -> Brand:
        if name not in self._brands:
            brand = Brand(name=name, slug=name.lower().replace(" ", "-"))
            self._session.add(brand)
            await self._session.flush()
            self._brands[name] = brand
        return self._brands[name]

    async def _model(self, brand: Brand, name: str) -> VehicleModel:
        key = (brand.name, name)
        if key not in self._models:
            model = VehicleModel(brand_id=brand.id, name=name, slug=name.lower().replace(" ", "-"))
            self._session.add(model)
            await self._session.flush()
            self._models[key] = model
        return self._models[key]

    async def create(
        self,
        *,
        brand: str = "Toyota",
        model: str = "Corolla",
        version: str | None = "XEi 2.0",
        slug: str | None = None,
        price: str = "100000.00",
        year_model: int = 2023,
        year_manufacture: int = 2022,
        mileage: int = 30000,
        fuel: FuelType = FuelType.FLEX,
        transmission: TransmissionType = TransmissionType.AUTOMATIC,
        body: BodyType = BodyType.SEDAN,
        city: str = "São Paulo",
        color: str = "Prata",
        description: str | None = None,
        status: VehicleStatus = VehicleStatus.ACTIVE,
        is_featured: bool = False,
        feature_objs: list[Feature] | None = None,
        with_images: bool = True,
    ) -> Vehicle:
        brand_obj = await self._brand(brand)
        model_obj = await self._model(brand_obj, model)

        vehicle = Vehicle(
            dealership_id=self._dealership.id,
            brand_id=brand_obj.id,
            model_id=model_obj.id,
            brand_name=brand,
            model_name=model,
            slug=slug or f"{brand}-{model}-{version}-{year_model}".lower().replace(" ", "-"),
            version=version,
            year_manufacture=year_manufacture,
            year_model=year_model,
            price=Decimal(price),
            mileage=mileage,
            fuel_type=fuel,
            transmission=transmission,
            body_type=body,
            color=color,
            city=city,
            state="SP",
            description=description,
            status=status,
            is_featured=is_featured,
            published_at=datetime.now(UTC),
        )
        if feature_objs:
            vehicle.features = feature_objs
        if with_images:
            vehicle.images.append(
                VehicleImage(
                    storage_path="t/0.jpg",
                    url="https://example.com/0.jpg",
                    position=0,
                    is_cover=True,
                    width=1200,
                    height=800,
                )
            )

        self._session.add(vehicle)
        await self._session.flush()
        return vehicle


@pytest.fixture
def vehicles(session: AsyncSession, dealership: Dealership) -> VehicleFactory:
    return VehicleFactory(session, dealership)
