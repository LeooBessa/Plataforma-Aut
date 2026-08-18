"""Agregador das rotas da v1. Toda rota nova entra aqui."""

from __future__ import annotations

from fastapi import APIRouter

from src.presentation.v1.routes import (
    admin,
    appointments,
    articles,
    auth,
    banners,
    consignments,
    health,
    interests,
    vehicles,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(vehicles.router)
api_router.include_router(articles.router)
api_router.include_router(banners.router)
api_router.include_router(appointments.router)
api_router.include_router(consignments.router)
api_router.include_router(interests.router)
api_router.include_router(admin.router)
