"""Mixins compartilhados pelos models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column


class UUIDPrimaryKeyMixin:
    """Chave primária UUID.

    UUID em vez de serial: não vaza volume de negócio (um `/veiculos/1` conta ao
    concorrente quantos carros você tem) e permite gerar o id no cliente, o que
    simplifica escritas em lote e futura sincronização offline.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )


class TimestampMixin:
    """`created_at` / `updated_at` gerenciados pelo banco e pelo ORM.

    `onupdate` cobre toda escrita que passa pelo SQLAlchemy — e, por contrato
    deste projeto, toda escrita passa por ele (nada de SQL solto em produção).
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
