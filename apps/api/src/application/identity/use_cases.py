"""Casos de uso de autenticação."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from src.core.config import get_settings
from src.core.exceptions import AuthenticationError
from src.core.security import PasswordHasher
from src.core.tokens import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
)
from src.domain.identity.entities import AuthenticatedUser, Session
from src.domain.identity.repositories import RefreshTokenRepository, UserRepository

logger = logging.getLogger(__name__)

# Hash bcrypt válido de uma senha que ninguém conhece. Serve como alvo falso.
# O porquê está em `LoginUseCase.execute`.
_DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO.7ZzAFqTKMlKZLdvQNvVzZ5tCJvE1Vu"

_INVALID_CREDENTIALS = "E-mail ou senha inválidos."


@dataclass(frozen=True, slots=True)
class LoginUseCase:
    users: UserRepository
    refresh_tokens: RefreshTokenRepository
    hasher: PasswordHasher

    async def execute(
        self,
        email: str,
        password: str,
        *,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> Session:
        # Normalizado para minúsculas: sem isso, "Joao@x.com" e "joao@x.com"
        # seriam contas diferentes, e o usuário juraria que a senha "parou de
        # funcionar".
        user = await self.users.get_by_email(email.strip().lower())

        password_hash = await self.users.get_password_hash(user.id) if user else None

        # Quando o usuário não existe, verificamos a senha contra um hash falso
        # em vez de retornar na hora.
        #
        # Sem isso, o login responderia em ~1ms para e-mail inexistente e em
        # ~250ms para e-mail existente (o custo do bcrypt). Essa diferença é
        # mensurável pela rede e transforma o endpoint num oráculo: dá para
        # descobrir QUAIS e-mails têm conta, sem acertar nenhuma senha. É a
        # enumeração de usuários — o primeiro passo de um ataque dirigido.
        #
        # Aqui, existindo ou não o usuário, o bcrypt roda e o tempo é o mesmo.
        self.hasher.verify(password, password_hash or _DUMMY_HASH)

        if user is None or password_hash is None:
            raise AuthenticationError(_INVALID_CREDENTIALS)

        if not self.hasher.verify(password, password_hash):
            raise AuthenticationError(_INVALID_CREDENTIALS)

        # Conta desativada devolve a MESMA mensagem de credencial inválida.
        # Dizer "sua conta está desativada" confirmaria ao atacante que o e-mail
        # e a senha estão certos.
        if not user.is_active:
            raise AuthenticationError(_INVALID_CREDENTIALS)

        await self.users.touch_last_login(user.id, datetime.now(UTC))

        return await _issue_session(
            user, self.refresh_tokens, user_agent=user_agent, ip_address=ip_address
        )


@dataclass(frozen=True, slots=True)
class RefreshSessionUseCase:
    """Rotaciona o refresh token, com detecção de reuso.

    Toda renovação queima o token usado e emite um novo. Se um token JÁ
    rotacionado for apresentado de novo, só há duas explicações: ele foi roubado,
    ou está sendo replicado. Nos dois casos a resposta correta é a mesma —
    **revogar todas as sessões do usuário** e exigir novo login.

    Sem essa detecção, um refresh token roubado dá ao atacante acesso indefinido
    e silencioso: ele renova para sempre, e o dono legítimo nunca percebe.
    """

    users: UserRepository
    refresh_tokens: RefreshTokenRepository

    async def execute(
        self,
        raw_token: str,
        *,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> Session:
        stored = await self.refresh_tokens.get_by_hash(hash_refresh_token(raw_token))

        if stored is None:
            raise AuthenticationError("Sessão inválida. Faça login novamente.")

        if stored.revoked_at is not None:
            # O token já tinha sido queimado — e reapareceu. Isto é um sinal de
            # roubo, não um erro de uso.
            revoked = await self.refresh_tokens.revoke_all_for_user(stored.user_id)
            logger.warning(
                "Reuso de refresh token detectado (user=%s). %d sessões revogadas.",
                stored.user_id,
                revoked,
            )
            raise AuthenticationError("Sessão inválida. Faça login novamente.")

        if not stored.is_active:
            raise AuthenticationError("Sessão expirada. Faça login novamente.")

        user = await self.users.get_by_id(stored.user_id)
        if user is None or not user.is_active:
            raise AuthenticationError("Sessão inválida. Faça login novamente.")

        session = await _issue_session(
            user, self.refresh_tokens, user_agent=user_agent, ip_address=ip_address
        )

        # Queima o token antigo apontando para o novo. É essa corrente que
        # permite detectar o reuso mais tarde.
        new_hash = hash_refresh_token(session.refresh_token)
        new_stored = await self.refresh_tokens.get_by_hash(new_hash)
        await self.refresh_tokens.revoke(
            stored.id, replaced_by_id=new_stored.id if new_stored else None
        )

        return session


@dataclass(frozen=True, slots=True)
class LogoutUseCase:
    refresh_tokens: RefreshTokenRepository

    async def execute(self, raw_token: str | None) -> None:
        """Logout é idempotente: sem token, ou com token desconhecido, não falha.

        Devolver erro num logout só atrapalha — o usuário quer sair, e sair duas
        vezes tem que ser inofensivo.
        """
        if not raw_token:
            return

        stored = await self.refresh_tokens.get_by_hash(hash_refresh_token(raw_token))
        if stored and stored.revoked_at is None:
            await self.refresh_tokens.revoke(stored.id)


async def _issue_session(
    user: AuthenticatedUser,
    refresh_tokens: RefreshTokenRepository,
    *,
    user_agent: str | None,
    ip_address: str | None,
) -> Session:
    settings = get_settings()

    raw_refresh, refresh_hash = generate_refresh_token()

    await refresh_tokens.create(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        user_agent=user_agent,
        ip_address=ip_address,
    )

    return Session(
        access_token=create_access_token(user.id, user.role, user.dealership_id),
        refresh_token=raw_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
    )
