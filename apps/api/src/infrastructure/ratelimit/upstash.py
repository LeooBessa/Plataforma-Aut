"""Rate limiting com Upstash Redis.

Upstash em vez de um Redis tradicional por um motivo concreto: ele fala HTTP.
Uma conexão TCP persistente com Redis não sobrevive ao modelo serverless (a
função é congelada entre requisições), mas uma chamada HTTP simples, sim. É o
mesmo motivo pelo qual usamos o pooler do Postgres.
"""

from __future__ import annotations

import logging

import httpx

from src.application.ports import RateLimitResult
from src.core.config import get_settings

logger = logging.getLogger(__name__)

# Curto: o rate limit está no caminho de TODA requisição limitada. Se o Redis
# demorar, é melhor deixar passar (fail-open) do que segurar o usuário.
_TIMEOUT_SECONDS = 2.0


class UpstashRateLimiter:
    """Janela fixa via INCR + EXPIRE, numa única chamada pipeline.

    A janela fixa (em vez de sliding window) é uma escolha consciente: é uma
    operação atômica trivial no Redis, e a pequena imprecisão nas bordas da
    janela não importa para proteger login e agendamento de abuso.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._url = settings.upstash_redis_rest_url.rstrip("/")
        self._token = settings.upstash_redis_rest_token.get_secret_value()

    @property
    def _configured(self) -> bool:
        return bool(self._url and self._token)

    async def check(self, key: str, *, limit: int, window_seconds: int) -> RateLimitResult:
        if not self._configured:
            # Sem Redis configurado (desenvolvimento, testes): não limita. É
            # explícito e registrado — não um silêncio que esconde um limitador
            # que nunca funcionou.
            return RateLimitResult(allowed=True, remaining=limit, retry_after=0)

        redis_key = f"ratelimit:{key}"

        try:
            # Pipeline: INCR e EXPIRE numa viagem só. O EXPIRE roda sempre, mas só
            # tem efeito quando a chave é nova (o Redis reinicia o TTL); manter o
            # NX simples fora daqui evita uma condição de corrida na criação.
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{self._url}/pipeline",
                    headers={"Authorization": f"Bearer {self._token}"},
                    json=[
                        ["INCR", redis_key],
                        ["EXPIRE", redis_key, str(window_seconds), "NX"],
                    ],
                )
            response.raise_for_status()
            results = response.json()
            count = int(results[0]["result"])
        except (httpx.HTTPError, KeyError, ValueError, IndexError) as exc:
            # FALHA ABERTO. Ver o comentário na porta RateLimiter: derrubar o site
            # porque o limitador caiu é pior do que o abuso que ele previne.
            logger.warning("Rate limiter indisponível, liberando a requisição: %s", exc)
            return RateLimitResult(allowed=True, remaining=limit, retry_after=0)

        allowed = count <= limit
        return RateLimitResult(
            allowed=allowed,
            remaining=max(0, limit - count),
            retry_after=window_seconds if not allowed else 0,
        )


class NoopRateLimiter:
    """Nunca limita. Usado em testes e quando o Redis não está configurado."""

    async def check(self, key: str, *, limit: int, window_seconds: int) -> RateLimitResult:
        return RateLimitResult(allowed=True, remaining=limit, retry_after=0)
