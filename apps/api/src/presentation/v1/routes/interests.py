"""Interesse — rota pública.

Terceira porta pública do site, ao lado de `/appointments` e `/consignments`.
Mesma forma (sem login, alvo natural de spam) e mesmas defesas.

O que a distingue: aqui o visitante não pede nada AGORA. Ele diz o que procura e
deixa o contato para quando aparecer. É o lead mais barato de todos — a pessoa
já demonstrou intenção e ainda não achou o carro em lugar nenhum.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Request, status

from src.presentation.v1.deps import CreateInterestDep, PublicCatalogDep
from src.presentation.v1.rate_limit import rate_limit
from src.presentation.v1.schemas.admin_vehicle import AdminBrandOut
from src.presentation.v1.schemas.interest import InterestCreatedOut, InterestCreateIn

logger = logging.getLogger(__name__)

router = APIRouter(tags=["interesse"])


def _client_ip(request: Request) -> str | None:
    """IP real do visitante atrás do proxy da Vercel."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# 5 por hora por IP — um pouco mais folgado que a consignação (3), porque aqui é
# plausível cadastrar dois ou três perfis diferentes ("um Onix para mim, uma
# Strada para meu pai"). Ainda derruba envio automatizado.
_interest_rate_limit = rate_limit(limit=5, window_seconds=3600, scope="interest")


@router.get(
    "/catalog",
    response_model=list[AdminBrandOut],
    summary="Marcas e modelos do catálogo (para o formulário de interesse)",
)
async def get_catalog(use_case: PublicCatalogDep) -> list[AdminBrandOut]:
    """O catálogo COMPLETO, não só o que tem carro à venda.

    É a diferença essencial em relação a `/vehicles/filters`, que devolve apenas
    marcas com estoque — correto lá, porque oferecer um filtro que retorna zero
    resultados é pior do que não oferecer.

    Aqui é o oposto: a pessoa está dizendo o que quer que a loja ARRANJE. Limitar
    ao que já existe no pátio esvaziaria a funcionalidade — quem procura uma
    Hilux justamente quando não há nenhuma é exatamente quem vale cadastrar.
    """
    catalogo = await use_case.execute()
    # `AdminBrandOut` traz o ID, e é o ID que o formulário envia — o cruzamento
    # com o estoque depende de FK, não de nome digitado. O schema tem "Admin" no
    # nome por ter nascido no painel, mas o formato é o mesmo e não expõe nada
    # sensível: marca e modelo são dados públicos de catálogo.
    return [AdminBrandOut.model_validate(b) for b in catalogo.brands]


@router.post(
    "/interests",
    response_model=InterestCreatedOut,
    status_code=status.HTTP_201_CREATED,
    summary="Me avise quando chegar",
    dependencies=[Depends(_interest_rate_limit)],
)
async def create_interest(
    payload: InterestCreateIn,
    request: Request,
    use_case: CreateInterestDep,
) -> InterestCreatedOut:
    ip = _client_ip(request)

    # Campo-armadilha preenchido = robô. Respondemos 201 sem gravar nada:
    # devolver erro ensinaria ao autor do robô o que ajustar.
    if payload.website:
        logger.info("Interesse bloqueado pelo honeypot (ip=%s)", ip)
        return InterestCreatedOut(id=uuid.uuid4())

    pedido = await use_case.execute(payload.to_domain(ip))
    return InterestCreatedOut(id=pedido.id)
