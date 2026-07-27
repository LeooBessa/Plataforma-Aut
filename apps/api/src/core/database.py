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

import os
from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any

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


def _is_serverless() -> bool:
    """Estamos rodando como função serverless (Vercel)?

    A variável `VERCEL` é definida pelo runtime da Vercel e é o sinal MAIS
    CONFIÁVEL de serverless — mais que o `ENVIRONMENT`, que alguém pode esquecer
    de setar. `is_production` entra junto por garantia (cinto e suspensório):
    qualquer um dos dois verdadeiro ⇒ trata como serverless.
    """
    return bool(os.getenv("VERCEL")) or get_settings().is_production


@lru_cache
def get_engine() -> AsyncEngine:
    """Engine criada sob demanda (lazy).

    Lazy de propósito: permite que a aplicação suba e responda `/health` mesmo
    sem banco configurado — útil em CI e no primeiro boot local.

    O TIPO DE POOL depende de ONDE roda:

    • Serverless (Vercel): `NullPool`. Cada invocação é um processo efêmero; um
      pool nosso esgotaria o limite de conexões do Postgres em minutos. Quem faz
      o pooling é o pgbouncer do Supabase (6543).

    • Dev local (uvicorn de longa duração): um POOL PERSISTENTE. Sem ele, o
      `NullPool` reabre a conexão com o Supabase (que fica em sa-east-1) a CADA
      request — e o handshake TLS + auth do pooler custa ~1s. Reaproveitando a
      conexão, o request cai para o tempo da query. Um processo só, sem risco de
      estourar conexões.
    """
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL não configurada. Copie .env.example para .env e preencha.")

    engine_kwargs: dict[str, Any] = {
        "connect_args": {
            # Obrigatório atrás do pgbouncer em transaction mode, com pool nosso
            # OU sem — o pooler devolve conexão diferente por transação, e
            # prepared statements amarrados a uma conexão quebram.
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
        "echo": settings.debug and not settings.is_production,
    }

    if _is_serverless():
        engine_kwargs["poolclass"] = NullPool
    else:
        # `pre_ping` descarta conexão morta (o pooler derruba as ociosas) antes
        # de usar; `recycle` renova as antigas. Um round-trip barato em troca de
        # não tomar "connection was closed" no meio de um request.
        engine_kwargs["pool_size"] = 5
        engine_kwargs["max_overflow"] = 5
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_recycle"] = 1800

    return create_async_engine(settings.database_url, **engine_kwargs)


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
