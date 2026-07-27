"""Ajusta as descrições dos anúncios para casar com o carro (pós-renomeação).

As descrições tinham sobrado do carro antigo — o Audi RS6 Avant estava descrito
como "SUV compacto", o Camry citava câmbio CVT. Roda uma vez:

  uv run python fix_descriptions.py
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from src.core.database import get_session_factory
from src.infrastructure.database.models.catalog import Vehicle

# slug (novo) -> descrição
DESC: dict[str, str] = {
    "toyota-camry-xse-2022": "Sedã premium, único dono, todas as revisões feitas em concessionária. Bancos em couro, central multimídia e câmera de ré.",
    "ford-expedition-limited-2021": "SUV full-size 3.5 V6, sete lugares e teto solar panorâmico. Garantia de fábrica vigente e IPVA pago.",
    "bmw-m2-competition-2021": "Cupê BMW M2 Competition, motor 3.0 biturbo e câmbio de dupla embreagem. Impecável, revisões na rede BMW.",
    "bmw-m4-competition-2022": "Cupê M4 Competition, 510 cv, bancos esportivos em couro. Estado de zero, procedência garantida.",
    "hyundai-i30-n-2021": "Hot hatch 2.0 turbo, câmbio manual e suspensão esportiva. Todas as revisões em dia.",
    "ford-f-150-raptor-2022": "Picape F-150 Raptor 3.5 V6 EcoBoost, tração 4x4 e suspensão de alta performance. Única dona.",
    "honda-cr-v-touring-2022": "SUV 1.5 turbo, teto solar e bancos em couro. Revisões feitas na concessionária, IPVA quitado.",
    "audi-rs6-avant-2022": "Perua Audi RS6 Avant 4.0 V8 biturbo, 600 cv e tração quattro. Estado excepcional, revisões na rede Audi.",
}


async def main() -> None:
    async with get_session_factory()() as session:
        for slug, desc in DESC.items():
            vehicle = (
                await session.execute(select(Vehicle).where(Vehicle.slug == slug))
            ).scalar_one_or_none()
            if vehicle is None:
                print(f"! não encontrado: {slug}")
                continue
            vehicle.description = desc
            print(f"  ✓ {slug}")
        await session.commit()
        print("\nOK — descrições atualizadas.")


if __name__ == "__main__":
    asyncio.run(main())
