"""Supabase Storage.

O fluxo de upload é o coração da mitigação do limite de payload do serverless:

    browser  --(1) pede autorização-->  backend
    backend  --(2) devolve signed URL-->  browser
    browser  --(3) envia o arquivo DIRETO-->  Supabase Storage
    browser  --(4) confirma-->  backend  (grava o registro no banco)

A imagem nunca atravessa a função serverless. Isso resolve três coisas de uma
vez: o limite de tamanho do corpo da requisição, o custo de banda, e a lentidão
de fazer o backend reenviar bytes que ele não precisa ver.

A defesa não fica só aqui: o próprio bucket está configurado para aceitar apenas
imagens e no máximo 5 MB. Ou seja, mesmo de posse de uma URL assinada, ninguém
sobe um executável de 500 MB — o Storage recusa.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import PurePosixPath

import httpx

from src.application.ports import SignedUpload
from src.core.config import get_settings
from src.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 10.0

# Espelha a política do bucket. Validar aqui também não é redundância inútil: dá
# ao admin uma mensagem clara ("envie JPG, PNG ou WebP") em vez de um erro cru
# do Storage depois que ele já esperou o upload terminar.
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
}


def build_storage_path(vehicle_id: uuid.UUID, content_type: str) -> str:
    """Caminho do arquivo no bucket.

    O nome é gerado por nós, e o nome original do arquivo é DESCARTADO. Isso não
    é preciosismo: um nome vindo do cliente pode conter `../` (path traversal),
    caracteres que quebram URLs, ou colidir com um arquivo já existente e
    sobrescrever a foto de outro anúncio.
    """
    extension = ALLOWED_CONTENT_TYPES.get(content_type)
    if extension is None:
        raise ValidationError(
            "Formato de imagem não suportado. Envie JPG, PNG, WebP ou AVIF.",
            details={"content_type": content_type},
        )

    return str(PurePosixPath("vehicles") / str(vehicle_id) / f"{uuid.uuid4().hex}{extension}")


class SupabaseStorageService:
    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.supabase_url.rstrip("/")
        self._key = settings.supabase_service_role_key.get_secret_value()
        self._bucket = settings.supabase_storage_bucket

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._key}", "apikey": self._key}

    def public_url(self, path: str) -> str:
        return f"{self._base_url}/storage/v1/object/public/{self._bucket}/{path}"

    async def create_signed_upload(self, *, path: str) -> SignedUpload:
        if not self._base_url or not self._key:
            raise ValidationError("Storage não configurado (SUPABASE_URL / chave ausente).")

        url = f"{self._base_url}/storage/v1/object/upload/sign/{self._bucket}/{path}"

        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=self._headers)

        if response.status_code >= 400:
            logger.error(
                "Supabase recusou a assinatura de upload (%s): %s",
                response.status_code,
                response.text,
            )
            raise ValidationError("Não foi possível preparar o upload da imagem.")

        data = response.json()
        token = str(data["token"])

        return SignedUpload(
            # O browser faz PUT nesta URL com o token. A autorização é válida
            # para ESTE caminho e por tempo limitado — não é uma chave mestra.
            upload_url=f"{self._base_url}/storage/v1/object/upload/sign/{self._bucket}/{path}",
            token=token,
            storage_path=path,
            public_url=self.public_url(path),
        )

    async def delete(self, *, path: str) -> bool:
        url = f"{self._base_url}/storage/v1/object/{self._bucket}/{path}"

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.delete(url, headers=self._headers)
        except httpx.HTTPError as exc:
            logger.exception("Falha ao apagar %s do Storage: %s", path, exc)
            return False

        if response.status_code >= 400:
            # Não levanta exceção: o registro no banco já foi (ou será) removido.
            # Um arquivo órfão no Storage é lixo barato; um erro 500 na cara do
            # admin, que fica sem saber se a foto sumiu ou não, é pior.
            logger.error("Storage recusou o delete de %s: %s", path, response.text)
            return False

        return True
