"""Headers de segurança em toda resposta da API.

Estes headers instruem o navegador a se defender. São baratos (uma linha por
resposta) e fecham classes inteiras de ataque — o tipo de coisa que um
verificador de segurança cobra e que custa caro adicionar depois de um incidente.

A API serve JSON, não HTML, então alguns headers (como CSP para scripts) fazem
mais sentido no frontend — que os define à parte, em next.config. Aqui ficam os
que protegem os consumidores da API.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)

        # Impede o navegador de "adivinhar" o tipo do conteúdo. Sem isto, um
        # arquivo servido como JSON mas com cara de HTML poderia ser executado
        # como HTML — um vetor de XSS.
        response.headers["X-Content-Type-Options"] = "nosniff"

        # A API nunca deve ser renderizada dentro de um <iframe>: não há tela para
        # embutir, e permitir isso abriria clickjacking.
        response.headers["X-Frame-Options"] = "DENY"

        # Não vaza a URL da API (que pode conter ids) para sites de terceiros no
        # header Referer.
        response.headers["Referrer-Policy"] = "no-referrer"

        # Desliga APIs sensíveis do navegador para qualquer contexto servido pela
        # API. Defesa em profundidade — a API não tem UI que as use.
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        return response
