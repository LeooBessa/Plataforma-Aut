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
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class HeroBannerWrite:
    """O que o painel envia ao trocar a imagem do topo da home."""

    image_url: str
    image_path: str
    alt: str
    link_url: str | None = None
    active: bool = True


@dataclass(frozen=True, slots=True)
class HeroBanner:
    """A imagem que substitui a foto de vitrine no topo da home.

    ----------------------------------------------------------------------------
    É UM REGISTRO SÓ, E ISSO É PROPOSITAL
    ----------------------------------------------------------------------------
    Uma revenda troca o banner quando entra promoção ("feirão", "taxa zero") e
    não volta ao anterior — o de junho não serve em julho. Guardar histórico
    obrigaria a loja a escolher qual está no ar toda vez que abre a tela, para
    resolver um problema que ela não tem.

    A tabela, ainda assim, aceita mais de uma linha. Se um dia houver carrossel
    ou banner agendado, o que muda é o caso de uso, não o schema.

    ----------------------------------------------------------------------------
    `active` EXISTE PARA PODER VOLTAR ATRÁS SEM PERDER A IMAGEM
    ----------------------------------------------------------------------------
    Desligar devolve a foto de vitrine padrão ao topo do site, e a imagem
    enviada continua guardada. Sem isso, "tirar o banner do ar por uma semana"
    significaria excluir e subir de novo depois.
    """

    id: UUID
    image_url: str
    image_path: str
    alt: str
    link_url: str | None
    active: bool
    created_at: datetime
    updated_at: datetime
