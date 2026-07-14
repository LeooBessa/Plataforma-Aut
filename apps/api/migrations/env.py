"""Ambiente do Alembic.

Ponto crítico: o Alembic usa **DATABASE_DIRECT_URL** (porta 5432), não a
DATABASE_URL do runtime (pooler, 6543).

Por quê: o pooler do Supabase roda em *transaction mode* e devolve uma conexão
diferente a cada transação. Migrations precisam de uma sessão real e estável —
elas tomam locks (ALTER TABLE), criam tipos e dependem de estado entre comandos.
Rodar migration pelo pooler resulta em falhas intermitentes e, pior, em migration
aplicada pela metade.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Importa TODOS os models para que Base.metadata os conheça. Sem este import, o
# autogenerate acharia que as tabelas não existem e geraria um DROP.
import src.infrastructure.database.models  # noqa: F401
from src.core.config import get_settings
from src.core.database import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_url() -> str:
    settings = get_settings()
    url = settings.database_direct_url or settings.database_url
    if not url:
        raise RuntimeError(
            "DATABASE_DIRECT_URL não configurada. "
            "Migrations precisam da conexão DIRETA (5432), não do pooler (6543)."
        )
    return url


def run_migrations_offline() -> None:
    """Gera o SQL sem conectar — útil para revisar o que será aplicado em produção."""
    context.configure(
        url=_get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,  # detecta mudança de tipo de coluna
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _get_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
