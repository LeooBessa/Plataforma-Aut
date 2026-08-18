"""Entidades de conteúdo — os artigos do site."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from src.domain.content.enums import ArticleStatus


@dataclass(frozen=True, slots=True)
class FaqItem:
    """Uma pergunta e resposta no fim do artigo.

    Vale mais que texto solto: o Google entende bloco de perguntas e às vezes o
    exibe direto no resultado da busca. Para uma revenda, aparecer respondendo
    "vale a pena comprar seminovo?" é tráfego que não custa anúncio.
    """

    question: str
    answer: str


@dataclass(frozen=True, slots=True)
class ArticleWrite:
    """O que o painel envia ao criar ou editar.

    `slug` não entra: ele é derivado do título na primeira gravação e NUNCA muda
    depois. Slug é endereço — se mudar, todo link já compartilhado quebra e o
    Google perde o que tinha indexado.
    """

    title: str
    excerpt: str
    body: str
    status: ArticleStatus
    cover_url: str | None = None
    cover_path: str | None = None
    faq: list[FaqItem] = field(default_factory=list)

    #: Destaca este artigo no topo da home. É um por vez: marcar um desmarca o
    #: anterior, porque o espaço no topo do site é um só.
    featured: bool = False


@dataclass(frozen=True, slots=True)
class ArticleSummary:
    """O que a listagem precisa. Sem o corpo, que é o campo pesado."""

    id: UUID
    slug: str
    title: str
    excerpt: str
    cover_url: str | None
    status: ArticleStatus
    reading_minutes: int
    featured: bool
    published_at: datetime | None
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class Article:
    id: UUID
    slug: str
    title: str
    excerpt: str
    body: str
    cover_url: str | None
    cover_path: str | None
    faq: list[FaqItem]
    status: ArticleStatus
    reading_minutes: int
    featured: bool
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

