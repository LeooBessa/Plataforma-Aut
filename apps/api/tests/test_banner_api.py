"""Testes do banner do topo da home."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import BcryptPasswordHasher
from src.domain.identity.enums import UserRole
from src.infrastructure.database.models import Dealership, User

PUBLICO = "/api/v1/banner"
ADMIN = "/api/v1/admin/banner"
SENHA = "senha-de-teste-forte"
IMAGEM = "https://exemplo.supabase.co/storage/v1/object/public/vehicles/banners/x.jpg"


@pytest.fixture
async def admin(session: AsyncSession, dealership: Dealership) -> User:
    user = User(
        dealership_id=dealership.id,
        name="Admin",
        email="admin-banner@teste.com.br",
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


def _payload(**over: object) -> dict[str, object]:
    base: dict[str, object] = {
        "image_url": IMAGEM,
        "image_path": "banners/x.jpg",
        "alt": "Feirão de julho: taxa zero até domingo",
        "active": True,
    }
    base.update(over)
    return base


# ------------------------------------------------------------------- público


async def test_sem_banner_a_rota_publica_devolve_vazio(client: AsyncClient) -> None:
    """Estado normal do site: `null`, não erro.

    A home cai na foto de vitrine padrão. Se isto virasse 404, o topo do site
    quebraria enquanto a loja não subisse nenhum banner.
    """
    r = await client.get(PUBLICO)
    assert r.status_code == 200
    assert r.json() is None


async def test_banner_desligado_nao_aparece_no_site(client: AsyncClient, admin: User) -> None:
    headers = await _auth(client, admin)
    await client.put(ADMIN, json=_payload(active=False), headers=headers)

    r = await client.get(PUBLICO)
    assert r.json() is None


async def test_banner_ligado_aparece_no_site(client: AsyncClient, admin: User) -> None:
    headers = await _auth(client, admin)
    await client.put(ADMIN, json=_payload(), headers=headers)

    r = await client.get(PUBLICO)
    corpo = r.json()
    assert corpo is not None
    assert corpo["image_url"] == IMAGEM
    assert corpo["alt"] == "Feirão de julho: taxa zero até domingo"


# --------------------------------------------------------------------- admin


async def test_gravar_exige_autenticacao(client: AsyncClient) -> None:
    r = await client.put(ADMIN, json=_payload())
    assert r.status_code in (401, 403)


async def test_gravar_duas_vezes_nao_cria_dois_banners(
    client: AsyncClient, admin: User
) -> None:
    """A loja troca a imagem; ela não acumula banners.

    Se cada gravação criasse uma linha, o site passaria a escolher entre várias
    e a tela do painel mostraria uma imagem enquanto o site mostra outra.
    """
    headers = await _auth(client, admin)
    primeiro = await client.put(ADMIN, json=_payload(alt="Primeiro"), headers=headers)
    segundo = await client.put(ADMIN, json=_payload(alt="Segundo"), headers=headers)

    assert primeiro.json()["id"] == segundo.json()["id"]

    publico = await client.get(PUBLICO)
    assert publico.json()["alt"] == "Segundo"


async def test_desligar_preserva_a_imagem_no_painel(client: AsyncClient, admin: User) -> None:
    """Desligar tira do site, mas a tela de edição continua mostrando a imagem.

    É o que permite religar sem subir tudo de novo.
    """
    headers = await _auth(client, admin)
    await client.put(ADMIN, json=_payload(), headers=headers)
    await client.put(ADMIN, json=_payload(active=False), headers=headers)

    assert (await client.get(PUBLICO)).json() is None

    painel = await client.get(ADMIN, headers=headers)
    assert painel.json()["image_url"] == IMAGEM
    assert painel.json()["active"] is False


async def test_descricao_vazia_e_recusada(client: AsyncClient, admin: User) -> None:
    """`alt` obrigatório: a promoção costuma estar escrita dentro da imagem."""
    headers = await _auth(client, admin)
    r = await client.put(ADMIN, json=_payload(alt="   "), headers=headers)
    assert r.status_code == 422


async def test_link_com_javascript_e_recusado(client: AsyncClient, admin: User) -> None:
    """`javascript:` gravado aqui viraria execução de script na home."""
    headers = await _auth(client, admin)
    r = await client.put(
        ADMIN, json=_payload(link_url="javascript:alert(1)"), headers=headers
    )
    assert r.status_code == 422


async def test_link_interno_e_aceito(client: AsyncClient, admin: User) -> None:
    headers = await _auth(client, admin)
    r = await client.put(ADMIN, json=_payload(link_url="/veiculos"), headers=headers)
    assert r.status_code == 200
    assert r.json()["link_url"] == "/veiculos"


async def test_remover_devolve_o_topo_ao_padrao(client: AsyncClient, admin: User) -> None:
    headers = await _auth(client, admin)
    await client.put(ADMIN, json=_payload(), headers=headers)

    r = await client.delete(ADMIN, headers=headers)
    assert r.status_code == 204

    assert (await client.get(PUBLICO)).json() is None
    assert (await client.get(ADMIN, headers=headers)).json() is None


async def test_remover_sem_banner_devolve_404(client: AsyncClient, admin: User) -> None:
    headers = await _auth(client, admin)
    r = await client.delete(ADMIN, headers=headers)
    assert r.status_code == 404
