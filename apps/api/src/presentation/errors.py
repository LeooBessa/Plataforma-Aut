"""Tradução de exceções de domínio para respostas HTTP.

Ponto único de conversão. Um handler novo aqui vale para a API inteira — nenhum
router precisa de try/except para erros de negócio.

Em produção, erros inesperados devolvem uma mensagem genérica: stack trace e
detalhes internos vão para o log, nunca para o cliente (vazam estrutura interna
e ajudam um atacante a mapear o sistema).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from src.core.config import get_settings
from src.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    DomainError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)

logger = logging.getLogger(__name__)

_STATUS_BY_ERROR: dict[type[DomainError], int] = {
    NotFoundError: status.HTTP_404_NOT_FOUND,
    ConflictError: status.HTTP_409_CONFLICT,
    ValidationError: status.HTTP_422_UNPROCESSABLE_CONTENT,
    AuthenticationError: status.HTTP_401_UNAUTHORIZED,
    AuthorizationError: status.HTTP_403_FORBIDDEN,
    RateLimitError: status.HTTP_429_TOO_MANY_REQUESTS,
}


def _error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _handle_domain_error(_: Request, exc: DomainError) -> JSONResponse:
        http_status = _STATUS_BY_ERROR.get(type(exc), status.HTTP_400_BAD_REQUEST)

        headers: dict[str, str] = {}
        # No 429, o header Retry-After diz ao cliente (e a um cliente HTTP bem
        # comportado) quantos segundos esperar. Sem ele, quem tomou o limite fica
        # tentando às cegas — e às vezes reforçando o próprio bloqueio.
        if isinstance(exc, RateLimitError):
            retry_after = exc.details.get("retry_after")
            if isinstance(retry_after, int):
                headers["Retry-After"] = str(retry_after)

        return JSONResponse(
            status_code=http_status,
            content=_error_body(exc.code, exc.message, exc.details),
            headers=headers or None,
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "Erro não tratado em %s %s", request.method, request.url.path, exc_info=exc
        )
        settings = get_settings()
        message = "Erro interno do servidor." if settings.is_production else str(exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body("internal_error", message),
        )
