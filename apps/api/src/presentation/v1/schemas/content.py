"""Schemas dos artigos."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.domain.catalog.value_objects import Page
from src.domain.content.entities import ArticleSummary, ArticleWrite, FaqItem
from src.domain.content.enums import ArticleStatus


class FaqItemIn(BaseModel):
    question: str = Field(min_length=3, max_length=200)
    answer: str = Field(min_length=3, max_length=2000)


class FaqItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    question: str
    answer: str


class ArticleIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    excerpt: str = Field(min_length=10, max_length=300)
    body: str = Field(min_length=10)
    status: ArticleStatus = ArticleStatus.DRAFT
    cover_url: str | None = Field(default=None, max_length=500)
    cover_path: str | None = Field(default=None, max_length=500)
    faq: list[FaqItemIn] = Field(default_factory=list, max_length=10)

    #: Coloca este artigo no topo da home, com a capa dele como banner e um
    #: botão "Ler artigo". É um por vez: marcar um desmarca o anterior.
    featured: bool = False

    def to_domain(self) -> ArticleWrite:
        return ArticleWrite(
            title=self.title.strip(),
            excerpt=self.excerpt.strip(),
            body=self.body.strip(),
            status=self.status,
            cover_url=self.cover_url,
            cover_path=self.cover_path,
            faq=[FaqItem(question=f.question.strip(), answer=f.answer.strip()) for f in self.faq],
            featured=self.featured,
        )


class ArticleSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class ArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    title: str
    excerpt: str
    body: str
    cover_url: str | None
    cover_path: str | None
    faq: list[FaqItemOut]
    status: ArticleStatus
    reading_minutes: int
    featured: bool
    published_at: datetime | None
    updated_at: datetime


class ArticleDetailOut(BaseModel):
    """O artigo mais o "leia também", numa resposta só.

    Duas chamadas separadas dobrariam a latência de uma página que é lida do
    início ao fim — e os relacionados aparecem no rodapé dela, sempre.
    """

    article: ArticleOut
    related: list[ArticleSummaryOut]


class ArticlePageOut(BaseModel):
    items: list[ArticleSummaryOut]
    meta: dict[str, int]

    @classmethod
    def from_page(cls, page: Page[ArticleSummary]) -> ArticlePageOut:
        return cls(
            items=[ArticleSummaryOut.model_validate(a) for a in page.items],
            meta={"total": page.total, "page": page.page, "page_size": page.page_size},
        )

