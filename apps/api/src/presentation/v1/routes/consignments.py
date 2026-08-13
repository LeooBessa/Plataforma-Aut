"""Consignação — rota pública.

O outro lado do negócio: enquanto `/appointments` traz comprador, esta traz
carro para vender. Mesma forma (pública, sem login, alvo natural de spam) e
mesmas defesas.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Request, status

from src.presentation.v1.deps import CreateConsignmentDep
from src.presentation.v1.rate_limit import rate_limit
from src.presentation.v1.schemas.consignment import (
    ConsignmentCreatedOut,
    ConsignmentCreateIn,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/consignments", tags=["consignação"])


def _client_ip(request: Request) -> str | None:
    """IP real do visitante atrás do proxy da Vercel."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# 3 por hora por IP. Quem tem carro para vender envia um pedido, no máximo dois
# (o do casal). Esse teto derruba envio automatizado sem incomodar ninguém real.
_consignment_rate_limit = rate_limit(limit=3, window_seconds=3600, scope="consignment")


@router.post(
    "",
    response_model=ConsignmentCreatedOut,
    status_code=status.HTTP_201_CREATED,
    summary="Quero anunciar meu carro",
    dependencies=[Depends(_consignment_rate_limit)],
)
async def create_consignment(
    payload: ConsignmentCreateIn,
    request: Request,
    use_case: CreateConsignmentDep,
) -> ConsignmentCreatedOut:
    ip = _client_ip(request)

    # Campo-armadilha preenchido = robô.
    #
    # Respondemos 201, como se tivesse dado certo, e não gravamos nada. Devolver
    # erro ensinaria ao autor do robô exatamente o que ajustar; fingir sucesso o
    # deixa satisfeito com um spam que não chegou a lugar nenhum.
    if payload.website:
        logger.info("Consignação bloqueada pelo honeypot (ip=%s)", ip)
        return ConsignmentCreatedOut(id=uuid.uuid4())

    pedido = await use_case.execute(payload.to_domain(ip))
    return ConsignmentCreatedOut(id=pedido.id)
