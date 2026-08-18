"""banners — a imagem do topo da home, trocada pela loja no painel

Tabela nova e isolada: não altera nem lê nada existente, então subir em
produção não tem como afetar o que já está no ar.

Revision ID: 27d7ddf799e4
Revises: 8c917f7e4d09
Create Date: 2026-08-18 17:10:40.923295
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '27d7ddf799e4'
down_revision: str | None = '8c917f7e4d09'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('banners',
    sa.Column('image_url', sa.String(length=500), nullable=False),
    sa.Column('image_path', sa.String(length=500), nullable=False),
    sa.Column('alt', sa.String(length=200), nullable=False),
    sa.Column('link_url', sa.String(length=500), nullable=True),
    sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('banners')
