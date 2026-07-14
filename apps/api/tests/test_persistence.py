"""Os dados sobrevivem ao fim da requisição?

Este arquivo existe por causa de um bug real, encontrado ao exercitar a API de
verdade — não pelos testes.

A API respondia `201 Created`, com id e tudo, e **não gravava nada**. A dependência
de sessão fazia rollback em caso de erro, mas nunca fazia commit em caso de
sucesso: os repositórios chamavam `flush()` (que envia o SQL e devolve os ids
gerados), e a transação era descartada ao fechar a sessão. Em produção, todo
agendamento e todo anúncio sumiriam em silêncio.

Os outros 76 testes NÃO pegaram isso, e o motivo é instrutivo: eles rodam dentro
de uma transação que sofre rollback no fim (para dar isolamento), e leem os dados
de dentro dessa mesma transação — que enxerga o que ainda não foi confirmado. O
teste concordava com o código, e os dois estavam errados.

A única forma de flagrar é a daqui: **gravar por uma conexão e ler por outra**.
Uma conexão diferente só enxerga o que foi de fato comitado.

Estes testes NÃO usam o fixture `session` do conftest, de propósito: a transação
aberta dele bloquearia o TRUNCATE da limpeza (que exige lock exclusivo), e a
suíte travaria.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.core.config import get_settings
from src.core.database import get_engine, get_session_factory
from src.core.security import BcryptPasswordHasher
from src.domain.catalog.enums import BodyType, FuelType, TransmissionType, VehicleStatus
from src.domain.identity.enums import UserRole
from src.infrastructure.database.models import (
    Appointment,
    Brand,
    Dealership,
    User,
    Vehicle,
    VehicleImage,
    VehicleModel,
)
from src.main import create_app

_TABLES = (
    "appointments, vehicle_features, vehicle_images, vehicles, "
    "refresh_tokens, users, vehicle_models, brands, features, dealerships"
)

SENHA = "senha-forte-de-teste"


@pytest.fixture
async def db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Fábrica de sessões REAIS, que comitam de verdade. Limpa tudo no final."""
    settings = get_settings()
    if not settings.test_database_url:
        pytest.skip("TEST_DATABASE_URL não configurada")

    engine = create_async_engine(settings.test_database_url, poolclass=NullPool)

    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {_TABLES} RESTART IDENTITY CASCADE"))

    yield async_sessionmaker(bind=engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {_TABLES} RESTART IDENTITY CASCADE"))
    await engine.dispose()


@pytest.fixture
async def client(
    db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[AsyncClient]:
    """Cliente que usa a dependência de sessão DE PRODUÇÃO, sem substituição.

    Este é o ponto do arquivo inteiro. A primeira versão deste fixture
    *reimplementava* a lógica de sessão (com commit) e a injetava via
    `dependency_overrides` — e com isso testava uma CÓPIA do código, não o código.
    Removi o commit de `core/database.py` para conferir, e os testes continuaram
    passando: estavam validando a cópia.

    Aqui não há override. Apenas apontamos o engine da aplicação para o banco de
    teste. O `get_session` exercitado é exatamente o que roda em produção — se
    alguém remover o commit dele, estes testes caem.
    """
    settings = get_settings()

    monkeypatch.setenv("DATABASE_URL", settings.test_database_url)
    for cached in (get_settings, get_engine, get_session_factory):
        cached.cache_clear()

    app = create_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    for cached in (get_settings, get_engine, get_session_factory):
        cached.cache_clear()


async def _fixtures(db: async_sessionmaker[AsyncSession]) -> dict[str, object]:
    """Dados de apoio, comitados — para que a API os enxergue de outra conexão."""
    async with db() as session:
        dealership = Dealership(name="Auto", slug="auto-p", city="São Paulo", state="SP")
        brand = Brand(name="Toyota", slug="toyota")
        session.add_all([dealership, brand])
        await session.flush()

        model = VehicleModel(brand_id=brand.id, name="Corolla", slug="corolla")
        admin = User(
            dealership_id=dealership.id,
            name="Admin",
            email="admin@persist.com",
            password_hash=BcryptPasswordHasher().hash(SENHA),
            role=UserRole.ADMIN,
        )
        session.add_all([model, admin])
        await session.flush()

        vehicle = Vehicle(
            dealership_id=dealership.id,
            brand_id=brand.id,
            model_id=model.id,
            brand_name="Toyota",
            model_name="Corolla",
            slug="corolla-persistencia",
            version="XEi",
            year_manufacture=2022,
            year_model=2023,
            price=Decimal("120000.00"),
            mileage=30000,
            fuel_type=FuelType.FLEX,
            transmission=TransmissionType.CVT,
            body_type=BodyType.SEDAN,
            color="Prata",
            city="São Paulo",
            state="SP",
            status=VehicleStatus.ACTIVE,
        )
        vehicle.images.append(
            VehicleImage(storage_path="p/1.jpg", url="https://x/1.jpg", position=0, is_cover=True)
        )
        session.add(vehicle)
        await session.commit()

        return {"brand_id": brand.id, "model_id": model.id}


async def _count(db: async_sessionmaker[AsyncSession], model: type) -> int:
    """Conta por uma conexão NOVA — só vê o que foi comitado."""
    async with db() as session:
        total = await session.scalar(select(func.count()).select_from(model))
        return int(total or 0)


async def test_agendamento_sobrevive_ao_fim_da_requisicao(
    client: AsyncClient, db: async_sessionmaker[AsyncSession]
) -> None:
    """O bug original: a API respondia 201 e o lead evaporava.

    Sem o commit na dependência de sessão, este teste falha — porque a leitura
    vem de outra conexão, que só enxerga dados confirmados.
    """
    await _fixtures(db)
    amanha = date.today() + timedelta(days=1)

    response = await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "corolla-persistencia",
            "customer_name": "Cliente Real",
            "phone": "11999998888",
            "email": "cliente@teste.com",
            "scheduled_date": amanha.isoformat(),
            "scheduled_time": "10:00:00",
        },
    )
    assert response.status_code == 201

    assert await _count(db, Appointment) == 1, (
        "o agendamento NÃO foi gravado: a API respondeu 201 e o lead foi perdido. "
        "Provavelmente falta o commit na dependência de sessão."
    )


