"""Health check. Não toca no banco de propósito — mede se a função está viva,
não se o Postgres está. Um health check que consulta o banco transforma uma
lentidão do banco em "aplicação fora do ar" para o monitoramento."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from src.core.config import Environment, get_settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    environment: Environment
    version: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", environment=settings.environment, version="0.1.0")
