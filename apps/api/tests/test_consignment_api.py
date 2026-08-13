"""Testes da consignação — o pedido de quem quer anunciar o carro."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_session
from src.core.security import BcryptPasswordHasher
from src.domain.identity.enums import UserRole
from src.infrastructure.database.models import ConsignmentRequest as ConsignmentModel
from src.infrastructure.database.models import Dealership, User
from src.main import create_app

PUBLICO = "/api/v1/consignments"
ADMIN = "/api/v1/admin/consignments"
SENHA = "senha-de-teste-forte"


@pytest.fixture
async def client(session: AsyncSession):  # type: ignore[no-untyped-def]
    app = create_app()

    async def _session():  # type: ignore[no-untyped-def]
        yield session

    app.dependency_overrides[get_session] = _session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def admin(session: AsyncSession, dealership: Dealership) -> User:
    user = User(
        dealership_id=dealership.id,
        name="Admin",
        email="admin-consig@teste.com.br",
        password_hash=BcryptPasswordHasher().hash(SENHA),
        role=UserRole.SUPER_ADMIN,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _auth(client: AsyncClient, user: User) -> dict[str, str]:
    r = await client.post("/api/v1/auth/login", json={"email": user.email, "password": SENHA})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "owner_name": "Marcos Silva",
        "phone": "(84) 99987-7293",
        "vehicle": "Fiat Toro Freedom 1.8",
        "year": 2021,
        "mileage": 48000,
        "asking_price": "92000.00",
        "city": "Natal",
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------------- público


async def test_qualquer_pessoa_pode_enviar_sem_login(client: AsyncClient) -> None:
    """Sem cadastro, de propósito.

    Exigir conta para dizer "tenho um carro para vender" derruba a conversão a
    quase zero — e o carro do vizinho vai para a loja concorrente.
    """
    response = await client.post(PUBLICO, json=_payload())

    assert response.status_code == 201
    assert response.json()["id"]


async def test_resposta_nao_ecoa_os_dados_enviados(client: AsyncClient) -> None:
    """O endpoint é público: devolver o telefone o transformaria num
    verificador de dados alheios."""
    body = (await client.post(PUBLICO, json=_payload())).json()

    assert set(body) == {"id", "message"}


async def test_telefone_e_normalizado_para_digitos(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    """A máscara vai embora: quem busca no painel digita só números, e o link de
    WhatsApp exige dígitos."""
    await client.post(PUBLICO, json=_payload(phone="(84) 99987-7293"))

    headers = await _auth(client, admin)
    itens = (await client.get(ADMIN, headers=headers)).json()["items"]

    assert itens[0]["phone"] == "84999877293"


async def test_telefone_invalido_e_recusado(client: AsyncClient) -> None:
    response = await client.post(PUBLICO, json=_payload(phone="123"))

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("year", 1900),  # anterior ao mínimo
        ("year", 2200),  # futuro demais
        ("mileage", -1),
        ("asking_price", "0"),
    ],
)
async def test_valores_absurdos_sao_recusados(
    client: AsyncClient, campo: str, valor: object
) -> None:
    """Preço zero e ano 1900 chegam de dedo errado, não de má-fé — mas viram
    lead inútil se entrarem."""
    response = await client.post(PUBLICO, json=_payload(**{campo: valor}))

    assert response.status_code == 422


async def test_honeypot_finge_sucesso_e_nao_grava(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    """Devolver erro ensinaria ao autor do robô o que ajustar. Fingir sucesso o
    deixa satisfeito com um spam que não chegou a lugar nenhum."""
    response = await client.post(PUBLICO, json=_payload(website="http://spam.com"))

    assert response.status_code == 201

    headers = await _auth(client, admin)
    assert (await client.get(ADMIN, headers=headers)).json()["meta"]["total"] == 0


# --------------------------------------------------------------------- admin


async def test_listagem_exige_autenticacao(client: AsyncClient) -> None:
    assert (await client.get(ADMIN)).status_code == 401


async def test_pedido_nasce_como_novo(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    await client.post(PUBLICO, json=_payload())

    headers = await _auth(client, admin)
    itens = (await client.get(ADMIN, headers=headers)).json()["items"]

    assert itens[0]["status"] == "new"
    assert itens[0]["vehicle"] == "Fiat Toro Freedom 1.8"


async def test_mais_recentes_aparecem_primeiro(
    client: AsyncClient, admin: User, dealership: Dealership, session: AsyncSession
) -> None:
    """Oposto do agendamento, que ordena pela visita mais próxima.

    Quem quer vender o carro está falando com outras lojas ao mesmo tempo: o
    pedido que acabou de chegar é o que ainda dá para ganhar.

    O `created_at` do primeiro é EMPURRADO PARA TRÁS à mão, e sem isso o teste
    passa a falhar de forma intermitente: no Postgres, `now()` devolve o horário
    de início da TRANSAÇÃO, não do comando. Os dois pedidos nascem na mesma
    transação do teste e recebem timestamps idênticos — o `ORDER BY created_at`
    empata e o desempate por id é aleatório.

    Em produção não acontece, porque cada requisição é a sua própria transação.
    """
    primeiro = (await client.post(PUBLICO, json=_payload(vehicle="Primeiro carro"))).json()
    await client.post(PUBLICO, json=_payload(vehicle="Segundo carro"))

    await session.execute(
        update(ConsignmentModel)
        .where(ConsignmentModel.id == UUID(primeiro["id"]))
        .values(created_at=datetime.now(UTC) - timedelta(hours=1))
    )

    headers = await _auth(client, admin)
    itens = (await client.get(ADMIN, headers=headers)).json()["items"]

    assert [i["vehicle"] for i in itens] == ["Segundo carro", "Primeiro carro"]


async def test_busca_encontra_por_dono_e_por_carro(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    """Uma busca sobre os dois campos: o vendedor digita 'Toro' ou 'Marcos' sem
    parar para pensar em qual coluna aquilo é."""
    await client.post(PUBLICO, json=_payload(owner_name="Marcos Silva", vehicle="Fiat Toro"))
    await client.post(PUBLICO, json=_payload(owner_name="Ana Souza", vehicle="Jeep Renegade"))

    headers = await _auth(client, admin)

    por_dono = (await client.get(f"{ADMIN}?q=marcos", headers=headers)).json()
    por_carro = (await client.get(f"{ADMIN}?q=renegade", headers=headers)).json()

    assert por_dono["meta"]["total"] == 1
    assert por_dono["items"][0]["owner_name"] == "Marcos Silva"
    assert por_carro["meta"]["total"] == 1
    assert por_carro["items"][0]["vehicle"] == "Jeep Renegade"


async def test_muda_o_status(client: AsyncClient, admin: User, dealership: Dealership) -> None:
    criado = (await client.post(PUBLICO, json=_payload())).json()
    headers = await _auth(client, admin)

    response = await client.patch(
        f"{ADMIN}/{criado['id']}/status", json={"status": "published"}, headers=headers
    )

    assert response.status_code == 200
    assert response.json()["status"] == "published"


async def test_filtra_por_status(client: AsyncClient, admin: User, dealership: Dealership) -> None:
    a = (await client.post(PUBLICO, json=_payload(vehicle="Carro A"))).json()
    await client.post(PUBLICO, json=_payload(vehicle="Carro B"))
    headers = await _auth(client, admin)

    await client.patch(f"{ADMIN}/{a['id']}/status", json={"status": "declined"}, headers=headers)
    resultado = (await client.get(f"{ADMIN}?status=new", headers=headers)).json()

    assert resultado["meta"]["total"] == 1
    assert resultado["items"][0]["vehicle"] == "Carro B"


async def test_status_de_pedido_inexistente_da_404(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    headers = await _auth(client, admin)

    response = await client.patch(
        f"{ADMIN}/00000000-0000-0000-0000-000000000000/status",
        json={"status": "contacted"},
        headers=headers,
    )

    assert response.status_code == 404
