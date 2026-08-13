"""consignment requests

Pedidos de quem quer anunciar o carro pela loja — o lead de ESTOQUE, oposto do
agendamento, que é lead de venda.

Revision ID: 1686c943c4b0
Revises: f67f2e62f862
Create Date: 2026-08-13 14:41:36.751593
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "1686c943c4b0"
down_revision: str | None = "f67f2e62f862"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "consignment_requests",
        sa.Column("owner_name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        # Marca, modelo e versão em texto livre. Sem FK para `brands`/`models`
        # de propósito: obrigar quem vende a achar o carro numa lista longa, no
        # celular, custa o contato. A loja normaliza ao criar o anúncio real.
        sa.Column("vehicle", sa.String(length=160), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("mileage", sa.Integer(), nullable=False),
        # Numeric, nunca float: é a base da negociação.
        sa.Column("asking_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("new", "contacted", "published", "declined", name="consignment_status"),
            server_default=sa.text("'new'"),
            nullable=False,
        ),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # O painel abre ordenado por status e data — é o caminho quente, e sem este
    # índice vira varredura de tabela assim que os pedidos acumularem.
    op.create_index(
        "ix_consignment_status_created",
        "consignment_requests",
        ["status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_consignment_status_created", table_name="consignment_requests")
    op.drop_table("consignment_requests")

    # O autogenerate NÃO gera esta linha, e a falta dela é uma armadilha: no
    # Postgres o tipo ENUM é um objeto independente da tabela e sobrevive ao
    # DROP TABLE. Sem removê-lo, um upgrade posterior falha com "type
    # consignment_status already exists" — e o erro aparece só no segundo ciclo
    # de migration, longe da causa.
    op.execute(sa.text("DROP TYPE IF EXISTS consignment_status"))
