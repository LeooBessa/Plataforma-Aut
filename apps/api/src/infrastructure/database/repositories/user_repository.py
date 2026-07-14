"""Implementação Postgres dos repositórios de identidade."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import CursorResult, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.identity.entities import AuthenticatedUser, StoredRefreshToken
from src.infrastructure.database.models import RefreshToken, User


def _to_user(user: User) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        dealership_id=user.dealership_id,
        is_active=user.is_active,
    )


class SqlAlchemyUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> AuthenticatedUser | None:
        user = await self._session.scalar(select(User).where(User.email == email))
        return _to_user(user) if user else None

    async def get_by_id(self, user_id: UUID) -> AuthenticatedUser | None:
        user = await self._session.get(User, user_id)
        return _to_user(user) if user else None

    async def get_password_hash(self, user_id: UUID) -> str | None:
        password_hash: str | None = await self._session.scalar(
            select(User.password_hash).where(User.id == user_id)
        )
        return password_hash

    async def touch_last_login(self, user_id: UUID, when: datetime) -> None:
        await self._session.execute(
            update(User).where(User.id == user_id).values(last_login_at=when)
        )


class SqlAlchemyRefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        user_agent: str | None,
        ip_address: str | None,
    ) -> UUID:
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            # O user-agent é truncado: um cliente pode mandar um cabeçalho
            # gigante e estourar o limite da coluna, derrubando o login.
            user_agent=user_agent[:400] if user_agent else None,
            ip_address=ip_address,
        )
        self._session.add(token)
        await self._session.flush()
        return token.id

    async def get_by_hash(self, token_hash: str) -> StoredRefreshToken | None:
        token = await self._session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        if token is None:
            return None

        return StoredRefreshToken(
            id=token.id,
            user_id=token.user_id,
            expires_at=token.expires_at,
            revoked_at=token.revoked_at,
            replaced_by_id=token.replaced_by_id,
        )

    async def revoke(self, token_id: UUID, *, replaced_by_id: UUID | None = None) -> None:
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.id == token_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC), replaced_by_id=replaced_by_id)
        )

    async def revoke_all_for_user(self, user_id: UUID) -> int:
        result = cast(
            "CursorResult[Any]",
            await self._session.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
                .values(revoked_at=datetime.now(UTC))
            ),
        )
        return result.rowcount
