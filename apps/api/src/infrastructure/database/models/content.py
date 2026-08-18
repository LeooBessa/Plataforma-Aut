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

    #: Preenchido na PRIMEIRA publicação e mantido depois. Editar um artigo
    #: publicado não deve fazê-lo pular para o topo da lista como se fosse novo.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Banner(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A imagem do topo da home, trocada pela loja no painel.

    ----------------------------------------------------------------------------
    A MESMA IMAGEM É RECORTADA DE DOIS JEITOS MUITO DIFERENTES
    ----------------------------------------------------------------------------
    No desktop ela é um painel alto e cortado na diagonal; no celular, uma faixa
    16:9. Uma foto pensada só para o desktop perde o assunto no celular, e o
    contrário também. É por isso que o formato pedido é QUADRADO (1600x1600): é o
    único que sobrevive aos dois recortes com folga.

    O painel mostra os dois recortes lado a lado no momento do envio — é a tela
    que impede o banner ruim, não este comentário.

    ----------------------------------------------------------------------------
    `alt` É OBRIGATÓRIO
    ----------------------------------------------------------------------------
    O banner costuma trazer a promoção escrita DENTRO da imagem ("taxa zero até
    domingo"). Sem `alt`, essa informação não existe para quem usa leitor de tela
    e nem para o Google. Deixar o campo opcional garantiria que ficasse vazio.
    """

    __tablename__ = "banners"

    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    #: Caminho no Storage, para APAGAR o arquivo quando a imagem for trocada.
    #: Sem ele cada troca deixaria um arquivo órfão no bucket para sempre.
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)

    alt: Mapped[str] = mapped_column(String(200), nullable=False)

    #: Para onde o banner leva ao ser clicado. Vazio = banner só decorativo.
    #: Uma promoção que não leva a lugar nenhum desperdiça o clique de quem se
    #: interessou.
    link_url: Mapped[str | None] = mapped_column(String(500))

    #: Desligado devolve a foto de vitrine padrão ao topo do site, sem apagar a
    #: imagem enviada.
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
