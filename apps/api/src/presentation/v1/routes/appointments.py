"""Agendamento de visita — rota pública.

É o endpoint que gera dinheiro: cada chamada bem-sucedida é um cliente querendo
ver um carro. Por isso é também o mais exposto — público, sem autenticação, e
alvo natural de spam.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Request, status

from src.domain.scheduling.entities import AppointmentDraft
from src.presentation.v1.deps import CreateAppointmentDep
from src.presentation.v1.rate_limit import rate_limit
from src.presentation.v1.schemas.appointment import (
    AppointmentCreatedOut,
    AppointmentCreateIn,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/appointments", tags=["agendamentos"])

# O veículo real é resolvido pelo slug dentro do caso de uso. Este placeholder
# existe só para satisfazer o dataclass — o cliente NUNCA envia um id de veículo.
# Aceitar um id vindo do cliente permitiria agendar visita para um anúncio em
# rascunho, que ele nem deveria saber que existe.
_PLACEHOLDER_VEHICLE_ID = uuid.UUID(int=0)


def _client_ip(request: Request) -> str | None:
    """IP real do visitante atrás do proxy da Vercel."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# Agendamento: 3 por hora por IP. Um cliente legítimo agenda um ou dois carros;
# esse teto derruba o spam automatizado sem incomodar quem é de verdade. O
# honeypot já filtra a maioria dos robôs; isto é a segunda camada.
_appointment_rate_limit = rate_limit(limit=3, window_seconds=3600, scope="appointment")


@router.post(
    "",
    response_model=AppointmentCreatedOut,
    status_code=status.HTTP_201_CREATED,
    summary="Agendar uma visita",
    dependencies=[Depends(_appointment_rate_limit)],
)
async def create_appointment(
    payload: AppointmentCreateIn,
    request: Request,
    use_case: CreateAppointmentDep,
) -> AppointmentCreatedOut:
    ip = _client_ip(request)

    # Campo-armadilha preenchido = robô.
    #
    # Respondemos 201, como se tivesse funcionado, e não gravamos nada. Devolver
    # erro ensinaria ao autor do robô exatamente o que ajustar; fingir sucesso o
    # deixa satisfeito com um spam que não chegou a lugar nenhum.
    if payload.website:
        logger.info("Agendamento bloqueado pelo honeypot (ip=%s)", ip)
        return AppointmentCreatedOut(
            id=uuid.uuid4(),
            scheduled_date=payload.scheduled_date,
            scheduled_time=payload.scheduled_time,
        )

    appointment = await use_case.execute(
        AppointmentDraft(
            vehicle_id=_PLACEHOLDER_VEHICLE_ID,
            customer_name=payload.customer_name,
            phone=payload.phone,
            whatsapp=payload.whatsapp,
            email=payload.email,
            scheduled_date=payload.scheduled_date,
            scheduled_time=payload.scheduled_time,
            notes=payload.notes,
            ip_address=ip,
        ),
        vehicle_slug=payload.vehicle_slug,
    )

    return AppointmentCreatedOut(
        id=appointment.id,
        scheduled_date=appointment.scheduled_date,
        scheduled_time=appointment.scheduled_time,
    )
