"""vehicle interests

Quem pediu para ser avisado quando o carro certo entrar no estoque — o oposto da
consignação: aquela traz CARRO, esta traz COMPRADOR.

Revision ID: 9fc7a307c5f1
Revises: 1686c943c4b0
Create Date: 2026-08-17 15:22:43.360533
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "9fc7a307c5f1"
down_revision: str | None = "1686c943c4b0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vehicle_interests",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=160), nullable=True),
        # FK para o catálogo, ao contrário da consignação (que guarda o carro em
        # texto livre). Todo o valor desta tabela está no CRUZAMENTO com
        # `vehicles`, e cruzamento por texto livre não funciona: "fiat toro",
        # "Toro" e "Fiat TORO 1.8" seriam três coisas para o banco.
        #
        # RESTRICT: apagar uma marca com gente esperando por ela deixaria pedidos
        # órfãos que nunca mais cruzam com nada. Que a exclusão falhe.
        sa.Column("brand_id", sa.UUID(), nullable=False),
        sa.Column("model_id", sa.UUID(), nullable=True),
        # `create_type=False` é OBRIGATÓRIO aqui, e o autogenerate não o escreve:
        # `body_type` já existe no banco desde a tabela de veículos. Sem isso a
        # migration morre com "type body_type already exists".
        sa.Column(
            "body_type",
            postgresql.ENUM(
                "hatch",
                "sedan",
                "suv",
                "pickup",
                "coupe",
                "convertible",
                "wagon",
                "minivan",
                "van",
                name="body_type",
                create_type=False,
            ),
            nullable=True,
        ),
        # Numeric, nunca float: é o teto que decide se um carro é oportunidade.
        sa.Column("max_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        # Valores MINÚSCULOS, como o resto do banco. O autogenerate escreve os
        # nomes dos membros ("NEW"), que não bateriam com o server_default 'new'.
        sa.Column(
            "status",
            sa.Enum("new", "notified", "closed", name="interest_status"),
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
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["model_id"], ["vehicle_models.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    # O painel abre por status e data.
    op.create_index(
        "ix_interest_status_created", "vehicle_interests", ["status", "created_at"], unique=False
    )
    # O cruzamento filtra por marca e teto de preço — este índice é o que segura
    # a consulta quando a lista de espera crescer.
    op.create_index(
        "ix_interest_brand_price", "vehicle_interests", ["brand_id", "max_price"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_interest_brand_price", table_name="vehicle_interests")
    op.drop_index("ix_interest_status_created", table_name="vehicle_interests")
    op.drop_table("vehicle_interests")

    # O autogenerate NÃO gera esta linha, e a falta dela é armadilha: no Postgres
    # o ENUM é objeto independente da tabela e sobrevive ao DROP TABLE. Sem
    # removê-lo, um upgrade posterior falha com "type interest_status already
    # exists" — e o erro só aparece no segundo ciclo, longe da causa.
    #
    # `body_type` NÃO entra aqui: ele é da tabela de veículos e continua em uso.
    op.execute(sa.text("DROP TYPE IF EXISTS interest_status"))
