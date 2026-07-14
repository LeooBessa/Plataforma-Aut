"""Entidades de identidade."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from src.domain.identity.enums import UserRole


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    """Usuário logado. Note que o hash da senha NÃO está aqui.

    O hash nunca sai da camada de infraestrutura: assim ele não pode ser
    serializado por acidente numa resposta da API, nem cair num log de debug.
    """

    id: UUID
    name: str
    email: str
    role: UserRole
    dealership_id: UUID | None
    is_active: bool

    @property
    def is_admin(self) -> bool:
        return self.role in {UserRole.SUPER_ADMIN, UserRole.ADMIN}

    @property
    def is_super_admin(self) -> bool:
        return self.role is UserRole.SUPER_ADMIN


@dataclass(frozen=True, slots=True)
class Session:
    """Sessão emitida no login ou na renovação."""

    access_token: str
    refresh_token: str
    expires_in: int  # segundos de vida do access token
    user: AuthenticatedUser


@dataclass(frozen=True, slots=True)
class StoredRefreshToken:
    id: UUID
    user_id: UUID
    expires_at: datetime
    revoked_at: datetime | None
    replaced_by_id: UUID | None

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at > datetime.now(tz=self.expires_at.tzinfo)
