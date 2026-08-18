from __future__ import annotations

from enum import StrEnum


class ArticleStatus(StrEnum):
    """Rascunho ou publicado.

    O rascunho existe para que a loja possa escrever em várias sessões sem que
    um texto pela metade apareça no site. Publicar é um ato explícito.
    """

    DRAFT = "draft"
    PUBLISHED = "published"
