"""Popula o banco com dados iniciais.

Idempotente: cada registro é procurado antes de ser criado, então rodar duas
vezes não duplica nada. Isso importa porque o seed roda em ambientes que já têm
dados — um deploy novo em cima de um banco vivo.

Uso:
    SEED_ADMIN_PASSWORD='senha-forte' uv run python -m src.infrastructure.database.seed

Marcas, modelos e opcionais NÃO são dados de exemplo: são dados de referência
que a aplicação precisa para funcionar (alimentam os filtros da busca). Os
veículos, sim, são exemplo — e só entram fora de produção.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from decimal import Decimal

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.database import get_session_factory
from src.core.security import get_password_hasher
from src.domain.catalog.enums import (
    BodyType,
    FeatureCategory,
    FuelType,
    TransmissionType,
    VehicleStatus,
)
from src.domain.identity.enums import UserRole
from src.infrastructure.database.models import (
    Brand,
    Dealership,
    Feature,
    User,
    Vehicle,
    VehicleImage,
    VehicleModel,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("seed")

DEALERSHIP_SLUG = "auto-premium"

# Recorte do mercado brasileiro real.
BRANDS: dict[str, list[str]] = {
    "Toyota": ["Corolla", "Corolla Cross", "Hilux", "Yaris", "SW4", "RAV4"],
    "Volkswagen": ["Gol", "Polo", "Virtus", "T-Cross", "Nivus", "Saveiro", "Amarok"],
    "Chevrolet": ["Onix", "Onix Plus", "Tracker", "S10", "Spin", "Montana"],
    "Honda": ["Civic", "City", "Fit", "HR-V", "WR-V", "CR-V"],
    "Hyundai": ["HB20", "HB20S", "Creta", "Tucson"],
    "Fiat": ["Argo", "Cronos", "Mobi", "Pulse", "Toro", "Strada", "Fastback"],
    "Jeep": ["Renegade", "Compass", "Commander"],
    "Renault": ["Kwid", "Sandero", "Duster", "Oroch"],
    "Ford": ["Ka", "EcoSport", "Ranger", "Bronco Sport"],
    "Nissan": ["Kicks", "Versa", "Frontier"],
}

FEATURES: list[tuple[str, FeatureCategory]] = [
    ("Ar-condicionado", FeatureCategory.COMFORT),
    ("Direção elétrica", FeatureCategory.COMFORT),
    ("Vidros elétricos", FeatureCategory.COMFORT),
    ("Travas elétricas", FeatureCategory.COMFORT),
    ("Piloto automático", FeatureCategory.COMFORT),
    ("Bancos em couro", FeatureCategory.INTERIOR),
    ("Central multimídia", FeatureCategory.TECHNOLOGY),
    ("Apple CarPlay / Android Auto", FeatureCategory.TECHNOLOGY),
    ("Câmera de ré", FeatureCategory.TECHNOLOGY),
    ("Sensor de estacionamento", FeatureCategory.TECHNOLOGY),
    ("Airbags", FeatureCategory.SAFETY),
    ("Freios ABS", FeatureCategory.SAFETY),
    ("Controle de estabilidade", FeatureCategory.SAFETY),
    ("Controle de tração", FeatureCategory.SAFETY),
    ("Isofix", FeatureCategory.SAFETY),
    ("Teto solar", FeatureCategory.EXTERIOR),
    ("Rodas de liga leve", FeatureCategory.EXTERIOR),
    ("Faróis de LED", FeatureCategory.EXTERIOR),
]


@dataclass(frozen=True, slots=True)
class DemoVehicle:
    """Veículo de demonstração.

    Um dataclass tipado em vez de um dicionário solto: o mypy valida cada campo
    aqui em vez de deixar o erro aparecer como um IntegrityError no banco.
    """

    brand: str
    model: str
    version: str
    year_manufacture: int
    year_model: int
    price: str
    mileage: int
    fuel: FuelType
    transmission: TransmissionType
    body: BodyType
    color: str
    doors: int
    engine: str
    horsepower: int
    description: str
    features: list[str]
    is_featured: bool = False


DEMO_VEHICLES: list[DemoVehicle] = [
    DemoVehicle(
        brand="Toyota",
        model="Corolla",
        version="XEi 2.0 Flex",
        year_manufacture=2022,
        year_model=2023,
        price="129900.00",
        mileage=38000,
        fuel=FuelType.FLEX,
        transmission=TransmissionType.CVT,
        body=BodyType.SEDAN,
        color="Prata",
        doors=4,
        engine="2.0",
        horsepower=177,
        is_featured=True,
        description=(
            "Sedã completo, único dono, revisões feitas na concessionária. "
            "Câmbio automático CVT, central multimídia e câmera de ré."
        ),
        features=[
            "Ar-condicionado",
            "Direção elétrica",
            "Central multimídia",
            "Câmera de ré",
            "Airbags",
            "Freios ABS",
            "Rodas de liga leve",
        ],
    ),
    DemoVehicle(
        brand="Honda",
        model="Civic",
        version="EXL 2.0 CVT",
        year_manufacture=2021,
        year_model=2021,
        price="142500.00",
        mileage=52000,
        fuel=FuelType.GASOLINE,
        transmission=TransmissionType.CVT,
        body=BodyType.SEDAN,
        color="Preto",
        doors=4,
        engine="2.0",
        horsepower=155,
        is_featured=True,
        description=(
            "Bancos em couro, teto solar e piloto automático adaptativo. "
            "Acompanha manual e chave reserva."
        ),
        features=[
            "Bancos em couro",
            "Teto solar",
            "Piloto automático",
            "Central multimídia",
            "Airbags",
            "Controle de estabilidade",
        ],
    ),
    DemoVehicle(
        brand="Jeep",
        model="Compass",
        version="Longitude 1.3 T270",
        year_manufacture=2023,
        year_model=2023,
        price="168900.00",
        mileage=21000,
        fuel=FuelType.FLEX,
        transmission=TransmissionType.AUTOMATIC,
        body=BodyType.SUV,
        color="Branco",
        doors=4,
        engine="1.3 Turbo",
        horsepower=185,
        is_featured=True,
        description="SUV turbo com garantia de fábrica vigente e IPVA pago.",
        features=[
            "Ar-condicionado",
            "Central multimídia",
            "Câmera de ré",
            "Sensor de estacionamento",
            "Airbags",
            "Isofix",
            "Faróis de LED",
        ],
    ),
    DemoVehicle(
        brand="Chevrolet",
        model="Onix",
        version="LT 1.0 Turbo",
        year_manufacture=2022,
        year_model=2022,
        price="78900.00",
        mileage=41000,
        fuel=FuelType.FLEX,
        transmission=TransmissionType.MANUAL,
        body=BodyType.HATCH,
        color="Vermelho",
        doors=4,
        engine="1.0 Turbo",
        horsepower=116,
        description="Econômico e bem cuidado. Ótimo para uso urbano.",
        features=[
            "Ar-condicionado",
            "Direção elétrica",
            "Vidros elétricos",
            "Central multimídia",
            "Airbags",
            "Freios ABS",
        ],
    ),
    DemoVehicle(
        brand="Volkswagen",
        model="T-Cross",
        version="Comfortline 200 TSI",
        year_manufacture=2021,
        year_model=2022,
        price="112000.00",
        mileage=47000,
        fuel=FuelType.FLEX,
        transmission=TransmissionType.AUTOMATIC,
        body=BodyType.SUV,
        color="Cinza",
        doors=4,
        engine="1.0 TSI",
        horsepower=128,
        description="SUV compacto, porta-malas amplo, revisões em dia.",
        features=[
            "Ar-condicionado",
            "Direção elétrica",
            "Central multimídia",
            "Câmera de ré",
            "Airbags",
            "Controle de tração",
        ],
    ),
    DemoVehicle(
        brand="Fiat",
        model="Toro",
        version="Freedom 1.3 Turbo",
        year_manufacture=2023,
        year_model=2023,
        price="134900.00",
        mileage=18000,
        fuel=FuelType.FLEX,
        transmission=TransmissionType.AUTOMATIC,
        body=BodyType.PICKUP,
        color="Azul",
        doors=4,
        engine="1.3 Turbo",
        horsepower=185,
        description="Picape seminova, pneus novos, chave reserva inclusa.",
        features=[
            "Ar-condicionado",
            "Central multimídia",
            "Sensor de estacionamento",
            "Airbags",
            "Controle de estabilidade",
            "Rodas de liga leve",
        ],
    ),
    DemoVehicle(
        brand="Hyundai",
        model="Creta",
        version="Action 1.6",
        year_manufacture=2022,
        year_model=2023,
        price="119900.00",
        mileage=33000,
        fuel=FuelType.FLEX,
        transmission=TransmissionType.AUTOMATIC,
        body=BodyType.SUV,
        color="Branco",
        doors=4,
        engine="1.6",
        horsepower=130,
        description="SUV espaçoso, licenciamento quitado, manual completo.",
        features=[
            "Ar-condicionado",
            "Direção elétrica",
            "Câmera de ré",
            "Airbags",
            "Freios ABS",
            "Isofix",
        ],
    ),
    DemoVehicle(
        brand="Renault",
        model="Kwid",
        version="Zen 1.0",
        year_manufacture=2023,
        year_model=2024,
        price="62900.00",
        mileage=12000,
        fuel=FuelType.FLEX,
        transmission=TransmissionType.MANUAL,
        body=BodyType.HATCH,
        color="Prata",
        doors=4,
        engine="1.0",
        horsepower=71,
        description="Praticamente zero. Ideal para primeiro carro.",
        features=["Ar-condicionado", "Vidros elétricos", "Airbags", "Freios ABS"],
    ),
]


@dataclass(slots=True)
class SeedResult:
    brands: int = 0
    models: int = 0
    features: int = 0
    vehicles: int = 0
    admin_created: bool = False
    warnings: list[str] = field(default_factory=list)


async def _seed_dealership(session: AsyncSession) -> Dealership:
    existing = await session.scalar(select(Dealership).where(Dealership.slug == DEALERSHIP_SLUG))
    if existing:
        return existing

    dealership = Dealership(
        name="Auto Premium",
        slug=DEALERSHIP_SLUG,
        city="São Paulo",
        state="SP",
        phone="1133334444",
        whatsapp="11999998888",
        email="contato@autopremium.com.br",
    )
    session.add(dealership)
    await session.flush()
    return dealership


async def _seed_admin(session: AsyncSession, dealership: Dealership, result: SeedResult) -> None:
    email = os.getenv("SEED_ADMIN_EMAIL", "admin@autopremium.com.br").lower()

    if await session.scalar(select(User).where(User.email == email)):
        return

    # Sem senha no ambiente, o seed FALHA em vez de inventar uma senha padrão.
    # Credencial default é como a maioria dos vazamentos por "senha conhecida"
    # começa: alguém sobe para produção e nunca troca.
    password = os.getenv("SEED_ADMIN_PASSWORD")
    if not password:
        raise RuntimeError(
            "SEED_ADMIN_PASSWORD não definida.\n"
            "  SEED_ADMIN_PASSWORD='sua-senha-forte' uv run python -m "
            "src.infrastructure.database.seed\n"
            "Não existe senha padrão, de propósito."
        )

    session.add(
        User(
            dealership_id=dealership.id,
            name="Administrador",
            email=email,
            password_hash=get_password_hasher().hash(password),
            role=UserRole.SUPER_ADMIN,
            is_active=True,
        )
    )
    result.admin_created = True


async def _seed_brands(session: AsyncSession, result: SeedResult) -> dict[str, VehicleModel]:
    """Índice 'Marca|Modelo' -> VehicleModel, consumido pelo seed de veículos."""
    index: dict[str, VehicleModel] = {}

    for brand_name, model_names in BRANDS.items():
        brand = await session.scalar(select(Brand).where(Brand.name == brand_name))
        if not brand:
            brand = Brand(name=brand_name, slug=slugify(brand_name))
            session.add(brand)
            await session.flush()
            result.brands += 1

        for model_name in model_names:
            model_slug = slugify(model_name)
            model = await session.scalar(
                select(VehicleModel).where(
                    VehicleModel.brand_id == brand.id,
                    VehicleModel.slug == model_slug,
                )
            )
            if not model:
                model = VehicleModel(brand_id=brand.id, name=model_name, slug=model_slug)
                session.add(model)
                await session.flush()
                result.models += 1

            index[f"{brand_name}|{model_name}"] = model

    return index


async def _seed_features(session: AsyncSession, result: SeedResult) -> dict[str, Feature]:
    index: dict[str, Feature] = {}

    for name, category in FEATURES:
        feature = await session.scalar(select(Feature).where(Feature.name == name))
        if not feature:
            feature = Feature(name=name, slug=slugify(name), category=category)
            session.add(feature)
            await session.flush()
            result.features += 1
        index[name] = feature

    return index


async def _seed_vehicles(
    session: AsyncSession,
    dealership: Dealership,
    models: dict[str, VehicleModel],
    features: dict[str, Feature],
    result: SeedResult,
) -> None:
    for demo in DEMO_VEHICLES:
        model = models[f"{demo.brand}|{demo.model}"]
        slug = slugify(f"{demo.brand} {demo.model} {demo.version} {demo.year_model}")

        if await session.scalar(select(Vehicle).where(Vehicle.slug == slug)):
            continue

        vehicle = Vehicle(
            dealership_id=dealership.id,
            brand_id=model.brand_id,
            model_id=model.id,
            # Cópia denormalizada: alimenta a coluna gerada `search_vector`.
            # O porquê está em models/catalog.py.
            brand_name=demo.brand,
            model_name=demo.model,
            slug=slug,
            version=demo.version,
            year_manufacture=demo.year_manufacture,
            year_model=demo.year_model,
            price=Decimal(demo.price),
            mileage=demo.mileage,
            fuel_type=demo.fuel,
            transmission=demo.transmission,
            body_type=demo.body,
            color=demo.color,
            doors=demo.doors,
            engine=demo.engine,
            horsepower=demo.horsepower,
            owners_count=1,
            has_manual=True,
            has_spare_key=True,
            ipva_paid=True,
            licensing_paid=True,
            city=dealership.city,
            state=dealership.state,
            description=demo.description,
            is_featured=demo.is_featured,
            status=VehicleStatus.ACTIVE,
        )
        vehicle.features = [features[name] for name in demo.features]

        # Placeholders determinísticos pelo slug. Só para desenvolvimento: no uso
        # real as fotos sobem direto ao Supabase Storage pelo painel admin.
        for position in range(4):
            vehicle.images.append(
                VehicleImage(
                    storage_path=f"seed/{slug}-{position}.jpg",
                    url=f"https://picsum.photos/seed/{slug}-{position}/1200/800",
                    alt_text=f"{demo.brand} {demo.model} {demo.version} — foto {position + 1}",
                    width=1200,
                    height=800,
                    position=position,
                    is_cover=(position == 0),
                )
            )

        session.add(vehicle)
        result.vehicles += 1


async def seed() -> SeedResult:
    settings = get_settings()
    result = SeedResult()

    async with get_session_factory()() as session:
        dealership = await _seed_dealership(session)
        await _seed_admin(session, dealership, result)
        models = await _seed_brands(session, result)
        features = await _seed_features(session, result)

        if settings.is_production:
            result.warnings.append("produção: veículos de demonstração NÃO criados")
        else:
            await _seed_vehicles(session, dealership, models, features, result)

        await session.commit()

    return result


async def _main() -> None:
    result = await seed()
    logger.info("🌱 seed concluído")
    logger.info("   marcas novas:    %d", result.brands)
    logger.info("   modelos novos:   %d", result.models)
    logger.info("   opcionais novos: %d", result.features)
    logger.info("   veículos novos:  %d", result.vehicles)
    logger.info("   admin criado:    %s", "sim" if result.admin_created else "já existia")
    for warning in result.warnings:
        logger.info("   ⚠️  %s", warning)


if __name__ == "__main__":
    asyncio.run(_main())
