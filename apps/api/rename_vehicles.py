"""Renomeia os 8 veículos de demonstração para casar com as fotos reais.

As fotos do estoque são de carros premium (BMW M2/M4, Audi RS6, Ford Raptor…),
mas os nomes tinham ficado como carros populares — nada batia. Este script
repoint​a cada anúncio para o carro que a foto realmente mostra, criando as
marcas/modelos que faltam (BMW, Audi, Ford…).

Roda uma vez, contra o mesmo banco da API:  uv run python rename_vehicles.py
"""

from __future__ import annotations

import asyncio

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.core.database import get_session_factory
from src.domain.catalog.enums import BodyType, FuelType, TransmissionType
from src.infrastructure.database.models.catalog import Brand, Vehicle, VehicleModel

# current_slug -> novo carro (o que a foto mostra)
MAP: dict[str, dict] = {
    "toyota-corolla-xei-2-0-flex-2023": dict(
        brand="Toyota", model="Camry", version="XSE", body="sedan",
        fuel="gasoline", trans="automatic", color="Cinza",
        price=245900, mileage=28000, engine="2.5", hp=209, doors=4, ym=2022, yf=2022),
    "jeep-compass-longitude-1-3-t270-2023": dict(
        brand="Ford", model="Expedition", version="Limited", body="suv",
        fuel="gasoline", trans="automatic", color="Branco",
        price=520000, mileage=41000, engine="3.5 V6", hp=380, doors=4, ym=2021, yf=2021),
    "renault-kwid-zen-1-0-2024": dict(
        brand="BMW", model="M2", version="Competition", body="coupe",
        fuel="gasoline", trans="dual_clutch", color="Azul",
        price=549900, mileage=18000, engine="3.0", hp=410, doors=2, ym=2021, yf=2021),
    "honda-civic-exl-2-0-cvt-2021": dict(
        brand="BMW", model="M4", version="Competition", body="coupe",
        fuel="gasoline", trans="automatic", color="Cinza",
        price=719900, mileage=22000, engine="3.0", hp=510, doors=2, ym=2022, yf=2022),
    "chevrolet-onix-lt-1-0-turbo-2022": dict(
        brand="Hyundai", model="i30", version="N", body="hatch",
        fuel="gasoline", trans="manual", color="Vermelho",
        price=239900, mileage=15000, engine="2.0 Turbo", hp=275, doors=4, ym=2021, yf=2021),
    "fiat-toro-freedom-1-3-turbo-2023": dict(
        brand="Ford", model="F-150", version="Raptor", body="pickup",
        fuel="gasoline", trans="automatic", color="Cinza",
        price=799900, mileage=33000, engine="3.5 V6", hp=450, doors=4, ym=2022, yf=2022),
    "hyundai-creta-action-1-6-2023": dict(
        brand="Honda", model="CR-V", version="Touring", body="suv",
        fuel="gasoline", trans="cvt", color="Branco",
        price=259900, mileage=26000, engine="1.5 Turbo", hp=190, doors=4, ym=2022, yf=2021),
    "volkswagen-t-cross-comfortline-200-tsi-2022": dict(
        brand="Audi", model="RS6", version="Avant", body="wagon",
        fuel="gasoline", trans="automatic", color="Preto",
        price=899900, mileage=19000, engine="4.0 V8", hp=600, doors=4, ym=2022, yf=2022),
}


async def get_or_create_brand(session, name: str) -> Brand:
    brand = (await session.execute(select(Brand).where(Brand.name == name))).scalar_one_or_none()
    if brand is None:
        brand = Brand(name=name, slug=slugify(name))
        session.add(brand)
        await session.flush()
        print(f"  + marca criada: {name}")
    return brand


async def get_or_create_model(session, brand: Brand, name: str) -> VehicleModel:
    model = (
        await session.execute(
            select(VehicleModel).where(
                VehicleModel.brand_id == brand.id, VehicleModel.name == name
            )
        )
    ).scalar_one_or_none()
    if model is None:
        model = VehicleModel(brand_id=brand.id, name=name, slug=slugify(name))
        session.add(model)
        await session.flush()
        print(f"  + modelo criado: {brand.name} {name}")
    return model


async def main() -> None:
    async with get_session_factory()() as session:
        for current_slug, d in MAP.items():
            vehicle = (
                await session.execute(
                    select(Vehicle)
                    .options(selectinload(Vehicle.images))
                    .where(Vehicle.slug == current_slug)
                )
            ).scalar_one_or_none()
            if vehicle is None:
                print(f"! não encontrado: {current_slug}")
                continue

            brand = await get_or_create_brand(session, d["brand"])
            model = await get_or_create_model(session, brand, d["model"])

            vehicle.brand_id = brand.id
            vehicle.model_id = model.id
            vehicle.brand_name = brand.name  # cópia desnormalizada (busca)
            vehicle.model_name = model.name
            vehicle.version = d["version"]
            vehicle.body_type = BodyType(d["body"])
            vehicle.fuel_type = FuelType(d["fuel"])
            vehicle.transmission = TransmissionType(d["trans"])
            vehicle.color = d["color"]
            vehicle.price = d["price"]
            vehicle.mileage = d["mileage"]
            vehicle.engine = d["engine"]
            vehicle.horsepower = d["hp"]
            vehicle.doors = d["doors"]
            vehicle.year_model = d["ym"]
            vehicle.year_manufacture = d["yf"]

            title = " ".join(p for p in [brand.name, model.name, d["version"]] if p)
            vehicle.slug = slugify(f"{brand.name} {model.name} {d['version']} {d['ym']}")

            # A capa (e as demais fotos) descrevem o carro certo agora.
            for img in vehicle.images:
                img.alt_text = title

            print(f"  ✓ {current_slug}  ->  {title}  ({vehicle.slug})")

        await session.commit()
        print("\nOK — commit feito.")


if __name__ == "__main__":
    asyncio.run(main())
