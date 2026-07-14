"""Testes da API administrativa e de agendamentos."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.ports import SignedUpload
from src.core.database import get_session
from src.core.security import BcryptPasswordHasher
from src.domain.catalog.enums import VehicleStatus
from src.domain.identity.enums import UserRole
from src.infrastructure.database.models import Brand, Dealership, Feature, User, VehicleModel
from src.main import create_app
from src.presentation.v1.deps import get_storage_service
from tests.conftest import VehicleFactory

ADMIN = "/api/v1/admin"
SENHA = "senha-de-teste-forte"


class FakeStorage:
    """Storage de mentira.

    Sem ele, cada teste de upload bateria na rede do Supabase: lento, dependente
    de internet, e — pior — deixaria arquivos de teste no bucket de produção.

    Isto só é possível porque o caso de uso depende da PORTA `StorageService`, e
    não da classe concreta. É o retorno prático da inversão de dependência.
    """

    def __init__(self) -> None:
        self.deleted: list[str] = []

    async def create_signed_upload(self, *, path: str) -> SignedUpload:
        return SignedUpload(
            upload_url=f"https://storage.fake/{path}",
            token="token-falso",
            storage_path=path,
            public_url=f"https://cdn.fake/{path}",
        )

    async def delete(self, *, path: str) -> bool:
        self.deleted.append(path)
        return True


@pytest.fixture
def storage() -> FakeStorage:
    return FakeStorage()


@pytest.fixture
async def client(session: AsyncSession, storage: FakeStorage):  # type: ignore[no-untyped-def]
    app = create_app()

    async def _session():  # type: ignore[no-untyped-def]
        yield session

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[get_storage_service] = lambda: storage

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


async def _make_user(session: AsyncSession, dealership: Dealership, role: UserRole) -> User:
    user = User(
        dealership_id=dealership.id,
        name=f"Usuário {role.value}",
        email=f"{role.value}@teste.com.br",
        password_hash=BcryptPasswordHasher().hash(SENHA),
        role=role,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def super_admin(session: AsyncSession, dealership: Dealership) -> User:
    return await _make_user(session, dealership, UserRole.SUPER_ADMIN)


@pytest.fixture
async def seller(session: AsyncSession, dealership: Dealership) -> User:
    return await _make_user(session, dealership, UserRole.SELLER)


async def _auth(client: AsyncClient, user: User) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": SENHA}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
async def catalogo(session: AsyncSession) -> dict[str, object]:
    brand = Brand(name="Toyota", slug="toyota")
    session.add(brand)
    await session.flush()

    model = VehicleModel(brand_id=brand.id, name="Corolla", slug="corolla")
    outra_marca = Brand(name="Honda", slug="honda")
    session.add_all([model, outra_marca])
    await session.flush()

    modelo_honda = VehicleModel(brand_id=outra_marca.id, name="Civic", slug="civic")
    session.add(modelo_honda)
    await session.flush()

    return {"brand": brand, "model": model, "honda": outra_marca, "civic": modelo_honda}


def _payload(catalogo: dict[str, object], **overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "brand_id": str(catalogo["brand"].id),  # type: ignore[attr-defined]
        "model_id": str(catalogo["model"].id),  # type: ignore[attr-defined]
        "version": "XEi 2.0",
        "year_manufacture": 2022,
        "year_model": 2023,
        "price": "120000.00",
        "mileage": 30000,
        "fuel_type": "flex",
        "transmission": "cvt",
        "body_type": "sedan",
        "color": "Prata",
        "city": "São Paulo",
        "state": "sp",
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------------- permissões


async def test_rotas_admin_exigem_autenticacao(client: AsyncClient) -> None:
    """Proteção declarada no router, não endpoint a endpoint.

    Assim uma rota nova nasce protegida — em vez de depender de alguém lembrar
    de colocar o decorator.
    """
    for url in (f"{ADMIN}/stats", f"{ADMIN}/vehicles", f"{ADMIN}/appointments"):
        assert (await client.get(url)).status_code == 401, f"{url} está desprotegida!"


async def test_vendedor_nao_acessa_area_admin(client: AsyncClient, seller: User) -> None:
    headers = await _auth(client, seller)

    response = await client.get(f"{ADMIN}/stats", headers=headers)

    assert response.status_code == 403


# ---------------------------------------------------------------------- criação


async def test_criar_anuncio_nasce_como_rascunho(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    headers = await _auth(client, super_admin)

    response = await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)
    body = response.json()

    assert response.status_code == 201
    assert body["status"] == "draft"
    assert body["title"] == "Toyota Corolla XEi 2.0"
    assert body["slug"] == "toyota-corolla-xei-2-0-2023"


async def test_dois_carros_iguais_geram_slugs_diferentes(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    """Concessionária tem carros iguais no estoque — a colisão de slug é rotina,
    não exceção. O slug é a URL pública: duplicado, quebraria o site."""
    headers = await _auth(client, super_admin)

    primeiro = await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)
    segundo = await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)

    assert primeiro.json()["slug"] != segundo.json()["slug"]


async def test_modelo_de_outra_marca_e_rejeitado(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    """Um "Toyota Civic" envenenaria a busca e ficaria incoerente no site."""
    headers = await _auth(client, super_admin)

    response = await client.post(
        f"{ADMIN}/vehicles",
        json=_payload(catalogo, model_id=str(catalogo["civic"].id)),  # type: ignore[attr-defined]
        headers=headers,
    )

    assert response.status_code == 422
    assert "não pertence à marca" in response.json()["error"]["message"]


async def test_ano_do_modelo_anterior_ao_de_fabricacao_e_rejeitado(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    headers = await _auth(client, super_admin)

    response = await client.post(
        f"{ADMIN}/vehicles",
        json=_payload(catalogo, year_manufacture=2023, year_model=2020),
        headers=headers,
    )

    assert response.status_code == 422


async def test_entrada_maior_que_o_preco_e_rejeitada(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    headers = await _auth(client, super_admin)

    response = await client.post(
        f"{ADMIN}/vehicles",
        json=_payload(catalogo, price="50000.00", down_payment="60000.00"),
        headers=headers,
    )

    assert response.status_code == 422


# ------------------------------------------------------------------ publicação


async def test_nao_publica_anuncio_sem_foto(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    """Um carro sem foto não vende: o card sai vazio na listagem e passa a
    impressão de site quebrado."""
    headers = await _auth(client, super_admin)
    vehicle_id = (
        await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)
    ).json()["id"]

    response = await client.patch(
        f"{ADMIN}/vehicles/{vehicle_id}/status", json={"status": "active"}, headers=headers
    )

    assert response.status_code == 422
    assert "foto" in response.json()["error"]["message"]


async def test_publica_com_foto_e_grava_published_at(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    headers = await _auth(client, super_admin)
    vehicle_id = (
        await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)
    ).json()["id"]

    await client.post(
        f"{ADMIN}/vehicles/{vehicle_id}/images",
        json={"storage_path": "v/1.jpg", "url": "https://cdn.fake/1.jpg"},
        headers=headers,
    )

    response = await client.patch(
        f"{ADMIN}/vehicles/{vehicle_id}/status", json={"status": "active"}, headers=headers
    )

    assert response.status_code == 200
    assert response.json()["status"] == "active"
    assert response.json()["published_at"] is not None


# ---------------------------------------------------------------------- fotos


async def test_primeira_foto_vira_capa_automaticamente(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    """Sem isto, o anúncio ficaria sem capa até alguém lembrar de escolher — e o
    card sairia sem imagem na listagem."""
    headers = await _auth(client, super_admin)
    vid = (await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)).json()[
        "id"
    ]

    primeira = await client.post(
        f"{ADMIN}/vehicles/{vid}/images",
        json={"storage_path": "v/1.jpg", "url": "https://cdn.fake/1.jpg"},
        headers=headers,
    )
    segunda = await client.post(
        f"{ADMIN}/vehicles/{vid}/images",
        json={"storage_path": "v/2.jpg", "url": "https://cdn.fake/2.jpg"},
        headers=headers,
    )

    assert primeira.json()["is_cover"] is True
    assert segunda.json()["is_cover"] is False


async def test_apagar_a_capa_promove_a_proxima_foto(
    client: AsyncClient,
    super_admin: User,
    catalogo: dict[str, object],
    dealership: Dealership,
    storage: FakeStorage,
) -> None:
    """Um anúncio publicado sem capa aparece sem foto na listagem. Ninguém clica
    num card vazio."""
    headers = await _auth(client, super_admin)
    vid = (await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)).json()[
        "id"
    ]

    capa = (
        await client.post(
            f"{ADMIN}/vehicles/{vid}/images",
            json={"storage_path": "v/1.jpg", "url": "https://cdn.fake/1.jpg"},
            headers=headers,
        )
    ).json()
    await client.post(
        f"{ADMIN}/vehicles/{vid}/images",
        json={"storage_path": "v/2.jpg", "url": "https://cdn.fake/2.jpg"},
        headers=headers,
    )

    await client.delete(f"{ADMIN}/images/{capa['id']}", headers=headers)

    detalhe = (await client.get(f"{ADMIN}/vehicles/{vid}", headers=headers)).json()

    assert len(detalhe["images"]) == 1
    assert detalhe["images"][0]["is_cover"] is True, "o anúncio ficou sem capa"
    # E o arquivo foi removido do Storage — nada de lixo acumulando.
    assert "v/1.jpg" in storage.deleted


async def test_upload_url_e_emitida_com_caminho_gerado_pelo_servidor(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    """O nome do arquivo é gerado por nós. Um nome vindo do cliente poderia
    conter `../` (path traversal) ou sobrescrever a foto de outro anúncio."""
    headers = await _auth(client, super_admin)
    vid = (await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)).json()[
        "id"
    ]

    response = await client.post(
        f"{ADMIN}/vehicles/{vid}/images/upload-url",
        json={"content_type": "image/jpeg"},
        headers=headers,
    )
    body = response.json()

    assert response.status_code == 200
    assert body["storage_path"].startswith(f"vehicles/{vid}/")
    assert body["storage_path"].endswith(".jpg")


async def test_formato_de_imagem_nao_suportado_e_rejeitado(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    headers = await _auth(client, super_admin)
    vid = (await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)).json()[
        "id"
    ]

    response = await client.post(
        f"{ADMIN}/vehicles/{vid}/images/upload-url",
        json={"content_type": "application/x-msdownload"},
        headers=headers,
    )

    assert response.status_code == 422


# ------------------------------------------------------------------- duplicação


async def test_duplicar_gera_rascunho_sem_fotos_e_sem_destaque(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    """As fotos NÃO são copiadas: elas mostram aquele carro específico —
    quilometragem no painel, arranhão no para-choque. Reaproveitá-las noutro
    veículo é enganar o comprador."""
    headers = await _auth(client, super_admin)
    original = (
        await client.post(
            f"{ADMIN}/vehicles", json=_payload(catalogo, is_featured=True), headers=headers
        )
    ).json()
    await client.post(
        f"{ADMIN}/vehicles/{original['id']}/images",
        json={"storage_path": "v/1.jpg", "url": "https://cdn.fake/1.jpg"},
        headers=headers,
    )
    await client.patch(
        f"{ADMIN}/vehicles/{original['id']}/status", json={"status": "active"}, headers=headers
    )

    copia = (
        await client.post(f"{ADMIN}/vehicles/{original['id']}/duplicate", headers=headers)
    ).json()

    assert copia["status"] == "draft", "a cópia foi publicada e duplicou o anúncio no site"
    assert copia["images"] == [], "as fotos do outro carro foram copiadas"
    assert copia["is_featured"] is False
    assert copia["slug"] != original["slug"]


# --------------------------------------------------------------------- exclusão


async def test_arquivar_tira_do_ar_mas_preserva(
    client: AsyncClient, super_admin: User, catalogo: dict[str, object], dealership: Dealership
) -> None:
    headers = await _auth(client, super_admin)
    vid = (await client.post(f"{ADMIN}/vehicles", json=_payload(catalogo), headers=headers)).json()[
        "id"
    ]

    response = await client.post(f"{ADMIN}/vehicles/{vid}/archive", headers=headers)

    assert response.json()["status"] == "archived"
    # Continua existindo para o admin.
    assert (await client.get(f"{ADMIN}/vehicles/{vid}", headers=headers)).status_code == 200


async def test_veiculo_com_agendamento_nao_pode_ser_excluido(
    client: AsyncClient,
    super_admin: User,
    vehicles: VehicleFactory,
    dealership: Dealership,
) -> None:
    """Apagar o veículo destruiria o histórico de quem se interessou por ele.
    O banco recusa (ondelete=RESTRICT) e a API traduz isso num 409 com instrução
    clara."""
    headers = await _auth(client, super_admin)
    vehicle = await vehicles.create(slug="com-lead")

    amanha = date.today() + timedelta(days=1)
    agendamento = await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "com-lead",
            "customer_name": "João da Silva",
            "phone": "(11) 99999-8888",
            "email": "joao@teste.com",
            "scheduled_date": amanha.isoformat(),
            "scheduled_time": "10:00:00",
        },
    )
    assert agendamento.status_code == 201

    response = await client.delete(f"{ADMIN}/vehicles/{vehicle.id}", headers=headers)

    assert response.status_code == 409
    assert "arquive" in response.json()["error"]["message"].lower()


# ----------------------------------------------------------------- agendamentos


async def test_agendar_visita(
    client: AsyncClient, vehicles: VehicleFactory, dealership: Dealership
) -> None:
    await vehicles.create(slug="corolla-2023")
    amanha = date.today() + timedelta(days=1)

    response = await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "corolla-2023",
            "customer_name": "Maria Souza",
            "phone": "(11) 98888-7777",
            "email": "maria@teste.com",
            "scheduled_date": amanha.isoformat(),
            "scheduled_time": "14:30:00",
        },
    )

    assert response.status_code == 201
    # A resposta NÃO ecoa e-mail nem telefone: o endpoint é público e viraria um
    # verificador de dados alheios.
    assert "email" not in response.json()
    assert "phone" not in response.json()


async def test_telefone_e_normalizado_para_so_digitos(
    client: AsyncClient, super_admin: User, vehicles: VehicleFactory, dealership: Dealership
) -> None:
    """O usuário digita "(11) 99999-8888"; o vendedor busca por "11999998888".
    Gravar a máscara faria os dois nunca se encontrarem — e quebraria o link do
    WhatsApp, que só aceita números."""
    await vehicles.create(slug="carro")
    amanha = date.today() + timedelta(days=1)

    await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "carro",
            "customer_name": "Maria",
            "phone": "(11) 99999-8888",
            "email": "m@t.com",
            "scheduled_date": amanha.isoformat(),
            "scheduled_time": "10:00:00",
        },
    )

    headers = await _auth(client, super_admin)
    lista = (await client.get(f"{ADMIN}/appointments", headers=headers)).json()

    assert lista["items"][0]["phone"] == "11999998888"


async def test_data_no_passado_e_rejeitada(
    client: AsyncClient, vehicles: VehicleFactory, dealership: Dealership
) -> None:
    await vehicles.create(slug="carro")
    ontem = date.today() - timedelta(days=1)

    response = await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "carro",
            "customer_name": "Maria",
            "phone": "11999998888",
            "email": "m@t.com",
            "scheduled_date": ontem.isoformat(),
            "scheduled_time": "10:00:00",
        },
    )

    assert response.status_code == 422
    assert "passado" in response.json()["error"]["message"]


async def test_horario_fora_do_expediente_e_rejeitado(
    client: AsyncClient, vehicles: VehicleFactory, dealership: Dealership
) -> None:
    """Um agendamento às 3 da manhã não é lead: é robô ou engano. Nos dois casos,
    vira uma visita que ninguém vai atender."""
    await vehicles.create(slug="carro")
    amanha = date.today() + timedelta(days=1)

    response = await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "carro",
            "customer_name": "Maria",
            "phone": "11999998888",
            "email": "m@t.com",
            "scheduled_date": amanha.isoformat(),
            "scheduled_time": "03:00:00",
        },
    )

    assert response.status_code == 422


async def test_nao_agenda_visita_para_anuncio_em_rascunho(
    client: AsyncClient, vehicles: VehicleFactory, dealership: Dealership
) -> None:
    """O cliente nem deveria ter visto esse anúncio."""
    await vehicles.create(slug="oculto", status=VehicleStatus.DRAFT)
    amanha = date.today() + timedelta(days=1)

    response = await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "oculto",
            "customer_name": "Maria",
            "phone": "11999998888",
            "email": "m@t.com",
            "scheduled_date": amanha.isoformat(),
            "scheduled_time": "10:00:00",
        },
    )

    assert response.status_code == 404


async def test_honeypot_finge_sucesso_e_nao_grava(
    client: AsyncClient, super_admin: User, vehicles: VehicleFactory, dealership: Dealership
) -> None:
    """Devolver erro ensinaria ao autor do robô o que ajustar. Fingir sucesso o
    deixa satisfeito com um spam que não chegou a lugar nenhum."""
    await vehicles.create(slug="carro")
    amanha = date.today() + timedelta(days=1)

    response = await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "carro",
            "customer_name": "Robô Spam",
            "phone": "11999998888",
            "email": "spam@bot.com",
            "scheduled_date": amanha.isoformat(),
            "scheduled_time": "10:00:00",
            "website": "http://spam.com",  # só um robô preenche este campo
        },
    )

    assert response.status_code == 201, "o robô precisa achar que deu certo"

    headers = await _auth(client, super_admin)
    lista = (await client.get(f"{ADMIN}/appointments", headers=headers)).json()
    assert lista["meta"]["total"] == 0, "o spam foi gravado no banco"


async def test_agendamento_finalizado_nao_muda_mais_de_status(
    client: AsyncClient, super_admin: User, vehicles: VehicleFactory, dealership: Dealership
) -> None:
    """Um agendamento concluído é histórico. Reabri-lo apagaria o registro do
    que realmente aconteceu no atendimento."""
    await vehicles.create(slug="carro")
    amanha = date.today() + timedelta(days=1)

    criado = await client.post(
        "/api/v1/appointments",
        json={
            "vehicle_slug": "carro",
            "customer_name": "Maria",
            "phone": "11999998888",
            "email": "m@t.com",
            "scheduled_date": amanha.isoformat(),
            "scheduled_time": "10:00:00",
        },
    )
    aid = criado.json()["id"]
    headers = await _auth(client, super_admin)

    await client.patch(
        f"{ADMIN}/appointments/{aid}/status", json={"status": "completed"}, headers=headers
    )
    reabrir = await client.patch(
        f"{ADMIN}/appointments/{aid}/status", json={"status": "pending"}, headers=headers
    )

    assert reabrir.status_code == 422


# ------------------------------------------------------------------- dashboard


async def test_dashboard(
    client: AsyncClient,
    super_admin: User,
    vehicles: VehicleFactory,
    features: dict[str, Feature],
    dealership: Dealership,
) -> None:
    await vehicles.create(slug="a", status=VehicleStatus.ACTIVE, price="100000.00")
    await vehicles.create(slug="b", status=VehicleStatus.ACTIVE, price="50000.00", is_featured=True)
    await vehicles.create(slug="c", status=VehicleStatus.SOLD, price="999999.00")
    await vehicles.create(slug="d", status=VehicleStatus.DRAFT, price="80000.00")

    headers = await _auth(client, super_admin)
    stats = (await client.get(f"{ADMIN}/stats", headers=headers)).json()

    assert stats["total_vehicles"] == 4
    assert stats["active_vehicles"] == 2
    assert stats["sold_vehicles"] == 1
    assert stats["draft_vehicles"] == 1
    assert stats["featured_vehicles"] == 1
    # Valor do estoque conta só o que está À VENDA. Somar o vendido (999.999)
    # inflaria o número e ele deixaria de significar qualquer coisa.
    assert stats["inventory_value"] == 150000.0
