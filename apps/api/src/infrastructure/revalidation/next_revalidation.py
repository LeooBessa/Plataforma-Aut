"""Avisa o frontend Next.js para regenerar páginas quando os dados mudam."""

from __future__ import annotations

import logging

import httpx

from src.core.config import get_settings

logger = logging.getLogger(__name__)

# Curto: este aviso acontece dentro da requisição do admin que salvou o anúncio.
# Se o frontend demorar a responder, não faz sentido segurar o admin esperando —
# a página se regenera sozinha no próximo ciclo do ISR de qualquer forma.
_TIMEOUT_SECONDS = 4.0


class NextRevalidationService:
    """Chama o endpoint /api/revalidate do Next. Nunca levanta exceção."""

    async def revalidate(self, tags: list[str]) -> bool:
        settings = get_settings()

        if not settings.frontend_url or not settings.revalidate_secret.get_secret_value():
            # Sem frontend configurado (ex: rodando só a API em teste). Não é
            # erro — apenas não há o que revalidar.
            return False

        url = f"{settings.frontend_url.rstrip('/')}/api/revalidate"

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    url,
                    headers={"x-revalidate-secret": settings.revalidate_secret.get_secret_value()},
                    json={"tags": tags},
                )
        except httpx.HTTPError as exc:
            # Engolir é o contrato: salvar o anúncio não pode falhar porque o
            # frontend não respondeu. O log registra para diagnóstico.
            logger.warning("Falha ao revalidar o frontend (tags=%s): %s", tags, exc)
            return False

        if response.status_code >= 400:
            logger.warning(
                "Frontend recusou a revalidação (%s): %s", response.status_code, response.text
            )
            return False

        return True


class NoopRevalidationService:
    """Não faz nada. Usado nos testes e quando não há frontend."""

    async def revalidate(self, tags: list[str]) -> bool:
        return True
