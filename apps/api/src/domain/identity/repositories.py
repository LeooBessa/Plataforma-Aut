"""Portas de persistência de identidade."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from src.domain.identity.entities import AuthenticatedUser, StoredRefreshToken


class UserRepository(Protocol):
    async def get_by_email(self, email: str) -> AuthenticatedUser | None: ...

    async def get_by_id(self, user_id: UUID) -> AuthenticatedUser | None: ...

    async def get_password_hash(self, user_id: UUID) -> str | None:
        """O hash é buscado à parte, e nunca viaja dentro da entidade.

        Assim ele não pode ser serializado por acidente numa resposta da API nem
        aparecer num log — só o caso de uso de login o toca.
        """
        ...

    async def touch_last_login(self, user_id: UUID, when: datetime) -> None: ...


class RefreshTokenRepository(Protocol):
    async def create(
        self,
        *,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        user_agent: str | None,
        ip_address: str | None,
    ) -> UUID: ...

    async def get_by_hash(self, token_hash: str) -> StoredRefreshToken | None: ...

    async def revoke(self, token_id: UUID, *, replaced_by_id: UUID | None = None) -> None: ...

    async def revoke_all_for_user(self, user_id: UUID) -> int:
        """Derruba todas as sessões do usuário. Devolve quantas foram revogadas.

        Usado na detecção de reuso: se um token já rotacionado reaparece, ou ele
        foi roubado, ou está sendo replicado. Em qualquer dos casos, a resposta
        certa é matar a cadeia inteira e obrigar um novo login.
        """
        ...
