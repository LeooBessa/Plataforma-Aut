"""Casos de uso do interesse — "me avise quando chegar"."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from src.core.exceptions import NotFoundError, ValidationError
from src.domain.catalog.value_objects import Page, Pagination
from src.domain.interest.entities import InterestDraft, VehicleInterest
from src.domain.interest.enums import InterestStatus
from src.domain.interest.repositories import InterestRepository
from src.domain.interest.value_objects import InterestFilters

# Piso e teto do orçamento. O piso existe porque "0" ou "1" não é orçamento, é
# campo preenchido errado — e um pedido desses casaria com QUALQUER carro no
# cruzamento, entupindo a fila do vendedor com falso positivo.
_PRECO_MINIMO = Decimal("1000")
_PRECO_MAXIMO = Decimal("10000000")


@dataclass(frozen=True, slots=True)
class CreateInterestUseCase:
    """Registra quem quer ser avisado quando o carro certo aparecer.

    Sem login, como o resto das portas públicas: quem está começando a procurar
    carro não cria conta em revenda. Protegem esta porta o campo-armadilha na
    borda HTTP e o limite por IP.
    """

    repository: InterestRepository

    async def execute(self, draft: InterestDraft) -> VehicleInterest:
        await _validar(draft, self.repository)
        return await self.repository.create(draft)


@dataclass(frozen=True, slots=True)
class ListInterestsUseCase:
    repository: InterestRepository

    async def execute(
        self, filters: InterestFilters, pagination: Pagination
    ) -> Page[VehicleInterest]:
        return await self.repository.search(filters, pagination)


@dataclass(frozen=True, slots=True)
class UpdateInterestStatusUseCase:
    repository: InterestRepository

    async def execute(self, interest_id: UUID, status: InterestStatus) -> VehicleInterest:
        atualizado = await self.repository.update_status(interest_id, status)
        if atualizado is None:
            raise NotFoundError("Pedido não encontrado.")
        return atualizado


async def _validar(draft: InterestDraft, repository: InterestRepository) -> None:
    """Regras que o schema não expressa.

    Vivem aqui, e não na borda HTTP, porque valem para qualquer entrada — um
    import em lote ou um script não passam pelo FastAPI.
    """
    if not _PRECO_MINIMO <= draft.max_price <= _PRECO_MAXIMO:
        raise ValidationError(
            f"Informe um valor entre R$ {_PRECO_MINIMO:,.0f} e R$ {_PRECO_MAXIMO:,.0f}.",
            details={"max_price": str(draft.max_price)},
        )

    # A marca precisa existir de verdade: o formulário manda um UUID, e UUID
    # inventado passaria pelo schema e viraria um pedido que nunca cruza com
    # nada — sem erro visível, só um lead morto no banco.
    if not await repository.brand_exists(draft.brand_id):
        raise ValidationError("Marca não encontrada.", details={"brand_id": str(draft.brand_id)})

    # Modelo tem de pertencer à marca escolhida. Sem esta checagem, "Fiat +
    # Corolla" entraria e o cruzamento nunca encontraria nada — o pedido ficaria
    # eternamente sem match, e ninguém saberia por quê.
    if draft.model_id is not None and not await repository.model_belongs_to_brand(
        draft.model_id, draft.brand_id
    ):
        raise ValidationError(
            "O modelo não pertence à marca escolhida.",
            details={"model_id": str(draft.model_id)},
        )
