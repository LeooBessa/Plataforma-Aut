from __future__ import annotations

from httpx import AsyncClient


async def test_health_responde_ok(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_health_nao_depende_do_banco(client: AsyncClient) -> None:
    """Sem DATABASE_URL configurada, o health ainda responde.

    Garante o contrato descrito em `routes/health.py`: o health mede se a função
    está viva, não se o Postgres está.
    """
    response = await client.get("/api/v1/health")

    assert response.status_code == 200
