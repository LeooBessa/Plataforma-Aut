"""Filtros da listagem de artigos."""

from __future__ import annotations

from dataclasses import dataclass, field

from src.domain.content.enums import ArticleStatus


@dataclass(frozen=True, slots=True)
class ArticleFilters:
    query: str | None = None
    statuses: list[ArticleStatus] = field(default_factory=list)
