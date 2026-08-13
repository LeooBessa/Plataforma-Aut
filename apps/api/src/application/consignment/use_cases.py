"""Casos de uso da consignação."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from src.core.exceptions import NotFoundError, ValidationError
from src.domain.catalog.value_objects import Page, Pagination
from src.domain.consignment.entities import ConsignmentDraft, ConsignmentRequest
from src.domain.consignment.enums import ConsignmentStatus
from src.domain.consignment.repositories import ConsignmentRepository
from src.domain.consignment.value_objects import ConsignmentFilters

# Um carro de 1900 não existe no estoque de ninguém, e o do ano que vem já é
# anunciado hoje (é normal em outubro haver modelo do ano seguinte).
_ANO_MINIMO = 1950
_ANOS_A_FRENTE = 1

# 2 milhões de km é mais que qualquer carro de passeio roda na vida inteira.
_KM_MAXIMO = 2_000_000

# Teto de preço. Não é sobre o carro valer isso — é sobre alguém digitar o
# telefone no campo do preço e a loja receber um pedido de R$ 84.999.877.293.
_PRECO_MAXIMO = Decimal("10000000")


@dataclass(frozen=True, slots=True)
class CreateConsignmentRequestUseCase:
    """Registra o pedido de quem quer anunciar o carro.

    Não há login, e é de propósito: exigir cadastro para dizer "tenho um carro
    para vender" derruba a conversão a quase zero. O que protege esta porta é o
    mesmo do agendamento — campo-armadilha na borda HTTP e limite por IP.
    """

    repository: ConsignmentRepository

    async def execute(self, draft: ConsignmentDraft) -> ConsignmentRequest:
        _validar(draft)
        return await self.repository.create(draft)


@dataclass(frozen=True, slots=True)
class ListConsignmentRequestsUseCase:
    repository: ConsignmentRepository

    async def execute(
        self, filters: ConsignmentFilters, pagination: Pagination
    ) -> Page[ConsignmentRequest]:
        return await self.repository.search(filters, pagination)


@dataclass(frozen=True, slots=True)
class UpdateConsignmentStatusUseCase:
    repository: ConsignmentRepository

    async def execute(self, request_id: UUID, status: ConsignmentStatus) -> ConsignmentRequest:
        atualizado = await self.repository.update_status(request_id, status)
        if atualizado is None:
            raise NotFoundError("Pedido não encontrado.")
        return atualizado


def _validar(draft: ConsignmentDraft) -> None:
    """Regras que o schema não expressa.

    Vivem aqui, e não na borda HTTP, porque valem para qualquer entrada — um
    import em lote ou um script de migração não passam pelo FastAPI.
    """
    ano_maximo = datetime.now(UTC).year + _ANOS_A_FRENTE

    if not _ANO_MINIMO <= draft.year <= ano_maximo:
        raise ValidationError(
            f"Informe um ano entre {_ANO_MINIMO} e {ano_maximo}.",
            details={"year": draft.year},
        )

    if not 0 <= draft.mileage <= _KM_MAXIMO:
        raise ValidationError(
            "Quilometragem fora do esperado. Confira o valor.",
            details={"mileage": draft.mileage},
        )

    if not Decimal(0) < draft.asking_price <= _PRECO_MAXIMO:
        raise ValidationError(
            "Informe um preço válido para o veículo.",
            details={"asking_price": str(draft.asking_price)},
        )