async def test_requisicao_que_falha_nao_deixa_dados_pela_metade(
    client: AsyncClient, db: async_sessionmaker[AsyncSession]
) -> None:
    """A outra metade do contrato: se a requisição falha, NADA fica gravado."""
    await _fixtures(db)
    amanha = date.today() + timedelta(days=1)

    response = await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "corolla-persistencia",
            "customer_name": "Cliente",
            "phone": "11999998888",
            "email": "c@t.com",
            "scheduled_date": amanha.isoformat(),
            "scheduled_time": "03:00:00",  # fora do expediente — rejeitado
        },
    )
    assert response.status_code == 422

    assert await _count(db, Appointment) == 0, "a requisição falhou mas deixou dados no banco"


async def test_anuncio_criado_pelo_painel_persiste(
    client: AsyncClient, db: async_sessionmaker[AsyncSession]
) -> None:
    """Mesmo contrato na escrita administrativa.

    Um anúncio que a API diz ter criado e que some do banco é o pior bug possível
    para quem usa o painel: o trabalho evapora sem nenhuma mensagem de erro.
    """
    ids = await _fixtures(db)

    login = await client.post(
        "/api/v1/auth/login", json={"email": "admin@persist.com", "password": SENHA}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = await client.post(
        "/api/v1/admin/vehicles",
        json={
            "brand_id": str(ids["brand_id"]),
            "model_id": str(ids["model_id"]),
            "version": "GLi",
            "year_manufacture": 2023,
            "year_model": 2024,
            "price": "130000.00",
            "mileage": 15000,
            "fuel_type": "flex",
            "transmission": "automatic",
            "body_type": "sedan",
            "color": "Azul",
            "city": "São Paulo",
            "state": "SP",
        },
        headers=headers,
    )
    assert response.status_code == 201

    # 2 = o do fixture + o que acabamos de criar pela API.
    assert await _count(db, Vehicle) == 2, "o anúncio criado pelo painel não foi gravado"
