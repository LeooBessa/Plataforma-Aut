"""Composição da aplicação FastAPI.

`create_app()` é uma factory, não um singleton no import: os testes montam uma
instância limpa com as dependências que quiserem, sem estado vazando entre eles.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import get_settings
from src.presentation.errors import register_exception_handlers
from src.presentation.security_headers import SecurityHeadersMiddleware
from src.presentation.v1.router import api_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

API_V1_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Plataforma Auto — API",
        description="Marketplace de anúncios de automóveis.",
        version="0.1.0",
        # Documentação interativa fica fora do ar em produção: expõe o mapa
        # completo da API, inclusive rotas administrativas.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    # Headers de segurança em toda resposta. Adicionado antes do CORS de
    # propósito: middlewares rodam na ordem INVERSA da adição, então este é o
    # último a tocar a resposta e garante que os headers sobrevivam.
    app.add_middleware(SecurityHeadersMiddleware)

    # Origens explícitas. Nunca "*" junto de allow_credentials: o navegador
    # rejeita a combinação, e mesmo que não rejeitasse, seria um convite a CSRF.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=API_V1_PREFIX)

    return app


app = create_app()
