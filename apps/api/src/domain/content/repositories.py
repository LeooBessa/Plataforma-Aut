"""Porta de persistência dos artigos."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from src.domain.catalog.value_objects import Page, Pagination
from src.domain.content.entities import (
    Article,
    ArticleSummary,
    ArticleWrite,
    HeroBanner,
    HeroBannerWrite,
)
from src.domain.content.value_objects import ArticleFilters


class ArticleRepository(Protocol):
    async def create(self, data: ArticleWrite) -> Article: ...

    async def update(self, article_id: UUID, data: ArticleWrite) -> Article | None: ...

    async def delete(self, article_id: UUID) -> Article | None: ...

    async def get_by_id(self, article_id: UUID) -> Article | None: ...

    async def get_by_slug(self, slug: str, *, published_only: bool) -> Article | None: ...

    async def search(
        self, filters: ArticleFilters, pagination: Pagination
    ) -> Page[ArticleSummary]: ...

    async def latest_published(
        self, *, limit: int, exclude_id: UUID | None = None
    ) -> list[ArticleSummary]: ...


class BannerRepository(Protocol):
    """Porta do banner do topo da home.

    `save` é upsert de propósito: do ponto de vista da loja existe UMA imagem de
    topo, que ela troca. Separar em criar/editar obrigaria a tela a saber se já
    existe banner antes de gravar, sem nenhum ganho.
    """

    async def get_active(self) -> HeroBanner | None: ...

    async def get_current(self) -> HeroBanner | None: ...

    async def save(self, data: HeroBannerWrite) -> HeroBanner: ...

    async def clear(self) -> HeroBanner | None: ...
