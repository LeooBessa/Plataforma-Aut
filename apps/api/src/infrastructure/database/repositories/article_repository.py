"""Implementação Postgres do repositório de artigos."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from uuid import UUID

from slugify import slugify
from sqlalchemy import ColumnElement, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.catalog.value_objects import Page, Pagination
from src.domain.content.entities import Article, ArticleSummary, ArticleWrite, FaqItem
from src.domain.content.enums import ArticleStatus
from src.domain.content.value_objects import ArticleFilters
from src.infrastructure.database.models import Article as ArticleModel

#: Palavras por minuto de leitura. 200 é a média para texto corrido em
#: português; o número exato importa menos que a estimativa ser honesta.
_PALAVRAS_POR_MINUTO = 200


def _minutos_de_leitura(corpo: str) -> int:
    """Sempre ao menos 1: "0 min de leitura" não quer dizer nada."""
    palavras = len(re.findall(r"\S+", corpo))
    return max(1, round(palavras / _PALAVRAS_POR_MINUTO))


class SqlAlchemyArticleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _slug_livre(self, titulo: str) -> str:
        """Slug do título, com sufixo numérico se já existir.

        Dois artigos podem legitimamente se chamar "Como escolher seu seminovo"
        em anos diferentes. Em vez de recusar a criação, o segundo vira
        `...-2` — a loja não perde o texto por causa de um detalhe de endereço.
        """
        base = slugify(titulo)[:180] or "artigo"
        candidato, n = base, 1
        while await self._session.scalar(
            select(ArticleModel.id).where(ArticleModel.slug == candidato)
        ):
            n += 1
            candidato = f"{base}-{n}"
        return candidato

    async def create(self, data: ArticleWrite) -> Article:
        agora = datetime.now(UTC)
        modelo = ArticleModel(
            slug=await self._slug_livre(data.title),
            title=data.title,
            excerpt=data.excerpt,
            body=data.body,
            cover_url=data.cover_url,
            cover_path=data.cover_path,
            faq=[{"question": f.question, "answer": f.answer} for f in data.faq],
            reading_minutes=_minutos_de_leitura(data.body),
            status=data.status,
            featured=data.featured,
            published_at=agora if data.status is ArticleStatus.PUBLISHED else None,
        )
        if data.featured:
            await self._desmarcar_outros()
        self._session.add(modelo)
        await self._session.flush()
        await self._session.refresh(modelo)
        return _para_entidade(modelo)

    async def update(self, article_id: UUID, data: ArticleWrite) -> Article | None:
        modelo = await self._session.get(ArticleModel, article_id)
        if modelo is None:
            return None

        # O SLUG NÃO MUDA, mesmo que o título mude. Endereço já compartilhado
        # não pode quebrar por causa de uma correção de digitação.
        modelo.title = data.title
        modelo.excerpt = data.excerpt
        modelo.body = data.body
        modelo.cover_url = data.cover_url
        modelo.cover_path = data.cover_path
        modelo.faq = [{"question": f.question, "answer": f.answer} for f in data.faq]
        modelo.reading_minutes = _minutos_de_leitura(data.body)
        modelo.status = data.status

        # Marcar este DESMARCA os outros, antes de gravar o novo valor. O topo
        # da home é um espaço só; dois artigos marcados obrigariam a escolher um
        # na hora de exibir, e o painel mostraria dois destaques para um único
        # lugar no site.
        if data.featured and not modelo.featured:
            await self._desmarcar_outros(exceto=article_id)
        modelo.featured = data.featured

        # Carimba a data na PRIMEIRA publicação e nunca mais. Editar um artigo
        # antigo não deve fazê-lo pular para o topo como se fosse novo.
        if data.status is ArticleStatus.PUBLISHED and modelo.published_at is None:
            modelo.published_at = datetime.now(UTC)

        await self._session.flush()
        await self._session.refresh(modelo)
        return _para_entidade(modelo)

    async def delete(self, article_id: UUID) -> Article | None:
        """Devolve o artigo apagado para o caso de uso poder limpar a capa do
        Storage — sem isso, cada exclusão deixaria um arquivo órfão no bucket."""
        modelo = await self._session.get(ArticleModel, article_id)
        if modelo is None:
            return None
        entidade = _para_entidade(modelo)
        await self._session.delete(modelo)
        await self._session.flush()
        return entidade

    async def get_by_id(self, article_id: UUID) -> Article | None:
        modelo = await self._session.get(ArticleModel, article_id)
        return _para_entidade(modelo) if modelo else None

    async def get_by_slug(self, slug: str, *, published_only: bool) -> Article | None:
        condicoes: list[ColumnElement[bool]] = [ArticleModel.slug == slug]
        if published_only:
            condicoes.append(ArticleModel.status == ArticleStatus.PUBLISHED)
        modelo = await self._session.scalar(select(ArticleModel).where(*condicoes))
        return _para_entidade(modelo) if modelo else None

    async def search(
        self, filters: ArticleFilters, pagination: Pagination
    ) -> Page[ArticleSummary]:
        condicoes: list[ColumnElement[bool]] = []
        if filters.statuses:
            condicoes.append(ArticleModel.status.in_(filters.statuses))
        if filters.query:
            termo = f"%{filters.query.strip()}%"
            condicoes.append(
                or_(ArticleModel.title.ilike(termo), ArticleModel.excerpt.ilike(termo))
            )

        total = await self._session.scalar(
            select(func.count()).select_from(ArticleModel).where(*condicoes)
        )

        linhas = await self._session.scalars(
            select(ArticleModel)
            .where(*condicoes)
            # Publicados pela data de publicação; rascunho ainda não tem data, e
            # `NULLS FIRST` o mantém no topo do painel, que é onde ele deve estar
            # para ser terminado.
            .order_by(ArticleModel.published_at.desc().nullsfirst(), ArticleModel.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )

        return Page(
            items=[_para_resumo(m) for m in linhas],
            total=total or 0,
            page=pagination.page,
            page_size=pagination.page_size,
        )

    async def featured(self) -> ArticleSummary | None:
        """O artigo em destaque no topo da home.

        Exige PUBLICADO além de marcado: se um artigo destacado for despublicado
        pelo painel, o topo do site volta sozinho à foto de vitrine em vez de
        apontar para uma página que sumiu.
        """
        modelo = await self._session.scalar(
            select(ArticleModel)
            .where(
                ArticleModel.featured.is_(True),
                ArticleModel.status == ArticleStatus.PUBLISHED,
            )
            .limit(1)
        )
        return _para_resumo(modelo) if modelo else None

    async def _desmarcar_outros(self, *, exceto: UUID | None = None) -> None:
        condicoes: list[ColumnElement[bool]] = [ArticleModel.featured.is_(True)]
        if exceto is not None:
            condicoes.append(ArticleModel.id != exceto)
        await self._session.execute(
            update(ArticleModel).where(*condicoes).values(featured=False)
        )

    async def latest_published(
        self, *, limit: int, exclude_id: UUID | None = None
    ) -> list[ArticleSummary]:
        condicoes: list[ColumnElement[bool]] = [ArticleModel.status == ArticleStatus.PUBLISHED]
        if exclude_id is not None:
            condicoes.append(ArticleModel.id != exclude_id)
        linhas = await self._session.scalars(
            select(ArticleModel)
            .where(*condicoes)
            .order_by(ArticleModel.published_at.desc())
            .limit(limit)
        )
        return [_para_resumo(m) for m in linhas]


def _para_resumo(m: ArticleModel) -> ArticleSummary:
    return ArticleSummary(
        id=m.id,
        slug=m.slug,
        title=m.title,
        excerpt=m.excerpt,
        cover_url=m.cover_url,
        status=m.status,
        reading_minutes=m.reading_minutes,
        featured=m.featured,
        published_at=m.published_at,
        updated_at=m.updated_at,
    )


def _para_entidade(m: ArticleModel) -> Article:
    return Article(
        id=m.id,
        slug=m.slug,
        title=m.title,
        excerpt=m.excerpt,
        body=m.body,
        cover_url=m.cover_url,
        cover_path=m.cover_path,
        faq=[FaqItem(question=f.get("question", ""), answer=f.get("answer", "")) for f in m.faq],
        status=m.status,
        reading_minutes=m.reading_minutes,
        featured=m.featured,
        published_at=m.published_at,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )
