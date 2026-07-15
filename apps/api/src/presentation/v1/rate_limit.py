"""Rate limiting como dependência do FastAPI.

Uma factory `rate_limit(...)` produz uma dependência aplicável por rota. Fica
declarativo: o endpoint diz "5 por minuto" e a mecânica de contar, checar e
responder 429 vive aqui, num lugar só.
"""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends, Request

from src.application.ports import RateLimiter
from src.core.config import get_settings
from src.core.exceptions import RateLimitError
from src.infrastructure.ratelimit.upstash import NoopRateLimiter, UpstashRateLimiter


def get_rate_limiter() -> RateLimiter:
    if get_settings().rate_limit_enabled:
        return UpstashRateLimiter()
    return NoopRateLimiter()


RateLimiterDep = Annotated[RateLimiter, Depends(get_rate_limiter)]


def _client_ip(request: Request) -> str:
    """IP real do cliente atrás do proxy da Vercel.

    A chave do rate limit PRECISA ser o IP do usuário, não o do proxy. Se
    usássemos `request.client.host`, todos os usuários apareceriam com o mesmo IP
    (o do proxy) e um único abusador esgotaria o limite de todo mundo — um
    autogol que transforma a proteção em negação de serviço.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(
    *, limit: int, window_seconds: int, scope: str
) -> Callable[[Request, RateLimiter], Coroutine[Any, Any, None]]:
    """Cria uma dependência que limita `limit` requisições por `window_seconds`.

    `scope` separa os contadores: o limite de login e o de agendamento são
    independentes, então alguém agendando muitas visitas não fica sem conseguir
    fazer login.
    """

    async def dependency(request: Request, limiter: RateLimiterDep) -> None:
        key = f"{scope}:{_client_ip(request)}"
        result = await limiter.check(key, limit=limit, window_seconds=window_seconds)

        if not result.allowed:
            raise RateLimitError(
                "Muitas tentativas. Aguarde um instante e tente novamente.",
                details={"retry_after": result.retry_after},
            )

    return dependency
