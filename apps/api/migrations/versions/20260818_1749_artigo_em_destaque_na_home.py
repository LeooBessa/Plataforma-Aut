"""artigo em destaque na home — troca a tabela `banners` por uma marca no artigo

O banner deixou de ser uma imagem avulsa com tela própria e virou um botão
dentro do artigo: marcar "destacar na home" põe a capa dele no topo do site,
com um botão "Ler artigo".

A tabela `banners` é derrubada porque não chegou a ser usada — subiu e foi
substituída no mesmo dia, sem nenhum banner gravado. Se houvesse conteúdo, a
migration teria de migrá-lo em vez de descartar.

Revision ID: fc5aa79cba50
Revises: 27d7ddf799e4
Create Date: 2026-08-18 17:49:15.269522
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'fc5aa79cba50'
down_revision: str | None = '27d7ddf799e4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table('banners')
    # `server_default` false: a coluna nasce em tabela que já tem linhas, e sem
    # padrão o NOT NULL falharia em qualquer artigo existente.
    op.add_column('articles', sa.Column('featured', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.create_index(op.f('ix_articles_featured'), 'articles', ['featured'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_articles_featured'), table_name='articles')
    op.drop_column('articles', 'featured')
    op.create_table('banners',
    sa.Column('image_url', sa.VARCHAR(length=500), autoincrement=False, nullable=False),
    sa.Column('image_path', sa.VARCHAR(length=500), autoincrement=False, nullable=False),
    sa.Column('alt', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('link_url', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('active', sa.BOOLEAN(), server_default=sa.text('true'), autoincrement=False, nullable=False),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('banners_pkey'))
    )
