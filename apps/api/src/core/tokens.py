"""Emissão e verificação de tokens.

Dois tipos de token, com papéis bem diferentes:

**Access token (JWT, 15 min).** Sem estado: o servidor valida a assinatura e
confia no conteúdo, sem consultar o banco. É rápido — e é justamente por isso
que NÃO pode ser cancelado antes de expirar. Daí a vida curta.

**Refresh token (opaco, 7 dias).** Uma string aleatória sem significado, cujo
*hash* fica no banco. Como tem estado, pode ser revogado: logout e troca de
senha derrubam sessões de verdade. É o que compensa a impossibilidade de
cancelar o access token.

O refresh token vai num cookie httpOnly: JavaScript não o alcança, então um XSS
não consegue roubá-lo. O access token vive só em memória no frontend — nunca em
localStorage, que é legível por qualquer script injetado na página.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from src.core.config import get_settings
from src.core.exceptions import AuthenticationError
from src.domain.identity.enums import UserRole

_ACCESS_TOKEN_TYPE = "access"  # noqa: S105 — é o valor da claim `typ`, não um segredo


@dataclass(frozen=True, slots=True)
class AccessTokenPayload:
    user_id: uuid.UUID
    role: UserRole
    dealership_id: uuid.UUID | None


def create_access_token(
    user_id: uuid.UUID,
    role: UserRole,
    dealership_id: uuid.UUID | None,
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)

    payload = {
        "sub": str(user_id),
        "role": role.value,
        "dealership_id": str(dealership_id) if dealership_id else None,
        # `typ` impede que um refresh token seja aceito onde se espera um access
        # token. Sem essa marcação, tokens de propósitos diferentes viram
        # intercambiáveis — e um token de vida longa passa a valer como
        # credencial de acesso.
        "typ": _ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> AccessTokenPayload:
    settings = get_settings()

    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret_key.get_secret_value(),
            # `algorithms` é uma LISTA FECHADA de propósito. Aceitar o algoritmo
            # que vier no cabeçalho do token é a vulnerabilidade clássica de JWT:
            # um atacante manda `alg: none` (ou troca RS256 por HS256) e forja
            # qualquer token que quiser.
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Sessão expirada.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Token inválido.") from exc

    if claims.get("typ") != _ACCESS_TOKEN_TYPE:
        raise AuthenticationError("Token inválido.")

    try:
        role = UserRole(claims["role"])
        user_id = uuid.UUID(claims["sub"])
        raw_dealership = claims.get("dealership_id")
        dealership_id = uuid.UUID(raw_dealership) if raw_dealership else None
    except (KeyError, ValueError) as exc:
        raise AuthenticationError("Token inválido.") from exc

    return AccessTokenPayload(user_id=user_id, role=role, dealership_id=dealership_id)


def generate_refresh_token() -> tuple[str, str]:
    """Devolve `(token_puro, hash)`.

    O puro vai para o cookie do usuário; só o hash é gravado. Se o banco vazar,
    os tokens não são reutilizáveis — mesmo princípio das senhas.

    SHA-256 basta aqui (e bcrypt seria desperdício): o token tem 256 bits de
    entropia aleatória. Bcrypt existe para tornar lenta a força bruta sobre
    senhas humanas, que são fracas e previsíveis. Não há dicionário que ataque
    um número aleatório de 256 bits.
    """
    raw = secrets.token_urlsafe(32)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
