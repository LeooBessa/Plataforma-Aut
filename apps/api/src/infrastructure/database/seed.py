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

# ============================================================================
# CATÁLOGO DE MARCAS E MODELOS
# ============================================================================
# Esta lista NÃO é o filtro do site. O filtro é montado por consulta ao banco e
# só mostra marca e modelo que TÊM carro à venda — está no `get_filter_options`
# do repositório. Ou seja: uma marca aqui sem nenhum carro cadastrado é
# invisível para o visitante.
#
# É por isso que a lista pode (e deve) ser generosa. Ela não polui a tela; ela
# só decide o que o vendedor CONSEGUE cadastrar. E o custo de faltar é alto: a
# marca e o modelo são um <select> no painel, sem campo livre e sem rota para
# criar — se o carro que chegou na loja não está aqui, o anúncio simplesmente
# não pode ser criado.
#
# O recorte é de REVENDA DE USADO, não de concessionária. A diferença importa e
# é onde a lista anterior falhava: ela só tinha linha atual, e loja de usado
# vende Palio 2012, Prisma 2014, Fox 2011 e Corsa 2009 — carros fora de linha há
# uma década, que eram justamente os que não dava para cadastrar.
#
# A ordem é por presença no mercado brasileiro: populares primeiro, importadas e
# premium no fim.
BRANDS: dict[str, list[str]] = {
    "Fiat": [
        "500", "Argo", "Bravo", "Cronos", "Doblò", "Ducato", "Fastback", "Fiorino",
        "Freemont", "Grand Siena", "Idea", "Linea", "Mobi", "Palio", "Palio Weekend",
        "Pulse", "Punto", "Siena", "Stilo", "Strada", "Titano", "Toro", "Uno",
    ],
    "Volkswagen": [
        "Amarok", "Bora", "CrossFox", "Fox", "Gol", "Golf", "Jetta", "Kombi", "Nivus",
        "Passat", "Polo", "Saveiro", "SpaceFox", "T-Cross", "Taos", "Tiguan", "Up",
        "Virtus", "Voyage",
    ],
    "Chevrolet": [
        "Agile", "Astra", "Blazer", "Camaro", "Captiva", "Celta", "Classic", "Cobalt",
        "Corsa", "Cruze", "Equinox", "Joy", "Meriva", "Montana", "Onix", "Onix Plus",
        "Prisma", "S10", "Spin", "Tracker", "Trailblazer", "Vectra", "Zafira",
    ],
    "Hyundai": [
        "Azera", "Creta", "Elantra", "HB20", "HB20S", "HB20X", "i30", "ix35",
        "Santa Fe", "Tucson", "Veloster",
    ],
    "Toyota": [
        "Camry", "Corolla", "Corolla Cross", "Etios", "Hilux", "Prius", "RAV4", "SW4",
        "Yaris",
    ],
    "Renault": [
        "Captur", "Clio", "Duster", "Fluence", "Kangoo", "Kwid", "Logan", "Master",
        "Mégane", "Oroch", "Sandero", "Stepway", "Symbol",
    ],
    "Ford": [
        "Bronco Sport", "Courier", "EcoSport", "Edge", "F-150", "Fiesta", "Focus",
        "Fusion", "Ka", "Ka Sedan", "Maverick", "Ranger", "Territory", "Transit",
    ],
    "Honda": ["Accord", "City", "Civic", "CR-V", "Fit", "HR-V", "WR-V", "ZR-V"],
    "Nissan": [
        "Frontier", "Grand Livina", "Kicks", "Livina", "March", "Sentra", "Tiida",
        "Versa", "X-Trail",
    ],
    "Jeep": ["Cherokee", "Commander", "Compass", "Grand Cherokee", "Renegade", "Wrangler"],
    "Peugeot": [
        "206", "207", "208", "2008", "307", "308", "3008", "408", "5008", "Hoggar",
        "Partner",
    ],
    "Citroën": [
        "Aircross", "Basalt", "Berlingo", "C3", "C4", "C4 Cactus", "C4 Lounge",
        "C4 Pallas", "Jumper", "Xsara Picasso",
    ],
    "Mitsubishi": [
        "ASX", "Eclipse Cross", "L200", "L200 Triton", "Lancer", "Outlander",
        "Pajero Full", "Pajero Sport", "Pajero TR4",
    ],
    "Kia": [
        "Bongo", "Carnival", "Cerato", "Picanto", "Seltos", "Sorento", "Soul",
        "Sportage", "Stonic",
    ],
    "Caoa Chery": [
        "Arrizo 5", "Arrizo 6", "Celer", "QQ", "Tiggo 2", "Tiggo 3x", "Tiggo 5x",
        "Tiggo 7", "Tiggo 8",
    ],
    "RAM": ["1500", "2500", "3500", "Rampage"],
    "Suzuki": ["Grand Vitara", "Jimny", "S-Cross", "SX4", "Vitara"],
    "GWM": ["Haval H6", "Ora 03", "Poer"],
    "BYD": ["Dolphin", "Dolphin Mini", "King", "Seal", "Song Plus", "Yuan Plus"],
    # ---------------------------------------------------------------- premium
    # Aparecem menos numa revenda de bairro, mas aparecem — e quando aparece é o
    # carro mais caro do pátio, o pior momento para descobrir que não dá para
    # cadastrar.
    "Audi": ["A1", "A3", "A4", "A5", "A6", "Q3", "Q5", "Q7", "Q8", "RS6", "TT"],
    "BMW": [
        "M2", "M3", "M4", "Série 1", "Série 3", "Série 5", "X1", "X3", "X4", "X5",
        "X6", "Z4",
    ],
    "Mercedes-Benz": [
        "Classe A", "Classe B", "Classe C", "Classe E", "GLA", "GLB", "GLC", "GLE",
        "Sprinter",
    ],
    "Land Rover": [
        "Defender", "Discovery", "Discovery Sport", "Freelander", "Range Rover Evoque",
        "Range Rover Sport", "Range Rover Velar",
    ],
    "Volvo": ["S60", "V40", "XC40", "XC60", "XC90"],
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
    settings = get_settings()
    email = settings.seed_admin_email.lower()

    if await session.scalar(select(User).where(User.email == email)):
        return

    # Sem senha configurada, o seed FALHA em vez de inventar uma padrão.
    # Credencial default é como a maioria dos vazamentos por "senha conhecida"
    # começa: alguém sobe para produção e nunca troca.
    password = settings.seed_admin_password.get_secret_value()
    if not password:
        raise RuntimeError(
            "SEED_ADMIN_PASSWORD não definida (no .env ou no ambiente).\n"
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
