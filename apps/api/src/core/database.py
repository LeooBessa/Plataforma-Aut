"""Conexão com o Postgres, configurada para rodar em ambiente serverless.

Aqui mora a mitigação mais importante da arquitetura serverless. Vale entender
o porquê antes de mexer:

Em serverless, cada invocação é um processo novo e efêmero. Se cada um abrisse
um pool de conexões do SQLAlchemy, o limite de conexões do Postgres seria
esgotado em minutos sob carga. A solução tem duas partes:

1. `NullPool` — o SQLAlchemy não faz pooling nenhum. Quem faz é o pooler do
   Supabase (pgbouncer, porta 6543), que é externo e compartilhado.

2. `statement_cache_size=0` — o pgbouncer em *transaction mode* devolve uma
   conexão diferente a cada transação. O asyncpg, por padrão, cria prepared
   statements que ficam amarrados a uma conexão específica. A combinação das
   duas coisas gera erros intermitentes de "prepared statement does not exist",
   que só aparecem sob concorrência e são miseráveis de depurar. Desligar o
   cache resolve na raiz.

O Alembic NÃO usa este módulo: migrations precisam de sessão real e vão pela
conexão direta (5432). Ver `migrations/env.py`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from src.core.config import get_settings


class Base(DeclarativeBase):
    """Base declarativa de todos os models. Ver `src/infrastructure/database/models`."""


@lru_cache
def get_engine() -> AsyncEngine:
    """Engine criada sob demanda (lazy).

    Lazy de propósito: permite que a aplicação suba e responda `/health` mesmo
    sem banco configurado — útil em CI e no primeiro boot local.
    """
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL não configurada. Copie .env.example para .env e preencha.")

    return create_async_engine(
        settings.database_url,
        poolclass=NullPool,  # o pooling é do pgbouncer, não nosso
        connect_args={
            "statement_cache_size": 0,  # obrigatório atrás de pgbouncer/transaction
            "prepared_statement_cache_size": 0,
        },
        echo=settings.debug and not settings.is_production,
    )


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=get_engine(),
        expire_on_commit=False,  # objetos seguem utilizáveis após o commit
        autoflush=False,
    )


async def get_session() -> AsyncIterator[AsyncSession]:
    """Dependência do FastAPI: uma sessão por request, sempre fechada ao final."""
    async with get_session_factory()() as session:
        try:
            yield session
            # COMMIT no fim da requisição bem-sucedida.
            #
            # Sem esta linha, os repositórios chamam `flush()` (que envia o SQL e
            # devolve os ids gerados), a API responde 201 com o recurso criado —
            # e a transação é DESCARTADA quando a sessão fecha. Ou seja: o
            # agendamento do cliente sumia em silêncio, com a API dizendo "deu
            # certo".
            #
            # É a fronteira transacional da requisição: ou tudo é confirmado, ou
            # nada é. Um caso de uso que grave em duas tabelas não pode deixar
            # uma delas para trás.
            await session.commit()
        except Exception:
            await session.rollback()
            raise
