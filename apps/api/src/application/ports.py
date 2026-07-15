"""Portas de saída da aplicação: serviços externos que o domínio precisa, mas
não quer conhecer.

Os casos de uso dependem destas interfaces. As implementações concretas (Resend,
Supabase Storage) vivem em `infrastructure/` e são amarradas em `deps.py`.

É isso que permite testar o agendamento sem enviar e-mail de verdade, e trocar
de provedor mexendo num arquivo só.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class EmailSender(Protocol):
    async def send(self, *, to: str, subject: str, html: str) -> bool:
        """Envia um e-mail. Devolve True se saiu.

        **Nunca levanta exceção.** É proposital: quem chama não pode quebrar
        porque o provedor de e-mail caiu. Ver `NotifyOnFailure` em
        `CreateAppointmentUseCase`.
        """
        ...


@dataclass(frozen=True, slots=True)
class SignedUpload:
    """Autorização temporária para o browser escrever UM arquivo no Storage."""

    upload_url: str
    token: str
    storage_path: str
    public_url: str


class StorageService(Protocol):
    async def create_signed_upload(self, *, path: str) -> SignedUpload:
        """Emite uma URL assinada para upload direto do browser.

        A foto não passa pelo backend: a função serverless tem limite de tamanho
        de corpo de requisição, e uma imagem o estoura. O browser comprime, pede
        esta autorização e envia direto ao Storage.
        """
        ...

    async def delete(self, *, path: str) -> bool: ...


class RevalidationService(Protocol):
    async def revalidate(self, tags: list[str]) -> bool:
        """Pede ao frontend que regenere as páginas com estas tags.

        Fecha o ciclo do ISR: quando o admin muda um anúncio, o site atualiza em
        segundos em vez de esperar o intervalo de revalidação.

        Como o `EmailSender`, **nunca levanta exceção** — a operação de negócio
        (salvar o anúncio) não pode falhar porque o frontend não respondeu ao
        aviso de cache. No pior caso, a página se corrige sozinha no próximo ciclo.
        """
        ...
