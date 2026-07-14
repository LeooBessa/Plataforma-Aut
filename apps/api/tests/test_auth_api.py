"""Testes de autenticação.

Cada teste aqui corresponde a um ataque concreto. Um login que "funciona" é
fácil; o que separa um sistema de produção de um brinquedo é o que ele faz
quando alguém está tentando invadi-lo.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import BcryptPasswordHasher
from src.core.tokens import create_access_token
from src.domain.identity.enums import UserRole
from src.infrastructure.database.models import Dealership, User

AUTH = "/api/v1/auth"
SENHA = "senha-de-teste-forte"


@pytest.fixture
async def admin(session: AsyncSession, dealership: Dealership) -> User:
    user = User(
        dealership_id=dealership.id,
        name="Administrador",
        email="admin@teste.com.br",
        password_hash=BcryptPasswordHasher().hash(SENHA),
        role=UserRole.ADMIN,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _login(client: AsyncClient, email: str = "admin@teste.com.br", senha: str = SENHA):
    return await client.post(f"{AUTH}/login", json={"email": email, "password": senha})


# ----------------------------------------------------------------------- login


async def test_login_com_credenciais_validas(client: AsyncClient, admin: User) -> None:
    response = await _login(client)
    body = response.json()

    assert response.status_code == 200
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "admin@teste.com.br"
    assert body["expires_in"] == 900  # 15 minutos


async def test_refresh_token_vai_no_cookie_httponly_e_nao_no_corpo(
    client: AsyncClient, admin: User
) -> None:
    """O refresh vale 7 dias. Se o JavaScript o alcançasse, um XSS levaria a
    sessão inteira. Ele tem que estar FORA do corpo e dentro de um cookie
    httpOnly."""
    response = await _login(client)

    assert "refresh_token" not in response.json(), "refresh token vazou no corpo da resposta"

    cookie = response.headers.get("set-cookie", "").lower()
    assert "refresh_token=" in cookie
    assert "httponly" in cookie, "cookie legível por JavaScript — um XSS roubaria a sessão"
    assert "samesite=lax" in cookie, "cookie sem proteção contra CSRF"
    assert "path=/api/v1/auth" in cookie, "cookie trafegando em rotas que não precisam dele"


async def test_senha_errada_e_rejeitada(client: AsyncClient, admin: User) -> None:
    response = await _login(client, senha="senha-errada-mesmo")

    assert response.status_code == 401


async def test_usuario_inexistente_e_senha_errada_dao_a_MESMA_resposta(  # noqa: N802
    client: AsyncClient, admin: User
) -> None:
    """Enumeração de usuários.

    Se "e-mail não existe" e "senha errada" tivessem respostas diferentes, um
    atacante descobriria QUAIS e-mails têm conta sem acertar senha nenhuma — e
    aí concentraria o ataque só neles.
    """
    inexistente = await _login(client, email="ninguem@teste.com.br")
    senha_errada = await _login(client, senha="outra-senha-qualquer")

    assert inexistente.status_code == senha_errada.status_code == 401
    assert inexistente.json()["error"]["message"] == senha_errada.json()["error"]["message"]


async def test_usuario_desativado_nao_entra_e_nao_se_denuncia(
    client: AsyncClient, session: AsyncSession, admin: User
) -> None:
    """A conta desativada devolve a MESMA mensagem de credencial inválida.

    Dizer "sua conta está desativada" confirmaria ao atacante que ele acertou
    e-mail e senha.
    """
    admin.is_active = False
    await session.flush()

    response = await _login(client)

    assert response.status_code == 401
    assert response.json()["error"]["message"] == "E-mail ou senha inválidos."


async def test_email_e_normalizado(client: AsyncClient, admin: User) -> None:
    """Sem normalizar, "Admin@X.com" e "admin@x.com" seriam contas diferentes —
    e o usuário juraria que a senha parou de funcionar."""
    response = await _login(client, email="  ADMIN@Teste.COM.BR  ")

    assert response.status_code == 200


async def test_senha_curta_e_rejeitada_na_validacao(client: AsyncClient) -> None:
    response = await client.post(f"{AUTH}/login", json={"email": "a@b.com", "password": "123"})

    assert response.status_code == 422


# ------------------------------------------------------------- rotas protegidas


async def test_rota_protegida_sem_token_devolve_401(client: AsyncClient) -> None:
    response = await client.get(f"{AUTH}/me")

    assert response.status_code == 401


async def test_rota_protegida_com_token_valido(client: AsyncClient, admin: User) -> None:
    token = (await _login(client)).json()["access_token"]

    response = await client.get(f"{AUTH}/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "admin@teste.com.br"


async def test_token_forjado_e_rejeitado(client: AsyncClient, admin: User) -> None:
    """Assinatura inválida: o token foi montado por quem não tem o segredo."""
    valido = (await _login(client)).json()["access_token"]
    forjado = valido[:-6] + "aaaaaa"

    response = await client.get(f"{AUTH}/me", headers={"Authorization": f"Bearer {forjado}"})

    assert response.status_code == 401


async def test_token_de_usuario_desativado_para_de_valer_imediatamente(
    client: AsyncClient, session: AsyncSession, admin: User
) -> None:
    """O usuário é relido do banco a cada requisição, e não reconstruído do JWT.

    Sem isso, um funcionário demitido continuaria com acesso total até o token
    expirar — e não haveria como cortá-lo antes disso.
    """
    token = (await _login(client)).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert (await client.get(f"{AUTH}/me", headers=headers)).status_code == 200

    admin.is_active = False
    await session.flush()

    # MESMO token, ainda dentro da validade.
    assert (await client.get(f"{AUTH}/me", headers=headers)).status_code == 401


async def test_token_de_usuario_que_nao_existe_e_rejeitado(client: AsyncClient) -> None:
    """Token com assinatura VÁLIDA, mas apontando para um usuário que não existe.

    Acontece de verdade quando um usuário é apagado com a sessão aberta.
    """
    import uuid

    token = create_access_token(uuid.uuid4(), UserRole.ADMIN, None)

    response = await client.get(f"{AUTH}/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


# -------------------------------------------------------------------- refresh


async def test_refresh_renova_a_sessao(client: AsyncClient, admin: User) -> None:
    await _login(client)  # o cookie fica guardado no client

    response = await client.post(f"{AUTH}/refresh")

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "admin@teste.com.br"


async def test_refresh_rotaciona_o_token(client: AsyncClient, admin: User) -> None:
    """Cada renovação queima o token usado e emite outro. É essa rotação que
    torna possível detectar roubo mais tarde."""
    await _login(client)
    primeiro = client.cookies.get("refresh_token")

    await client.post(f"{AUTH}/refresh")
    segundo = client.cookies.get("refresh_token")

    assert primeiro != segundo, "o refresh token não foi rotacionado"


async def test_reuso_de_refresh_token_derruba_TODAS_as_sessoes(  # noqa: N802
    client: AsyncClient, admin: User
) -> None:
    """Detecção de reuso — a defesa mais importante deste arquivo.

    Cenário real: um atacante rouba o refresh token da vítima. A vítima usa o
    dela e o rotaciona; o token do atacante fica queimado. Quando o atacante
    tenta usar o token roubado, ele reaparece já revogado.

    Nesse instante só há duas explicações — roubo ou replicação — e a resposta
    correta para ambas é a mesma: matar a cadeia inteira e obrigar novo login.

    SEM esta detecção, um refresh token roubado dá acesso indefinido e
    silencioso: o atacante renova para sempre e o dono nunca percebe.
    """
    await _login(client)
    token_roubado = client.cookies.get("refresh_token")

    # A vítima renova normalmente. O token roubado fica queimado.
    await client.post(f"{AUTH}/refresh")
    token_legitimo_atual = client.cookies.get("refresh_token")
    assert token_legitimo_atual != token_roubado

    # O atacante tenta usar o token roubado.
    client.cookies.set("refresh_token", str(token_roubado))
    ataque = await client.post(f"{AUTH}/refresh")
    assert ataque.status_code == 401

    # E agora o ponto crucial: a sessão LEGÍTIMA da vítima também morreu.
    # É o preço de segurança correto — melhor um novo login do que um invasor
    # dentro da conta.
    client.cookies.set("refresh_token", str(token_legitimo_atual))
    apos_ataque = await client.post(f"{AUTH}/refresh")
    assert apos_ataque.status_code == 401, (
        "a sessão legítima sobreviveu ao roubo — a cadeia não foi revogada"
    )


async def test_refresh_sem_cookie_devolve_401(client: AsyncClient) -> None:
    response = await client.post(f"{AUTH}/refresh")

    assert response.status_code == 401


async def test_access_token_nao_vale_como_refresh_token(client: AsyncClient, admin: User) -> None:
    """A claim `typ` impede que tokens de propósitos diferentes sejam trocados."""
    access = (await _login(client)).json()["access_token"]

    client.cookies.set("refresh_token", access)
    response = await client.post(f"{AUTH}/refresh")

    assert response.status_code == 401


# --------------------------------------------------------------------- logout


async def test_logout_revoga_a_sessao(client: AsyncClient, admin: User) -> None:
    await _login(client)
    token_antes = client.cookies.get("refresh_token")

    logout = await client.post(f"{AUTH}/logout")
    assert logout.status_code == 204

    # O token revogado não renova mais, mesmo se o atacante o tiver guardado.
    client.cookies.set("refresh_token", str(token_antes))
    assert (await client.post(f"{AUTH}/refresh")).status_code == 401


async def test_logout_e_idempotente(client: AsyncClient) -> None:
    """Sair duas vezes, ou sem sessão, tem que ser inofensivo. Exigir token
    válido para deslogar impediria justamente quem mais precisa sair."""
    assert (await client.post(f"{AUTH}/logout")).status_code == 204
    assert (await client.post(f"{AUTH}/logout")).status_code == 204
