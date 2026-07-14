"""Envio de e-mail.

Duas implementações da mesma porta. Qual delas é usada depende só de haver ou
não uma chave configurada — decidido em `deps.py`, e nenhum caso de uso sabe a
diferença.
"""

from __future__ import annotations

import logging

import httpx

from src.core.config import get_settings

logger = logging.getLogger(__name__)

_RESEND_ENDPOINT = "https://api.resend.com/emails"

# Timeout curto e deliberado. Este envio acontece DENTRO da requisição do
# cliente que está agendando a visita (serverless não tem fila nem worker). Se o
# provedor travar, o cliente fica olhando um spinner. Cinco segundos é o teto do
# que vale a pena esperar por uma notificação — o lead já está salvo no banco de
# qualquer forma.
_TIMEOUT_SECONDS = 5.0


class ResendEmailSender:
    """Envia via Resend. NUNCA levanta exceção — devolve False e loga."""

    async def send(self, *, to: str, subject: str, html: str) -> bool:
        settings = get_settings()
        api_key = settings.resend_api_key.get_secret_value()

        if not api_key:
            logger.warning("RESEND_API_KEY não configurada; e-mail não enviado.")
            return False

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    _RESEND_ENDPOINT,
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "from": settings.email_from,
                        "to": [to],
                        "subject": subject,
                        "html": html,
                    },
                )
        except httpx.HTTPError as exc:
            # Engolir a exceção é o contrato desta porta, e é uma decisão de
            # negócio: um agendamento salvo com e-mail não entregue vale muito
            # mais do que um agendamento perdido porque o e-mail falhou.
            logger.exception("Falha de rede ao enviar e-mail: %s", exc)
            return False

        if response.status_code >= 400:
            logger.error("Resend recusou o e-mail (%s): %s", response.status_code, response.text)
            return False

        return True


class LoggingEmailSender:
    """Só escreve no log. É o que roda em desenvolvimento e nos testes.

    Existir esta implementação é o que permite testar o agendamento inteiro sem
    depender de rede, sem chave de API e sem enviar e-mail de verdade para
    ninguém.
    """

    async def send(self, *, to: str, subject: str, html: str) -> bool:
        logger.info("[e-mail simulado] para=%s assunto=%s", to, subject)
        return True
