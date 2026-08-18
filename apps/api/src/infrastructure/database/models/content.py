from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base
from src.domain.content.enums import ArticleStatus
from src.infrastructure.database.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Article(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Artigo do site, escrito pela loja no painel.

    ----------------------------------------------------------------------------
    O SLUG É ENDEREÇO, E ENDEREÇO NÃO MUDA
    ----------------------------------------------------------------------------
    Ele nasce do título na primeira gravação e fica congelado. Se acompanhasse o
    título, cada correção de digitação quebraria todo link já compartilhado no
    WhatsApp e faria o Google perder o que tinha indexado — que é justamente o
    motivo de o artigo existir.

    ----------------------------------------------------------------------------
    O CORPO É MARKDOWN, GUARDADO COMO TEXTO
    ----------------------------------------------------------------------------
    Não HTML. Guardar HTML significaria renderizá-lo depois, e renderizar HTML
    vindo do banco é a porta clássica de XSS armazenado — o admin é justamente
    quem tem mais poder de causar dano se a conta for comprometida. Markdown é
    convertido em componentes React na hora de exibir, e o React escapa tudo por
    padrão.

    ----------------------------------------------------------------------------
    O FAQ É JSONB, NÃO TABELA
    ----------------------------------------------------------------------------
    Ele só existe dentro do artigo, sempre é lido junto e nunca é consultado
    sozinho. Uma tabela separada traria join e ordenação para não ganhar nada.
    """

    __tablename__ = "articles"
    __table_args__ = (
        # A listagem pública filtra por status e ordena por data de publicação.
        Index("ix_article_status_published", "status", "published_at"),
    )

    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    #: Resumo do cartão na listagem. Separado do corpo de propósito: cortar o
    #: primeiro parágrafo dá um teaser que termina no meio da frase.
    excerpt: Mapped[str] = mapped_column(String(300), nullable=False)

    body: Mapped[str] = mapped_column(Text, nullable=False)

    cover_url: Mapped[str | None] = mapped_column(String(500))
    #: Caminho no Storage. Guardado para poder APAGAR o arquivo quando o artigo
    #: sai — sem ele, cada exclusão deixaria lixo no bucket para sempre.
    cover_path: Mapped[str | None] = mapped_column(String(500))

    faq: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )

    #: Calculado na gravação, não na exibição: o texto não muda entre uma leitura
    #: e outra, e recalcular a cada visita seria trabalho repetido à toa.
    reading_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))

    status: Mapped[ArticleStatus] = mapped_column(
        Enum(
            ArticleStatus,
            name="article_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=ArticleStatus.DRAFT,
        server_default=text("'draft'"),
    )

    #: Marca o artigo que ocupa o topo da home, com a capa dele como banner e um
    #: botão "Ler artigo".
    #:
    #: É UM POR VEZ: marcar um desmarca o anterior. O espaço no topo do site é
    #: um só, e deixar dois marcados obrigaria a escolher um deles na hora de
    #: exibir — a loja veria dois artigos marcados no painel e um só no site.
    #:
    #: Só vale para artigo PUBLICADO. Destacar um rascunho colocaria no topo da
    #: home uma capa que leva a uma página que não existe.
    featured: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false"), index=True
    )

    #: Preenchido na PRIMEIRA publicação e mantido depois. Editar um artigo
    #: publicado não deve fazê-lo pular para o topo da lista como se fosse novo.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

