"""Configuração da aplicação, carregada de variáveis de ambiente.

Toda configuração passa por aqui e é validada pelo Pydantic no boot. Se uma
variável obrigatória faltar ou vier malformada, a aplicação falha ao iniciar —
e não no meio de um request em produção.
"""

from __future__ import annotations

import logging
from enum import StrEnum
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

logger = logging.getLogger(__name__)


class Environment(StrEnum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


# O valor de `jwt_secret_key` quando NINGUÉM configurou nada. Está no código-fonte,
# então é público: quem o conhece forja um token de super_admin. O guard em
# `_reject_insecure_production` existe para que ele nunca chegue a produção.
_INSECURE_JWT_DEFAULT = "dev-only-insecure-secret-change-me"

# 32 bytes é o piso para HS256: é o tamanho da saída do SHA-256, que é o que o
# HMAC usa internamente. Um segredo mais curto reduz a força da assinatura.
_MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),  # roda tanto de apps/api quanto da raiz
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Ambiente ---
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False

    # --- Banco ---
    # Duas URLs de propósito: o runtime fala com o pooler (6543), o Alembic fala
    # direto com o Postgres (5432). Ver .env.example.
    database_url: str = ""
    database_direct_url: str = ""
    # Banco à parte para os testes de integração. Eles truncam tabelas entre um
    # teste e outro — apontar isso para o banco de desenvolvimento apagaria o
    # trabalho de quem estivesse usando a aplicação.
    test_database_url: str = ""

    # --- Auth ---
    jwt_secret_key: SecretStr = SecretStr("dev-only-insecure-secret-change-me")
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: Annotated[int, Field(gt=0)] = 15
    refresh_token_expire_days: Annotated[int, Field(gt=0)] = 7
    cookie_domain: str | None = None

    # --- CORS ---
    # `NoDecode` desliga o parse automático (o pydantic-settings tentaria
    # json.loads em campos de lista, e `CORS_ORIGINS=http://a,http://b` não é
    # JSON). O validator abaixo faz o split manualmente.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # --- Supabase Storage ---
    supabase_url: str = ""
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_storage_bucket: str = "vehicles"

    # --- Rate limiting ---
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: SecretStr = SecretStr("")

    @property
    def rate_limit_enabled(self) -> bool:
        return bool(
            self.upstash_redis_rest_url and self.upstash_redis_rest_token.get_secret_value()
        )

    # --- E-mail ---
    resend_api_key: SecretStr = SecretStr("")
    email_from: str = ""
    admin_notification_email: str = ""

    # --- Seed ---
    # Sem valor padrão de propósito: o seed FALHA em vez de criar um admin com
    # senha conhecida. Credencial default é como a maioria dos vazamentos por
    # "senha padrão" começa.
    seed_admin_email: str = "admin@autopremium.com.br"
    seed_admin_password: SecretStr = SecretStr("")

    # --- Revalidação do frontend (ISR sob demanda) ---
    # Quando o admin muda um anúncio, a API avisa o Next para regenerar as
    # páginas. `frontend_url` é onde o Next está; `revalidate_secret` é o segredo
    # compartilhado que autentica o aviso.
    frontend_url: str = ""
    revalidate_secret: SecretStr = SecretStr("")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Aceita `CORS_ORIGINS=a,b,c` (formato natural em env var)."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment is Environment.PRODUCTION

    @model_validator(mode="after")
    def _reject_insecure_production(self) -> Settings:
        """Recusa-se a iniciar em produção com configuração insegura.

        POR QUE ISTO EXISTE
        ===================
        Quase todo default deste arquivo é seguro para desenvolvimento e PERIGOSO
        em produção — e a diferença entre os dois é uma única env var. Se
        `JWT_SECRET_KEY` não chegar até o processo (nome errado na Vercel, escopo
        errado, esquecida num redeploy), a aplicação subiria em SILÊNCIO assinando
        tokens com um segredo que está publicado neste arquivo. Qualquer pessoa
        forjaria um `super_admin`, e nada no comportamento do site denunciaria
        isso: o login funciona, as páginas carregam, os testes passam.

        Falhar no boot é a única forma de tornar esse erro visível. Um deploy que
        não sobe é um incidente de cinco minutos; um segredo default em produção é
        um incidente que ninguém percebe até ser tarde.

        Só vale para produção: em desenvolvimento os defaults são a comodidade que
        permite clonar o repo e rodar.
        """
        if not self.is_production:
            return self

        problems: list[str] = []

        secret = self.jwt_secret_key.get_secret_value()
        if secret == _INSECURE_JWT_DEFAULT:
            problems.append(
                "JWT_SECRET_KEY está com o valor default de desenvolvimento, que é "
                "público (está no código-fonte). Gere um novo: openssl rand -hex 32"
            )
        elif len(secret) < _MIN_JWT_SECRET_LENGTH:
            problems.append(
                f"JWT_SECRET_KEY tem {len(secret)} caracteres; o mínimo é "
                f"{_MIN_JWT_SECRET_LENGTH}. Gere um novo: openssl rand -hex 32"
            )

        if not self.database_url:
            problems.append("DATABASE_URL não configurada.")

        # CORS apontando para localhost em produção significa que a env var não
        # chegou — e o site real seria bloqueado pelo navegador. Falhar aqui
        # transforma um bug intermitente de CORS num erro de boot explícito.
        localhost_origins = [o for o in self.cors_origins if "localhost" in o or "127.0.0.1" in o]
        if localhost_origins:
            problems.append(
                f"CORS_ORIGINS aponta para localhost em produção: {localhost_origins}. "
                "Configure a URL real do site."
            )

        if self.debug:
            problems.append(
                "DEBUG=true em produção: o SQLAlchemy passa a logar toda query "
                "(incluindo dados de clientes). Use DEBUG=false."
            )

        if problems:
            raise ValueError(
                "Configuração insegura para produção — a aplicação não vai subir:\n"
                + "\n".join(f"  • {p}" for p in problems)
            )

        # AVISO, não erro: sem Upstash o rate limit vira no-op, e o login fica sem
        # freio contra força bruta. Não derruba o boot porque um site no ar sem
        # rate limit ainda é melhor que um site fora do ar — mas precisa gritar no
        # log, senão a proteção "existe" no código e não existe na prática.
        if not self.rate_limit_enabled:
            logger.error(
                "RATE LIMIT DESLIGADO EM PRODUÇÃO: UPSTASH_REDIS_REST_URL/TOKEN não "
                "configuradas. O login está sem proteção contra força bruta e o "
                "agendamento sem proteção contra spam."
            )

        return self


@lru_cache
def get_settings() -> Settings:
    """Instância única — o cache evita reler o .env a cada request."""
    return Settings()
