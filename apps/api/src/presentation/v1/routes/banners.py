"""Banner do topo da home — rota pública.

Uma rota só, e ela pode devolver vazio. Esse é o estado normal enquanto a loja
não subiu banner nenhum: o site cai na foto de vitrine padrão e nada quebra.
"""

from __future__ import annotations

from fastapi import APIRouter

from src.presentation.v1.deps import GetHeroBannerDep
from src.presentation.v1.schemas.content import BannerOut

router = APIRouter(prefix="/banner", tags=["banner"])


@router.get("", response_model=BannerOut | None, summary="Banner ativo do topo da home")
async def get_hero_banner(use_case: GetHeroBannerDep) -> BannerOut | None:
    """`null` quando não há banner ligado — não é erro, é o padrão do site."""
    banner = await use_case.execute()
    return BannerOut.model_validate(banner) if banner else None
