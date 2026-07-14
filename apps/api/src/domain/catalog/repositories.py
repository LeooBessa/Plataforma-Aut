"""Portas de persistência do catálogo.

Estas são *interfaces*, declaradas no domínio e implementadas na infraestrutura.
É a inversão de dependência do SOLID em forma concreta: o domínio dita o
contrato, o Postgres obedece — e não o contrário.

Consequências práticas:
- Os casos de uso são testáveis com um repositório falso, sem subir banco.
- Trocar Postgres por outra coisa não toca em nenhuma regra de negócio.
- O domínio não importa SQLAlchemy. Se importasse, essa camada seria decoração.
"""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from src.domain.catalog.entities import (
    AdminCatalog,
    FilterOptions,
    Image,
    VehicleDetail,
    VehicleSummary,
)
from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.value_objects import Page, Pagination, VehicleFilters
from src.domain.catalog.write_models import ImageWrite, VehicleWrite


class VehicleRepository(Protocol):
    async def search(
        self,
        filters: VehicleFilters,
        pagination: Pagination,
        *,
        statuses: list[VehicleStatus],
    ) -> Page[VehicleSummary]:
        """Busca paginada.

        `statuses` é explícito e obrigatório: é o que impede um rascunho ou um
        anúncio arquivado de vazar para o site público. Deixá-lo opcional, com
        um default permissivo, seria confiar que ninguém vai esquecer de passá-lo
        — e alguém vai.
        """
        ...

    async def get_by_slug(
        self, slug: str, *, statuses: list[VehicleStatus]
    ) -> VehicleDetail | None: ...

    async def list_featured(
        self, limit: int, *, statuses: list[VehicleStatus]
    ) -> list[VehicleSummary]: ...

    async def get_filter_options(self, *, statuses: list[VehicleStatus]) -> FilterOptions: ...

    async def increment_views(self, vehicle_id: UUID) -> None: ...


class VehicleAdminRepository(Protocol):
    """Escrita e leitura administrativa.

    Interface separada da pública, e não é burocracia: os métodos aqui enxergam
    TODOS os status, inclusive rascunho e arquivado. Se estivessem no mesmo
    contrato da leitura pública, seria fácil (e silencioso) chamar o método
    errado num endpoint público e vazar anúncio não publicado.

    A separação faz o compilador vigiar aquilo que a disciplina humana esquece.
    """

    async def get_by_id(self, vehicle_id: UUID) -> VehicleDetail | None:
        """Qualquer status — é a visão do admin."""
        ...

    async def get_catalog(self) -> AdminCatalog:
        """TODAS as marcas, modelos e opcionais — mesmo os sem veículo algum.

        Diferente de `get_filter_options`, que só mostra o que tem anúncio
        publicado. Ver o comentário em `AdminCatalog`.
        """
        ...

    async def search_admin(
        self,
        filters: VehicleFilters,
        pagination: Pagination,
        *,
        statuses: list[VehicleStatus] | None = None,
    ) -> Page[VehicleSummary]: ...

    async def create(self, data: VehicleWrite, created_by: UUID) -> VehicleDetail: ...

    async def update(self, vehicle_id: UUID, data: VehicleWrite) -> VehicleDetail | None: ...

    async def change_status(
        self, vehicle_id: UUID, status: VehicleStatus
    ) -> VehicleDetail | None: ...

    async def duplicate(self, vehicle_id: UUID, created_by: UUID) -> VehicleDetail | None: ...

    async def delete(self, vehicle_id: UUID) -> bool:
        """Remoção definitiva. Só o SUPER_ADMIN, e só se não houver agendamentos.

        A exclusão do dia a dia é o arquivamento (`status = ARCHIVED`). Apagar de
        verdade um anúncio com leads destruiria o histórico de quem se interessou
        por ele — e o banco recusa, via ondelete=RESTRICT.
        """
        ...

    # --- imagens ---

    async def add_image(self, vehicle_id: UUID, image: ImageWrite) -> Image | None: ...

    async def delete_image(self, image_id: UUID) -> str | None:
        """Devolve o `storage_path` do arquivo removido, para apagá-lo no Storage."""
        ...

    async def reorder_images(self, vehicle_id: UUID, image_ids: list[UUID]) -> bool: ...

    async def set_cover_image(self, vehicle_id: UUID, image_id: UUID) -> bool: ...
