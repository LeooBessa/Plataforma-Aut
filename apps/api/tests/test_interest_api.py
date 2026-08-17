"""Testes do interesse — quem quer ser avisado quando o carro certo chegar."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import BcryptPasswordHasher
from src.domain.catalog.enums import BodyType, VehicleStatus
from src.domain.identity.enums import UserRole
from src.infrastructure.database.models import Brand, Dealership, User, VehicleModel

PUBLICO = "/api/v1/interests"
ADMIN = "/api/v1/admin/interests"
CATALOGO = "/api/v1/catalog"
SENHA = "senha-de-teste-forte"


@pytest.fixture
async def admin(session: AsyncSession, dealership: Dealership) -> User:
    user = User(
        dealership_id=dealership.id,
        name="Admin",
        email="admin-interesse@teste.com.br",
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


async def _marca(session: AsyncSession, nome: str) -> Brand:
    marca = await session.scalar(select(Brand).where(Brand.name == nome))
    if marca is None:
        marca = Brand(name=nome, slug=nome.lower())
        session.add(marca)
        await session.flush()
    return marca


def _payload(marca_id: str, **overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "name": "Ana Souza",
        "phone": "(84) 99987-7293",
        "brand_id": marca_id,
        "max_price": "60000.00",
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------------- público


async def test_qualquer_pessoa_pode_pedir_aviso_sem_login(
    client: AsyncClient, session: AsyncSession
) -> None:
    marca = await _marca(session, "Fiat")

    response = await client.post(PUBLICO, json=_payload(str(marca.id)))

    assert response.status_code == 201
    assert response.json()["id"]


async def test_resposta_nao_ecoa_os_dados_enviados(
    client: AsyncClient, session: AsyncSession
) -> None:
    """A rota é pública: devolver o telefone a transformaria num verificador de
    dados alheios."""
    marca = await _marca(session, "Fiat")

    body = (await client.post(PUBLICO, json=_payload(str(marca.id)))).json()

    assert set(body) == {"id", "message"}


async def test_marca_inexistente_e_recusada(client: AsyncClient) -> None:
    """UUID inventado passaria pelo schema e viraria um pedido que nunca cruza
    com nada — um lead morto, sem erro visível."""
    response = await client.post(
        PUBLICO, json=_payload("00000000-0000-0000-0000-000000000000")
    )

    assert response.status_code == 422


async def test_modelo_de_outra_marca_e_recusado(
    client: AsyncClient, session: AsyncSession
) -> None:
    """"Fiat + Corolla" entraria e nunca encontraria nada."""
    fiat = await _marca(session, "Fiat")
    toyota = await _marca(session, "Toyota")
    corolla = VehicleModel(brand_id=toyota.id, name="Corolla", slug="corolla")
    session.add(corolla)
    await session.flush()

    response = await client.post(
        PUBLICO, json=_payload(str(fiat.id), model_id=str(corolla.id))
    )

    assert response.status_code == 422


@pytest.mark.parametrize("valor", ["0", "500"])
async def test_orcamento_baixo_demais_e_recusado(
    client: AsyncClient, session: AsyncSession, valor: str
) -> None:
    """Orçamento de R$ 500 casaria com QUALQUER carro no cruzamento, entupindo a
    fila do vendedor com falso positivo."""
    marca = await _marca(session, "Fiat")

    response = await client.post(PUBLICO, json=_payload(str(marca.id), max_price=valor))

    assert response.status_code == 422


async def test_honeypot_finge_sucesso_e_nao_grava(
    client: AsyncClient, session: AsyncSession, admin: User, dealership: Dealership
) -> None:
    marca = await _marca(session, "Fiat")

    response = await client.post(
        PUBLICO, json=_payload(str(marca.id), website="http://spam.com")
    )

    assert response.status_code == 201

    headers = await _auth(client, admin)
    assert (await client.get(ADMIN, headers=headers)).json()["meta"]["total"] == 0


async def test_catalogo_publico_traz_marca_sem_estoque(
    client: AsyncClient, session: AsyncSession
) -> None:
    """A diferença essencial para `/vehicles/filters`, que só mostra o que tem
    carro à venda.

    Quem procura uma Hilux justamente quando não há nenhuma é exatamente quem
    vale cadastrar — limitar ao pátio esvaziaria a funcionalidade.
    """
    await _marca(session, "Peugeot")  # nenhuma Peugeot no estoque

    marcas = (await client.get(CATALOGO)).json()

    assert "Peugeot" in [m["name"] for m in marcas]
    assert all("id" in m for m in marcas), "o formulário envia o id, não o nome"


# --------------------------------------------------------------------- admin


async def test_listagem_exige_autenticacao(client: AsyncClient) -> None:
    assert (await client.get(ADMIN)).status_code == 401


async def test_pedido_nasce_como_novo(
    client: AsyncClient, session: AsyncSession, admin: User, dealership: Dealership
) -> None:
    marca = await _marca(session, "Fiat")
    await client.post(PUBLICO, json=_payload(str(marca.id)))

    headers = await _auth(client, admin)
    itens = (await client.get(ADMIN, headers=headers)).json()["items"]

    assert itens[0]["status"] == "new"
    assert itens[0]["brand_name"] == "Fiat"


async def test_telefone_e_normalizado_para_digitos(
    client: AsyncClient, session: AsyncSession, admin: User, dealership: Dealership
) -> None:
    marca = await _marca(session, "Fiat")
    await client.post(PUBLICO, json=_payload(str(marca.id), phone="(84) 99987-7293"))

    headers = await _auth(client, admin)
    itens = (await client.get(ADMIN, headers=headers)).json()["items"]

    assert itens[0]["phone"] == "84999877293"


# ---------------------------------------------------------------- cruzamento


async def test_cruzamento_encontra_carro_compativel(
    client: AsyncClient, session: AsyncSession, admin: User, vehicles  # type: ignore[no-untyped-def]
) -> None:
    """O que dá sentido à tela: o pedido já chega com o carro que atende."""
    await vehicles.create(brand="Fiat", model="Argo", price="45000.00", body=BodyType.HATCH)
    marca = await _marca(session, "Fiat")

    await client.post(PUBLICO, json=_payload(str(marca.id), max_price="60000.00"))

    headers = await _auth(client, admin)
    item = (await client.get(ADMIN, headers=headers)).json()["items"][0]

    assert len(item["matches"]) == 1
    assert "Argo" in item["matches"][0]["title"]


async def test_cruzamento_respeita_o_orcamento(
    client: AsyncClient, session: AsyncSession, admin: User, vehicles  # type: ignore[no-untyped-def]
) -> None:
    """Carro acima do teto não é oportunidade, é frustração."""
    await vehicles.create(brand="Fiat", model="Toro", price="120000.00")
    marca = await _marca(session, "Fiat")

    await client.post(PUBLICO, json=_payload(str(marca.id), max_price="60000.00"))

    headers = await _auth(client, admin)
    assert (await client.get(ADMIN, headers=headers)).json()["items"][0]["matches"] == []


async def test_campo_vazio_no_pedido_nao_restringe(
    client: AsyncClient, session: AsyncSession, admin: User, vehicles  # type: ignore[no-untyped-def]
) -> None:
    """"Qualquer Fiat até 60 mil" é o pedido mais comum: sem modelo escolhido, o
    cruzamento aceita qualquer modelo da marca."""
    await vehicles.create(brand="Fiat", model="Argo", price="45000.00")
    await vehicles.create(brand="Fiat", model="Mobi", price="38000.00", slug="fiat-mobi-2023")
    marca = await _marca(session, "Fiat")

    await client.post(PUBLICO, json=_payload(str(marca.id), max_price="60000.00"))

    headers = await _auth(client, admin)
    item = (await client.get(ADMIN, headers=headers)).json()["items"][0]

    assert len(item["matches"]) == 2


async def test_categoria_escolhida_restringe(
    client: AsyncClient, session: AsyncSession, admin: User, vehicles  # type: ignore[no-untyped-def]
) -> None:
    await vehicles.create(brand="Fiat", model="Argo", price="45000.00", body=BodyType.HATCH)
    await vehicles.create(
        brand="Fiat", model="Toro", price="50000.00", body=BodyType.PICKUP, slug="fiat-toro-2023"
    )
    marca = await _marca(session, "Fiat")

    await client.post(
        PUBLICO, json=_payload(str(marca.id), max_price="60000.00", body_type="pickup")
    )

    headers = await _auth(client, admin)
    item = (await client.get(ADMIN, headers=headers)).json()["items"][0]

    assert len(item["matches"]) == 1
    assert "Toro" in item["matches"][0]["title"]


async def test_carro_fora_de_venda_nao_conta(
    client: AsyncClient, session: AsyncSession, admin: User, vehicles  # type: ignore[no-untyped-def]
) -> None:
    """Rascunho e vendido não são oportunidade — oferecer um deles queima o
    contato."""
    await vehicles.create(
        brand="Fiat", model="Argo", price="45000.00", status=VehicleStatus.SOLD
    )
    marca = await _marca(session, "Fiat")

    await client.post(PUBLICO, json=_payload(str(marca.id), max_price="60000.00"))

    headers = await _auth(client, admin)
    assert (await client.get(ADMIN, headers=headers)).json()["items"][0]["matches"] == []


async def test_filtro_mostra_so_quem_tem_carro_esperando(
    client: AsyncClient, session: AsyncSession, admin: User, vehicles  # type: ignore[no-untyped-def]
) -> None:
    """A fila do que dá para fazer HOJE."""
    await vehicles.create(brand="Fiat", model="Argo", price="45000.00")
    fiat = await _marca(session, "Fiat")
    honda = await _marca(session, "Honda")

    await client.post(PUBLICO, json=_payload(str(fiat.id), max_price="60000.00"))
    await client.post(PUBLICO, json=_payload(str(honda.id), max_price="60000.00"))

    headers = await _auth(client, admin)
    todos = (await client.get(ADMIN, headers=headers)).json()
    com_carro = (await client.get(f"{ADMIN}?matching=true", headers=headers)).json()

    assert todos["meta"]["total"] == 2
    assert com_carro["meta"]["total"] == 1
    assert com_carro["items"][0]["brand_name"] == "Fiat"


async def test_muda_o_status(
    client: AsyncClient, session: AsyncSession, admin: User, dealership: Dealership
) -> None:
    marca = await _marca(session, "Fiat")
    criado = (await client.post(PUBLICO, json=_payload(str(marca.id)))).json()
    headers = await _auth(client, admin)

    response = await client.patch(
        f"{ADMIN}/{criado['id']}/status", json={"status": "notified"}, headers=headers
    )

    assert response.status_code == 200
    assert response.json()["status"] == "notified"


async def test_status_de_pedido_inexistente_da_404(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    headers = await _auth(client, admin)

    response = await client.patch(
        f"{ADMIN}/00000000-0000-0000-0000-000000000000/status",
        json={"status": "notified"},
        headers=headers,
    )

    assert response.status_code == 404


async def test_modelo_escolhido_descarta_a_categoria(
    client: AsyncClient, session: AsyncSession, admin: User, vehicles  # type: ignore[no-untyped-def]
) -> None:
    """O par impossível não pode virar lead morto.

    O catálogo não guarda a categoria de cada modelo, então "RAM Rampage +
    Conversível" chega até aqui. A Rampage é picape: mantido o par, o cruzamento
    nunca acharia nada e o pedido ficaria parado para sempre.

    A categoria é descartada e o modelo prevalece — e o teste prova pelo efeito
    que importa: o carro certo ainda é encontrado.
    """
    await vehicles.create(
        brand="Fiat", model="Toro", price="90000.00", body=BodyType.PICKUP
    )
    fiat = await _marca(session, "Fiat")
    toro = await session.scalar(
        select(VehicleModel).where(
            VehicleModel.brand_id == fiat.id, VehicleModel.name == "Toro"
        )
    )
    assert toro is not None

    await client.post(
        PUBLICO,
        json=_payload(
            str(fiat.id),
            model_id=str(toro.id),
            body_type="convertible",  # contradiz o modelo
            max_price="100000.00",
        ),
    )

    headers = await _auth(client, admin)
    item = (await client.get(ADMIN, headers=headers)).json()["items"][0]

    assert item["body_type"] is None, "a categoria contraditória devia ter sido descartada"
    assert len(item["matches"]) == 1, "com ela mantida, o cruzamento não acharia nada"
