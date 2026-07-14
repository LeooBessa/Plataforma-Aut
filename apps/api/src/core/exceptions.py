"""Exceções de domínio.

Estas exceções vivem no núcleo e não conhecem HTTP. É a camada de apresentação
que as traduz em status codes (ver `src/presentation/errors.py`). Assim o
domínio permanece testável e reaproveitável fora de uma API web.
"""

from __future__ import annotations

from typing import Any


class DomainError(Exception):
    """Raiz de toda exceção de negócio."""

    code: str = "domain_error"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(DomainError):
    """Recurso solicitado não existe."""

    code = "not_found"


class ConflictError(DomainError):
    """Operação viola uma regra de unicidade ou de estado."""

    code = "conflict"


class ValidationError(DomainError):
    """Dado inválido segundo uma regra de negócio (não de formato)."""

    code = "validation_error"


class AuthenticationError(DomainError):
    """Credenciais ausentes ou inválidas."""

    code = "authentication_error"


class AuthorizationError(DomainError):
    """Autenticado, mas sem permissão para esta ação."""

    code = "authorization_error"


class RateLimitError(DomainError):
    """Excedeu o limite de requisições."""

    code = "rate_limit_exceeded"
