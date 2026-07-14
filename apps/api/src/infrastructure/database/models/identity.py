from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.domain.identity.enums import UserRole
from src.infrastructure.database.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from src.infrastructure.database.models.dealership import Dealership


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Usuário do painel administrativo.

    Não existe cadastro público: contas são criadas por um admin. Por isso não há
    fluxo de auto-registro na API — é uma superfície de ataque a menos.
    """

    __tablename__ = "users"

    dealership_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("dealerships.id", ondelete="SET NULL"),
        index=True,
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Guardado sempre em minúsculas (normalizado no caso de uso). Sem isso,
    # "Joao@x.com" e "joao@x.com" seriam contas diferentes.
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=UserRole.SELLER,
        server_default=text("'seller'"),  # o menor privilégio é o default
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    dealership: Mapped[Dealership | None] = relationship(back_populates="users")
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Refresh token emitido para um usuário.

    Persistir o token é o que permite **revogar** uma sessão — um JWT puro, sem
    estado, não pode ser cancelado antes de expirar. Aqui, logout e troca de
    senha derrubam sessões de verdade.

    Guardamos o **hash**, nunca o token. Se o banco vazar, os tokens não são
    reutilizáveis — mesmo princípio da senha.

    `replaced_by_id` implementa a rotação: cada refresh gera um token novo e
    aponta o antigo para ele. Se um token já rotacionado for reapresentado, é
    sinal de roubo, e a cadeia inteira daquele usuário é revogada.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_tokens_user_active", "user_id", "revoked_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("refresh_tokens.id", ondelete="SET NULL")
    )

    user_agent: Mapped[str | None] = mapped_column(String(400))
    ip_address: Mapped[str | None] = mapped_column(String(45))  # cabe IPv6

    user: Mapped[User] = relationship(back_populates="refresh_tokens")
