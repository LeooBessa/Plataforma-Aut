"""Casos de uso dos artigos."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from src.application.ports import StorageService
from src.core.exceptions import NotFoundError, ValidationError
from src.domain.catalog.value_objects import Page, Pagination
from src.domain.content.entities import Article, ArticleSummary, ArticleWrite
from src.domain.content.enums import ArticleStatus
from src.domain.content.repositories import ArticleRepository
from src.domain.content.value_objects import ArticleFilters

#: Quantos artigos aparecem em "Leia também".
_RELACIONADOS = 3


@dataclass(frozen=True, slots=True)
class SaveArticleUseCase:
    """Cria ou edita. É um caso de uso só porque a regra é a mesma.

    A troca da capa APAGA o arquivo antigo do Storage. Sem isso, cada troca de
    imagem deixaria um arquivo órfão no bucket — invisível, e ocupando espaço
    para sempre num plano gratuito.
    """

    repository: ArticleRepository
    storage: StorageService

    async def execute(self, data: ArticleWrite, *, article_id: UUID | None = None) -> Article:
        _validar(data)

        if article_id is None:
            return await self.repository.create(data)

        anterior = await self.repository.get_by_id(article_id)
        if anterior is None:
            raise NotFoundError("Artigo não encontrado.")

        atualizado = await self.repository.update(article_id, data)
        if atualizado is None:
            raise NotFoundError("Artigo não encontrado.")

        if anterior.cover_path and anterior.cover_path != data.cover_path:
            await self.storage.delete(path=anterior.cover_path)

        return atualizado


@dataclass(frozen=True, slots=True)
class DeleteArticleUseCase:
    repository: ArticleRepository
    storage: StorageService

    async def execute(self, article_id: UUID) -> None:
        apagado = await self.repository.delete(article_id)
        if apagado is None:
            raise NotFoundError("Artigo não encontrado.")
        if apagado.cover_path:
            await self.storage.delete(path=apagado.cover_path)


@dataclass(frozen=True, slots=True)
class GetArticleUseCase:
    """Busca por slug. `published_only` é o que separa o site do painel.

    No site, rascunho tem de responder 404 como se não existisse — senão bastaria
    adivinhar o endereço para ler um texto que a loja ainda está escrevendo.
    """

    repository: ArticleRepository

    async def execute(self, slug: str, *, published_only: bool = True) -> Article:
        artigo = await self.repository.get_by_slug(slug, published_only=published_only)
        if artigo is None:
            raise NotFoundError("Artigo não encontrado.")
        return artigo


@dataclass(frozen=True, slots=True)
class GetAdminArticleUseCase:
    repository: ArticleRepository

    async def execute(self, article_id: UUID) -> Article:
        artigo = await self.repository.get_by_id(article_id)
        if artigo is None:
            raise NotFoundError("Artigo não encontrado.")
        return artigo


@dataclass(frozen=True, slots=True)
class ListArticlesUseCase:
    repository: ArticleRepository

    async def execute(
        self, filters: ArticleFilters, pagination: Pagination
    ) -> Page[ArticleSummary]:
        return await self.repository.search(filters, pagination)


@dataclass(frozen=True, slots=True)
class RelatedArticlesUseCase:
    """"Leia também" — os mais recentes, exceto o que está aberto.

    Sem categoria nem tag de propósito: com poucos artigos, qualquer critério de
    similaridade devolveria os mesmos três de qualquer jeito, e ainda pediria uma
    taxonomia que a loja teria de manter.
    """

    repository: ArticleRepository

    async def execute(self, *, exclude_id: UUID | None = None) -> list[ArticleSummary]:
        return await self.repository.latest_published(limit=_RELACIONADOS, exclude_id=exclude_id)


def _validar(data: ArticleWrite) -> None:
    """Regras que o schema não expressa, e que valem para qualquer entrada."""
    if not data.title.strip():
        raise ValidationError("O artigo precisa de um título.")
    if not data.body.strip():
        raise ValidationError("O artigo precisa de um texto.")

    # Publicar sem capa passa, mas o cartão da listagem fica com um buraco
    # cinzento. Melhor barrar aqui do que descobrir no site.
    if data.status is ArticleStatus.PUBLISHED and not data.cover_url:
        raise ValidationError("Adicione uma imagem de capa antes de publicar.")

    for item in data.faq:
        if not item.question.strip() or not item.answer.strip():
            raise ValidationError("Toda pergunta do FAQ precisa de uma resposta.")
