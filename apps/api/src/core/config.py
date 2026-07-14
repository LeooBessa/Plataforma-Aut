"""Configuração da aplicação, carregada de variáveis de ambiente.

Toda configuração passa por aqui e é validada pelo Pydantic no boot. Se uma
variável obrigatória faltar ou vier malformada, a aplicação falha ao iniciar —
e não no meio de um request em produção.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


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


@lru_cache
def get_settings() -> Settings:
    """Instância única — o cache evita reler o .env a cada request."""
    return Settings()
