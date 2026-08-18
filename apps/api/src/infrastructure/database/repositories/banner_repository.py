"""Persistência do banner do topo da home."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.content.entities import HeroBanner, HeroBannerWrite
from src.infrastructure.database.models.content import Banner as BannerModel


def _para_dominio(modelo: BannerModel) -> HeroBanner:
    return HeroBanner(
        id=modelo.id,
        image_url=modelo.image_url,
        image_path=modelo.image_path,
        alt=modelo.alt,
        link_url=modelo.link_url,
        active=modelo.active,
        created_at=modelo.created_at,
        updated_at=modelo.updated_at,
    )


class SqlAlchemyBannerRepository:
    """Trata a tabela como registro único.

    A tabela aceita várias linhas, mas o painel expõe um banner só (ver
    `HeroBanner`). Estas consultas pegam sempre o mais recente: se um dia
    sobrarem linhas de uma versão anterior, o site continua mostrando o que a
    loja gravou por último em vez de escolher uma linha ao acaso.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_active(self) -> HeroBanner | None:
        resultado = await self._session.execute(
            select(BannerModel)
            .where(BannerModel.active.is_(True))
            .order_by(BannerModel.updated_at.desc())
            .limit(1)
        )
        modelo = resultado.scalar_one_or_none()
        return _para_dominio(modelo) if modelo else None

    async def get_current(self) -> HeroBanner | None:
        """O banner gravado, ligado ou desligado — é o que a tela de edição lê."""
        resultado = await self._session.execute(
            select(BannerModel).order_by(BannerModel.updated_at.desc()).limit(1)
        )
        modelo = resultado.scalar_one_or_none()
        return _para_dominio(modelo) if modelo else None

    async def save(self, data: HeroBannerWrite) -> HeroBanner:
        resultado = await self._session.execute(
            select(BannerModel).order_by(BannerModel.updated_at.desc()).limit(1)
        )
        modelo = resultado.scalar_one_or_none()

        if modelo is None:
            modelo = BannerModel()
            self._session.add(modelo)

        modelo.image_url = data.image_url
        modelo.image_path = data.image_path
        modelo.alt = data.alt
        modelo.link_url = data.link_url
        modelo.active = data.active

        await self._session.flush()
        await self._session.refresh(modelo)
        return _para_dominio(modelo)

    async def clear(self) -> HeroBanner | None:
        """Remove o banner e devolve o que foi removido.

        Devolver o registro é o que permite ao caso de uso apagar o arquivo no
        Storage — quem chama precisa do `image_path`, e depois do delete ele já
        não existe mais no banco.
        """
        resultado = await self._session.execute(
            select(BannerModel).order_by(BannerModel.updated_at.desc()).limit(1)
        )
        modelo = resultado.scalar_one_or_none()
        if modelo is None:
            return None

        removido = _para_dominio(modelo)
        await self._session.delete(modelo)
        await self._session.flush()
        return removido
