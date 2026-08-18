"""Artigos — rotas públicas.

O motivo de existirem numa revenda é tráfego: cada artigo é uma URL que o Google
indexa, e quem procura "vale a pena comprar seminovo" chega ao site sem custo de
anúncio. Por isso a listagem e a página são renderizadas no servidor e não
dependem de JavaScript para mostrar o texto.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from src.domain.catalog.value_objects import Pagination
from src.domain.content.enums import ArticleStatus
from src.domain.content.value_objects import ArticleFilters
from src.presentation.v1.deps import (
    FeaturedArticleDep,
    GetArticleDep,
    ListArticlesDep,
    RelatedArticlesDep,
)
from src.presentation.v1.schemas.content import (
    ArticleDetailOut,
    ArticleOut,
    ArticlePageOut,
    ArticleSummaryOut,
)

router = APIRouter(prefix="/articles", tags=["artigos"])

MAX_PAGE_SIZE = 50


@router.get(
    "/featured",
    response_model=ArticleSummaryOut | None,
    summary="Artigo em destaque no topo da home",
)
async def get_featured_article(use_case: FeaturedArticleDep) -> ArticleSummaryOut | None:
    """`null` quando nenhum artigo está marcado — o topo do site fica com a foto
    de vitrine padrão, que é o estado normal.

    Declarada ANTES de `/{slug}`, senão o FastAPI leria "featured" como slug de
    artigo e esta rota nunca seria alcançada.
    """
    artigo = await use_case.execute()
    return ArticleSummaryOut.model_validate(artigo) if artigo else None


@router.get("", response_model=ArticlePageOut, summary="Artigos publicados")
async def list_articles(
    use_case: ListArticlesDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 12,
) -> ArticlePageOut:
    """Só os publicados. O rascunho não existe para o site."""
    result = await use_case.execute(
        ArticleFilters(statuses=[ArticleStatus.PUBLISHED]),
        Pagination(page=page, page_size=page_size),
    )
    return ArticlePageOut.from_page(result)


@router.get("/{slug}", response_model=ArticleDetailOut, summary="Um artigo")
async def get_article(
    slug: str, use_case: GetArticleDep, relacionados: RelatedArticlesDep
) -> ArticleDetailOut:
    """Rascunho responde 404 como se não existisse.

    Devolver "não publicado" contaria que o endereço existe, e bastaria adivinhar
    o slug para ler um texto que a loja ainda está escrevendo.
    """
    artigo = await use_case.execute(slug, published_only=True)
    outros = await relacionados.execute(exclude_id=artigo.id)
    return ArticleDetailOut(
        article=ArticleOut.model_validate(artigo),
        related=[ArticleSummaryOut.model_validate(a) for a in outros],
    )
