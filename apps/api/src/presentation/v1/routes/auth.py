"""Rotas de autenticação."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status

from src.core.config import get_settings
from src.domain.identity.entities import Session
from src.presentation.v1.deps import (
    CurrentUser,
    LoginDep,
    LogoutDep,
    RefreshSessionDep,
)
from src.presentation.v1.rate_limit import rate_limit
from src.presentation.v1.schemas.auth import LoginIn, SessionOut, UserOut

router = APIRouter(prefix="/auth", tags=["autenticação"])

REFRESH_COOKIE_NAME = "refresh_token"

# O cookie só é enviado para as rotas de autenticação, e não em toda requisição
# à API. Menos exposição: se o cookie não trafega, não pode vazar num log de
# proxy, num header capturado ou num erro de CORS mal configurado.
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        # httponly: JavaScript não lê. Um XSS na página não consegue roubar a
        # sessão de 7 dias — que é o ativo mais valioso do atacante.
        httponly=True,
        # secure: só trafega por HTTPS. Desligado em desenvolvimento porque
        # localhost é HTTP e o cookie simplesmente não seria gravado.
        secure=settings.is_production,
        # lax: o cookie não acompanha requisições vindas de outro site, o que
        # corta CSRF na origem. Funciona porque o frontend fala com a API pela
        # mesma origem (o Next faz proxy) — se falasse direto com outro domínio,
        # seria preciso SameSite=None, que os navegadores estão bloqueando.
        samesite="lax",
        domain=settings.cookie_domain or None,
        path=REFRESH_COOKIE_PATH,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        domain=settings.cookie_domain or None,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )


def _to_session_out(session: Session) -> SessionOut:
    return SessionOut(
        access_token=session.access_token,
        expires_in=session.expires_in,
        user=UserOut.model_validate(session.user),
    )


def _client_ip(request: Request) -> str | None:
    """IP real do cliente atrás do proxy da Vercel.

    `request.client.host` seria o IP do proxy, não o do usuário — inútil para
    rate limit e para investigar abuso. A Vercel põe o IP verdadeiro no
    `x-forwarded-for`, e o primeiro valor da lista é o cliente original.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# Login: 5 tentativas por minuto por IP. Suficiente para quem errou a senha
# algumas vezes; longe do que um ataque de força bruta precisa.
_login_rate_limit = rate_limit(limit=5, window_seconds=60, scope="login")


@router.post(
    "/login",
    response_model=SessionOut,
    summary="Entrar no painel",
    dependencies=[Depends(_login_rate_limit)],
)
async def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    use_case: LoginDep,
) -> SessionOut:
    session = await use_case.execute(
        payload.email,
        payload.password,
        user_agent=request.headers.get("user-agent"),
        ip_address=_client_ip(request),
    )

    _set_refresh_cookie(response, session.refresh_token)
    return _to_session_out(session)


@router.post("/refresh", response_model=SessionOut, summary="Renovar a sessão")
async def refresh(
    request: Request,
    response: Response,
    use_case: RefreshSessionDep,
) -> SessionOut:
    """Rotaciona o refresh token.

    Se um token já rotacionado reaparecer, o caso de uso revoga TODAS as sessões
    do usuário: é sinal de roubo, não de erro de uso.
    """
    raw = request.cookies.get(REFRESH_COOKIE_NAME) or ""
    session = await use_case.execute(
        raw,
        user_agent=request.headers.get("user-agent"),
        ip_address=_client_ip(request),
    )

    _set_refresh_cookie(response, session.refresh_token)
    return _to_session_out(session)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sair",
)
async def logout(request: Request, response: Response, use_case: LogoutDep) -> None:
    """Revoga o refresh token no banco e apaga o cookie.

    Não exige estar autenticado, e é idempotente: sair duas vezes, ou sair com
    uma sessão já expirada, tem que ser inofensivo. Exigir um access token válido
    para deslogar impediria justamente quem mais precisa sair.
    """
    await use_case.execute(request.cookies.get(REFRESH_COOKIE_NAME))
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserOut, summary="Usuário da sessão atual")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
