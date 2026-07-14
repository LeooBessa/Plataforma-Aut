"""Casos de uso do catálogo público.

Cada caso de uso é uma classe com um único método `execute` — uma unidade de
intenção do negócio. Eles dependem da *interface* do repositório, nunca da
implementação; por isso são testáveis com um fake, sem banco.

O que estas classes carregam de verdade é a regra de visibilidade pública. Ela
está aqui, num lugar só, e não espalhada por cada endpoint — porque o dia em que
ela estiver espalhada é o dia em que um deles vai esquecê-la e publicar rascunho.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.core.exceptions import NotFoundError
from src.domain.catalog.entities import FilterOptions, VehicleDetail, VehicleSummary
from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.repositories import VehicleRepository
from src.domain.catalog.value_objects import Page, Pagination, VehicleFilters

# Estados que aparecem na LISTAGEM pública.
# RESERVED continua listado de propósito: gera urgência ("alguém já se
# interessou") e ainda capta lead. DRAFT, SOLD e ARCHIVED ficam de fora.
PUBLIC_LISTING_STATUSES = [VehicleStatus.ACTIVE, VehicleStatus.RESERVED]

# Estados cuja PÁGINA individual continua de pé.
# SOLD entra aqui, mas não na listagem acima: a página de um carro vendido já
# acumulou posição no Google e links de fora. Devolver 404 nela joga esse SEO no
# lixo e entrega um link quebrado a quem chega pela busca. A página permanece,
# com selo de vendido e uma chamada para ver veículos parecidos.
PUBLIC_DETAIL_STATUSES = [VehicleStatus.ACTIVE, VehicleStatus.RESERVED, VehicleStatus.SOLD]


@dataclass(frozen=True, slots=True)
class ListVehiclesUseCase:
    repository: VehicleRepository

    async def execute(
        self, filters: VehicleFilters, pagination: Pagination
    ) -> Page[VehicleSummary]:
        return await self.repository.search(filters, pagination, statuses=PUBLIC_LISTING_STATUSES)


@dataclass(frozen=True, slots=True)
class GetVehicleBySlugUseCase:
    repository: VehicleRepository

    async def execute(self, slug: str) -> VehicleDetail:
        vehicle = await self.repository.get_by_slug(slug, statuses=PUBLIC_DETAIL_STATUSES)

        if vehicle is None:
            # Mensagem propositalmente igual para "não existe" e "não está
            # público". Diferenciar as duas contaria a um curioso que o anúncio
            # existe mas está oculto.
            raise NotFoundError("Veículo não encontrado.", details={"slug": slug})

        return vehicle


@dataclass(frozen=True, slots=True)
class ListFeaturedVehiclesUseCase:
    repository: VehicleRepository

    async def execute(self, limit: int = 6) -> list[VehicleSummary]:
        return await self.repository.list_featured(limit, statuses=PUBLIC_LISTING_STATUSES)


@dataclass(frozen=True, slots=True)
class GetFilterOptionsUseCase:
    """Monta as opções do formulário de busca a partir do que existe no banco.

    Só considera veículos publicamente visíveis: oferecer o filtro "Curitiba"
    quando o único carro de Curitiba está arquivado leva o usuário a uma busca
    vazia — e a uma sensação de site quebrado.
    """

    repository: VehicleRepository

    async def execute(self) -> FilterOptions:
        return await self.repository.get_filter_options(statuses=PUBLIC_LISTING_STATUSES)
