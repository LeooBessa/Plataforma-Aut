"""Agregador das rotas da v1. Toda rota nova entra aqui."""

from __future__ import annotations

from fastapi import APIRouter

from src.presentation.v1.routes import health

api_router = APIRouter()
api_router.include_router(health.router)
