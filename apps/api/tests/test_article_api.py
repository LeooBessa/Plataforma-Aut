"""Testes dos artigos — o conteúdo que a loja escreve pelo painel."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import BcryptPasswordHasher
from src.domain.identity.enums import UserRole
from src.infrastructure.database.models import Dealership, User

PUBLICO = "/api/v1/articles"
ADMIN = "/api/v1/admin/articles"
SENHA = "senha-de-teste-forte"
CAPA = "https://exemplo.supabase.co/storage/v1/object/public/vehicles/articles/x.jpg"


@pytest.fixture
async def admin(session: AsyncSession, dealership: Dealership) -> User:
    user = User(
        dealership_id=dealership.id,
        name="Admin",
        email="admin-artigo@teste.com.br",
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
        "title": "Vale a pena comprar seminovo?",
        "excerpt": "O que olhar antes de fechar negócio com um carro usado.",
        "body": "Comprar seminovo economiza.\n\n## O que conferir\n\n- Documentação\n- Revisões",
        "status": "draft",
    }
    base.update(over)
    return base


# --------------------------------------------------------------------- admin


async def test_criar_exige_autenticacao(client: AsyncClient) -> None:
    assert (await client.post(ADMIN, json=_payload())).status_code == 401


async def test_cria_rascunho(client: AsyncClient, admin: User, dealership: Dealership) -> None:
    headers = await _auth(client, admin)

    r = await client.post(ADMIN, json=_payload(), headers=headers)

    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "draft"
    assert body["slug"] == "vale-a-pena-comprar-seminovo"
    assert body["published_at"] is None


async def test_publicar_sem_capa_e_recusado(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    """O cartão da listagem fica com um buraco cinzento. Melhor barrar aqui do
    que descobrir no site."""
    headers = await _auth(client, admin)

    r = await client.post(ADMIN, json=_payload(status="published"), headers=headers)

    assert r.status_code == 422


async def test_publicar_com_capa_carimba_a_data(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    headers = await _auth(client, admin)

    r = await client.post(
        ADMIN, json=_payload(status="published", cover_url=CAPA), headers=headers
    )

    assert r.status_code == 201
    assert r.json()["published_at"] is not None


async def test_slug_repetido_ganha_sufixo(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    """Dois artigos podem ter o mesmo título em anos diferentes. Recusar faria a
    loja perder o texto por um detalhe de endereço."""
    headers = await _auth(client, admin)

    a = (await client.post(ADMIN, json=_payload(), headers=headers)).json()
    b = (await client.post(ADMIN, json=_payload(), headers=headers)).json()

    assert a["slug"] == "vale-a-pena-comprar-seminovo"
    assert b["slug"] == "vale-a-pena-comprar-seminovo-2"


async def test_slug_nao_muda_ao_editar_o_titulo(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    """Endereço já compartilhado no WhatsApp não pode quebrar por causa de uma
    correção de digitação — e o Google perderia o que indexou."""
    headers = await _auth(client, admin)
    criado = (await client.post(ADMIN, json=_payload(), headers=headers)).json()

    editado = (
        await client.put(
            f"{ADMIN}/{criado['id']}",
            json=_payload(title="Vale mesmo a pena comprar seminovo?"),
            headers=headers,
        )
    ).json()

    assert editado["title"] == "Vale mesmo a pena comprar seminovo?"
    assert editado["slug"] == criado["slug"]


async def test_tempo_de_leitura_e_calculado(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    headers = await _auth(client, admin)
    texto = " ".join(["palavra"] * 1000)

    r = await client.post(ADMIN, json=_payload(body=texto), headers=headers)

    assert r.json()["reading_minutes"] == 5


async def test_faq_sem_resposta_e_recusado(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    headers = await _auth(client, admin)

    r = await client.post(
        ADMIN,
        json=_payload(faq=[{"question": "Aceita troca?", "answer": "   "}]),
        headers=headers,
    )

    assert r.status_code == 422


async def test_exclui(client: AsyncClient, admin: User, dealership: Dealership) -> None:
    headers = await _auth(client, admin)
    criado = (await client.post(ADMIN, json=_payload(), headers=headers)).json()

    r = await client.delete(f"{ADMIN}/{criado['id']}", headers=headers)

    assert r.status_code == 204
    assert (await client.get(f"{ADMIN}/{criado['id']}", headers=headers)).status_code == 404


# ------------------------------------------------------------------- público


async def test_rascunho_nao_aparece_no_site(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    """Devolver "não publicado" contaria que o endereço existe. 404 é a resposta
    correta: para o site, o rascunho não existe."""
    headers = await _auth(client, admin)
    criado = (await client.post(ADMIN, json=_payload(), headers=headers)).json()

    assert (await client.get(f"{PUBLICO}/{criado['slug']}")).status_code == 404
    assert (await client.get(PUBLICO)).json()["meta"]["total"] == 0


async def test_publicado_aparece_no_site(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    headers = await _auth(client, admin)
    criado = (
        await client.post(ADMIN, json=_payload(status="published", cover_url=CAPA), headers=headers)
    ).json()

    lista = (await client.get(PUBLICO)).json()
    detalhe = (await client.get(f"{PUBLICO}/{criado['slug']}")).json()

    assert lista["meta"]["total"] == 1
    assert detalhe["article"]["title"] == "Vale a pena comprar seminovo?"
    assert "## O que conferir" in detalhe["article"]["body"], "o corpo vai em markdown cru"


async def test_leia_tambem_nao_repete_o_artigo_aberto(
    client: AsyncClient, admin: User, dealership: Dealership
) -> None:
    headers = await _auth(client, admin)
    for i in range(3):
        await client.post(
            ADMIN,
            json=_payload(title=f"Artigo {i}", status="published", cover_url=CAPA),
            headers=headers,
        )

    detalhe = (await client.get(f"{PUBLICO}/artigo-1")).json()

    slugs = [a["slug"] for a in detalhe["related"]]
    assert "artigo-1" not in slugs
    assert len(slugs) == 2


# ------------------------------------------------------- destaque na home


async def _publicado(client: AsyncClient, headers: dict[str, str], titulo: str) -> dict:
    r = await client.post(
        ADMIN,
        json=_payload(title=titulo, status="published", cover_url=CAPA, cover_path="a/b.jpg"),
        headers=headers,
    )
    return r.json()


async def test_sem_destaque_a_rota_devolve_vazio(client: AsyncClient) -> None:
    """Estado normal do site: `null`, não erro. O topo fica com a foto padrão."""
    r = await client.get(f"{PUBLICO}/featured")
    assert r.status_code == 200
    assert r.json() is None


async def test_destacar_coloca_o_artigo_no_topo(client: AsyncClient, admin: User) -> None:
    headers = await _auth(client, admin)
    artigo = await _publicado(client, headers, "Como escolher um seminovo")

    await client.put(
        f"{ADMIN}/{artigo['id']}",
        json=_payload(
            title=artigo["title"],
            status="published",
            cover_url=CAPA,
            cover_path="a/b.jpg",
            featured=True,
        ),
        headers=headers,
    )

    destaque = (await client.get(f"{PUBLICO}/featured")).json()
    assert destaque is not None
    assert destaque["slug"] == artigo["slug"]
    assert destaque["cover_url"] == CAPA


async def test_destacar_um_desmarca_o_outro(client: AsyncClient, admin: User) -> None:
    """O topo da home é um espaço só.

    Sem esta regra, dois artigos apareceriam marcados no painel para um único
    lugar no site, e qual dos dois aparece viraria sorteio.
    """
    headers = await _auth(client, admin)
    primeiro = await _publicado(client, headers, "Primeiro artigo")
    segundo = await _publicado(client, headers, "Segundo artigo")

    for artigo in (primeiro, segundo):
        await client.put(
            f"{ADMIN}/{artigo['id']}",
            json=_payload(
                title=artigo["title"],
                status="published",
                cover_url=CAPA,
                cover_path="a/b.jpg",
                featured=True,
            ),
            headers=headers,
        )

    destaque = (await client.get(f"{PUBLICO}/featured")).json()
    assert destaque["slug"] == segundo["slug"]

    anterior = (await client.get(f"{ADMIN}/{primeiro['id']}", headers=headers)).json()
    assert anterior["featured"] is False


async def test_nao_da_para_destacar_rascunho(client: AsyncClient, admin: User) -> None:
    """Destacar rascunho poria no topo uma capa que leva a página inexistente."""
    headers = await _auth(client, admin)
    r = await client.post(
        ADMIN,
        json=_payload(status="draft", cover_url=CAPA, cover_path="a/b.jpg", featured=True),
        headers=headers,
    )
    assert r.status_code == 422


async def test_despublicar_o_destaque_limpa_o_topo(client: AsyncClient, admin: User) -> None:
    """O site se protege sozinho.

    Se despublicar deixasse o destaque de pé, o topo da home apontaria para uma
    página que passou a devolver 404.
    """
    headers = await _auth(client, admin)
    artigo = await _publicado(client, headers, "Vai sair do ar")
    corpo = _payload(
        title=artigo["title"], status="published", cover_url=CAPA, cover_path="a/b.jpg"
    )
    await client.put(f"{ADMIN}/{artigo['id']}", json={**corpo, "featured": True}, headers=headers)
    assert (await client.get(f"{PUBLICO}/featured")).json() is not None

    await client.put(
        f"{ADMIN}/{artigo['id']}",
        json={**corpo, "status": "draft", "featured": False},
        headers=headers,
    )
    assert (await client.get(f"{PUBLICO}/featured")).json() is None
