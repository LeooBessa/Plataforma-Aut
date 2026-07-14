from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.infrastructure.database.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from src.infrastructure.database.models.catalog import Vehicle
    from src.infrastructure.database.models.identity import User


class Dealership(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Concessionária — a raiz do tenant.

    Hoje a plataforma roda com um único registro (single-tenant). A tabela existe
    desde a primeira migration porque adicioná-la depois exigiria backfill de
    dados em produção e reescrita de toda query e de todo controle de acesso.
    O custo de tê-la agora é ~zero; o de não tê-la é caro.
    """

    __tablename__ = "dealerships"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False, unique=True, index=True)

    city: Mapped[str] = mapped_column(String(80), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False)

    phone: Mapped[str | None] = mapped_column(String(20))
    whatsapp: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(500))

    users: Mapped[list[User]] = relationship(back_populates="dealership")
    vehicles: Mapped[list[Vehicle]] = relationship(back_populates="dealership")
