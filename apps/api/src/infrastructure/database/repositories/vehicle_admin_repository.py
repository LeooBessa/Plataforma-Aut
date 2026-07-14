"""Implementação Postgres da escrita do catálogo."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from slugify import slugify
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import NotFoundError, ValidationError
from src.domain.catalog.entities import (
    AdminBrandOption,
    AdminCatalog,
    AdminModelOption,
    FeatureItem,
    Image,
    VehicleDetail,
    VehicleSummary,
)
from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.value_objects import Page, Pagination, VehicleFilters
from src.domain.catalog.write_models import ImageWrite, VehicleWrite
from src.infrastructure.database.models import (
    Brand,
    Dealership,
    Feature,
    Vehicle,
    VehicleImage,
    VehicleModel,
)
from src.infrastructure.database.repositories.vehicle_repository import (
    SqlAlchemyVehicleRepository,
    _to_detail,
    _to_image,
)

_FULL_LOAD = (selectinload(Vehicle.images), selectinload(Vehicle.features))


class SqlAlchemyVehicleAdminRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        # A busca administrativa reaproveita toda a lógica de filtros da busca
        # pública. Duplicá-la aqui garantiria que, no dia em que um filtro novo
        # aparecesse, ele funcionaria num lado e não no outro.
        self._public = SqlAlchemyVehicleRepository(session)

    # ------------------------------------------------------------------ leitura

    async def get_by_id(self, vehicle_id: uuid.UUID) -> VehicleDetail | None:
        vehicle = await self._session.scalar(
            select(Vehicle).where(Vehicle.id == vehicle_id).options(*_FULL_LOAD)
        )
        return _to_detail(vehicle) if vehicle else None

    async def get_catalog(self) -> AdminCatalog:
        """Todas as marcas, modelos e opcionais — inclusive os nunca usados."""
        rows = await self._session.execute(
            select(Brand.id, Brand.name, VehicleModel.id, VehicleModel.name)
            # LEFT JOIN de propósito: uma marca recém-cadastrada, ainda sem
            # modelos, precisa aparecer na lista. Com INNER JOIN ela sumiria — e
            # o admin nunca conseguiria cadastrar o primeiro modelo dela.
            .outerjoin(VehicleModel, VehicleModel.brand_id == Brand.id)
            .order_by(Brand.name, VehicleModel.name)
        )

        grouped: dict[tuple[uuid.UUID, str], list[AdminModelOption]] = {}
        for brand_id, brand_name, model_id, model_name in rows:
            key = (brand_id, brand_name)
            grouped.setdefault(key, [])
            if model_id is not None:
                grouped[key].append(AdminModelOption(id=model_id, name=model_name))

        brands = [
            AdminBrandOption(id=brand_id, name=name, models=models)
            for (brand_id, name), models in grouped.items()
        ]

        features = await self._session.scalars(
            select(Feature).order_by(Feature.category, Feature.name)
        )

        return AdminCatalog(
            brands=brands,
            features=[
                FeatureItem(id=f.id, name=f.name, slug=f.slug, category=f.category)
                for f in features
            ],
        )

    async def search_admin(
        self,
        filters: VehicleFilters,
        pagination: Pagination,
        *,
        statuses: list[VehicleStatus] | None = None,
    ) -> Page[VehicleSummary]:
        # Sem filtro de status, o painel mostra TUDO — inclusive rascunho e
        # arquivado. É o oposto da listagem pública, e é justamente o motivo de
        # este método viver num repositório separado.
        return await self._public.search(
            filters, pagination, statuses=statuses or list(VehicleStatus)
        )

    # ------------------------------------------------------------------ escrita

    async def _resolve_brand_and_model(
        self, brand_id: uuid.UUID, model_id: uuid.UUID
    ) -> tuple[Brand, VehicleModel]:
        brand = await self._session.get(Brand, brand_id)
        if brand is None:
            raise NotFoundError("Marca não encontrada.")

        model = await self._session.get(VehicleModel, model_id)
        if model is None:
            raise NotFoundError("Modelo não encontrado.")

        # Sem esta checagem seria possível cadastrar um "Toyota Civic": o admin
        # troca a marca e esquece de trocar o modelo. O anúncio ficaria
        # incoerente no site e envenenaria a busca (`brand_name`/`model_name`
        # alimentam o índice textual).
        if model.brand_id != brand.id:
            raise ValidationError(
                f"O modelo {model.name} não pertence à marca {brand.name}.",
            )

        return brand, model

    async def _unique_slug(self, base: str, *, exclude_id: uuid.UUID | None = None) -> str:
        """Slug único — é a URL pública do anúncio.

        Dois carros iguais no estoque (mesma marca, modelo, versão e ano) são
        comuns numa concessionária, então a colisão não é hipótese remota: é
        rotina. Um sufixo curto resolve, e mantém a URL legível para o SEO.
        """
        candidate = base
        for attempt in range(10):
            query = select(func.count()).select_from(Vehicle).where(Vehicle.slug == candidate)
            if exclude_id:
                query = query.where(Vehicle.id != exclude_id)

            if not await self._session.scalar(query):
                return candidate

            candidate = f"{base}-{uuid.uuid4().hex[:6]}"
            if attempt == 9:  # pragma: no cover — dez colisões seguidas é loteria
                break

        raise ValidationError("Não foi possível gerar um endereço único para este anúncio.")

    def _build_slug_base(self, brand: Brand, model: VehicleModel, data: VehicleWrite) -> str:
        parts = [brand.name, model.name]
        if data.version:
            parts.append(data.version)
        parts.append(str(data.year_model))
        return slugify(" ".join(parts))

    async def _resolve_features(self, feature_ids: list[uuid.UUID]) -> list[Feature]:
        if not feature_ids:
            return []

        features = list(
            await self._session.scalars(select(Feature).where(Feature.id.in_(feature_ids)))
        )
        if len(features) != len(set(feature_ids)):
            raise ValidationError("Um ou mais opcionais informados não existem.")

        return features

    async def _apply(
        self, vehicle: Vehicle, data: VehicleWrite, brand: Brand, model: VehicleModel
    ) -> None:
        vehicle.brand_id = brand.id
        vehicle.model_id = model.id
        # A cópia denormalizada alimenta a coluna gerada `search_vector`. Se
        # deixasse de ser atualizada aqui, o anúncio sumiria da busca depois de
        # uma edição — em silêncio.
        vehicle.brand_name = brand.name
        vehicle.model_name = model.name

        vehicle.version = data.version
        vehicle.year_manufacture = data.year_manufacture
        vehicle.year_model = data.year_model
        vehicle.price = data.price
        vehicle.mileage = data.mileage
        vehicle.fuel_type = data.fuel_type
        vehicle.transmission = data.transmission
        vehicle.body_type = data.body_type
        vehicle.color = data.color
        vehicle.doors = data.doors
        vehicle.engine = data.engine
        vehicle.horsepower = data.horsepower
        vehicle.owners_count = data.owners_count
        vehicle.has_manual = data.has_manual
        vehicle.has_spare_key = data.has_spare_key
        vehicle.ipva_paid = data.ipva_paid
        vehicle.licensing_paid = data.licensing_paid
        vehicle.service_history = data.service_history
        vehicle.city = data.city
        vehicle.state = data.state.upper()
        vehicle.description = data.description
        vehicle.accepts_financing = data.accepts_financing
        vehicle.accepts_trade = data.accepts_trade
        vehicle.down_payment = data.down_payment
        vehicle.installments_count = data.installments_count
        vehicle.is_featured = data.is_featured

        vehicle.features = await self._resolve_features(data.feature_ids)

    async def create(self, data: VehicleWrite, created_by: uuid.UUID) -> VehicleDetail:
        brand, model = await self._resolve_brand_and_model(data.brand_id, data.model_id)

        dealership_id = await self._session.scalar(select(Dealership.id).limit(1))
        if dealership_id is None:
            raise ValidationError("Nenhuma concessionária cadastrada. Rode o seed.")

        # Os opcionais são resolvidos ANTES de o veículo existir no banco.
        #
        # A ordem não é preferência estética: atribuir `.features` a um objeto já
        # inserido faz o SQLAlchemy carregar a coleção atual para calcular a
        # diferença — e esse carregamento preguiçoso, em código assíncrono,
        # estoura com `MissingGreenlet`. Montando o objeto completo antes do
        # INSERT, não há coleção velha para comparar, e não há I/O escondido.
        features = await self._resolve_features(data.feature_ids)

        vehicle = Vehicle(
            dealership_id=dealership_id,
            created_by_id=created_by,
            brand_id=brand.id,
            model_id=model.id,
            brand_name=brand.name,
            model_name=model.name,
            slug=await self._unique_slug(self._build_slug_base(brand, model, data)),
            version=data.version,
            year_manufacture=data.year_manufacture,
            year_model=data.year_model,
            price=data.price,
            mileage=data.mileage,
            fuel_type=data.fuel_type,
            transmission=data.transmission,
            body_type=data.body_type,
            color=data.color,
            doors=data.doors,
            engine=data.engine,
            horsepower=data.horsepower,
            owners_count=data.owners_count,
            has_manual=data.has_manual,
            has_spare_key=data.has_spare_key,
            ipva_paid=data.ipva_paid,
            licensing_paid=data.licensing_paid,
            service_history=data.service_history,
            city=data.city,
            state=data.state.upper(),
            description=data.description,
            accepts_financing=data.accepts_financing,
            accepts_trade=data.accepts_trade,
            down_payment=data.down_payment,
            installments_count=data.installments_count,
            is_featured=data.is_featured,
            status=data.status,
            published_at=datetime.now(UTC) if data.status is VehicleStatus.ACTIVE else None,
        )
        vehicle.features = features

        self._session.add(vehicle)
        await self._session.flush()

        created = await self.get_by_id(vehicle.id)
        assert created is not None
        return created

    async def update(self, vehicle_id: uuid.UUID, data: VehicleWrite) -> VehicleDetail | None:
        vehicle = await self._session.scalar(
            select(Vehicle).where(Vehicle.id == vehicle_id).options(*_FULL_LOAD)
        )
        if vehicle is None:
            return None

        brand, model = await self._resolve_brand_and_model(data.brand_id, data.model_id)
        await self._apply(vehicle, data, brand, model)

        # O slug só muda se marca, modelo, versão ou ano mudarem — e mesmo assim
        # é uma decisão delicada: trocar a URL de um anúncio já indexado joga
        # fora o SEO acumulado e quebra links que já circulam por aí. Mudamos
        # apenas quando o anúncio ainda NÃO foi publicado.
        if vehicle.status is VehicleStatus.DRAFT:
            vehicle.slug = await self._unique_slug(
                self._build_slug_base(brand, model, data), exclude_id=vehicle.id
            )

        await self._session.flush()
        return await self.get_by_id(vehicle_id)

    async def change_status(
        self, vehicle_id: uuid.UUID, status: VehicleStatus
    ) -> VehicleDetail | None:
        vehicle = await self._session.get(Vehicle, vehicle_id)
        if vehicle is None:
            return None

        now = datetime.now(UTC)

        # `published_at` é gravado na PRIMEIRA publicação e nunca mais. Ele é o
        # critério de ordenação "mais recentes"; sobrescrevê-lo faria um anúncio
        # antigo saltar para o topo só porque alguém o despublicou e republicou.
        if status is VehicleStatus.ACTIVE and vehicle.published_at is None:
            vehicle.published_at = now

        if status is VehicleStatus.SOLD and vehicle.sold_at is None:
            vehicle.sold_at = now

        vehicle.status = status
        await self._session.flush()

        return await self.get_by_id(vehicle_id)

    async def duplicate(self, vehicle_id: uuid.UUID, created_by: uuid.UUID) -> VehicleDetail | None:
        original = await self._session.scalar(
            select(Vehicle).where(Vehicle.id == vehicle_id).options(*_FULL_LOAD)
        )
        if original is None:
            return None

        copy = Vehicle(
            dealership_id=original.dealership_id,
            created_by_id=created_by,
            brand_id=original.brand_id,
            model_id=original.model_id,
            brand_name=original.brand_name,
            model_name=original.model_name,
            slug=await self._unique_slug(f"{original.slug}-copia"),
            version=original.version,
            year_manufacture=original.year_manufacture,
            year_model=original.year_model,
            price=original.price,
            mileage=original.mileage,
            fuel_type=original.fuel_type,
            transmission=original.transmission,
            body_type=original.body_type,
            color=original.color,
            doors=original.doors,
            engine=original.engine,
            horsepower=original.horsepower,
            owners_count=original.owners_count,
            has_manual=original.has_manual,
            has_spare_key=original.has_spare_key,
            ipva_paid=original.ipva_paid,
            licensing_paid=original.licensing_paid,
            service_history=original.service_history,
            city=original.city,
            state=original.state,
            description=original.description,
            accepts_financing=original.accepts_financing,
            accepts_trade=original.accepts_trade,
            down_payment=original.down_payment,
            installments_count=original.installments_count,
            # A cópia NUNCA nasce em destaque nem publicada: sairia no ar como
            # anúncio duplicado, idêntico ao original, antes de o admin editar
            # o que quer que fosse.
            is_featured=False,
            status=VehicleStatus.DRAFT,
        )
        copy.features = list(original.features)

        # As FOTOS não são copiadas de propósito. Elas mostram o carro
        # específico — quilometragem no painel, arranhão no para-choque, placa.
        # Reaproveitá-las num anúncio de OUTRO carro é enganar o comprador.
        self._session.add(copy)
        await self._session.flush()

        return await self.get_by_id(copy.id)

    async def delete(self, vehicle_id: uuid.UUID) -> bool:
        vehicle = await self._session.get(Vehicle, vehicle_id)
        if vehicle is None:
            return False

        try:
            await self._session.delete(vehicle)
            await self._session.flush()
        except IntegrityError:
            # ondelete=RESTRICT em appointments: o veículo tem leads.
            await self._session.rollback()
            return False

        return True

    # ------------------------------------------------------------------ imagens

    async def add_image(self, vehicle_id: uuid.UUID, image: ImageWrite) -> Image | None:
        vehicle = await self._session.scalar(
            select(Vehicle).where(Vehicle.id == vehicle_id).options(selectinload(Vehicle.images))
        )
        if vehicle is None:
            return None

        next_position = max((i.position for i in vehicle.images), default=-1) + 1

        model = VehicleImage(
            vehicle_id=vehicle_id,
            storage_path=image.storage_path,
            url=image.url,
            alt_text=image.alt_text,
            width=image.width,
            height=image.height,
            position=next_position,
            # A primeira foto vira capa automaticamente. Sem isso, um anúncio
            # ficaria sem capa até alguém lembrar de escolher uma — e o card na
            # listagem sairia sem imagem.
            is_cover=not vehicle.images,
        )
        self._session.add(model)
        await self._session.flush()

        return _to_image(model)

    async def delete_image(self, image_id: uuid.UUID) -> str | None:
        image = await self._session.get(VehicleImage, image_id)
        if image is None:
            return None

        storage_path = image.storage_path
        vehicle_id = image.vehicle_id
        was_cover = image.is_cover

        await self._session.delete(image)
        await self._session.flush()

        # Se a capa foi removida, outra assume. Um anúncio publicado sem capa
        # aparece sem foto na listagem — e ninguém clica num card vazio.
        if was_cover:
            remaining = list(
                await self._session.scalars(
                    select(VehicleImage)
                    .where(VehicleImage.vehicle_id == vehicle_id)
                    .order_by(VehicleImage.position)
                    .limit(1)
                )
            )
            if remaining:
                remaining[0].is_cover = True
                await self._session.flush()

        return storage_path

    async def reorder_images(self, vehicle_id: uuid.UUID, image_ids: list[uuid.UUID]) -> bool:
        current = list(
            await self._session.scalars(
                select(VehicleImage).where(VehicleImage.vehicle_id == vehicle_id)
            )
        )

        # A lista tem que ser exatamente as imagens deste veículo — nem a mais,
        # nem a menos. Aceitar uma lista parcial deixaria as imagens de fora com
        # posições arbitrárias; aceitar ids de outro veículo permitiria reordenar
        # (ou tocar) fotos que não são deste anúncio.
        if {i.id for i in current} != set(image_ids):
            return False

        by_id = {i.id: i for i in current}
        for position, image_id in enumerate(image_ids):
            by_id[image_id].position = position

        await self._session.flush()
        return True

    async def set_cover_image(self, vehicle_id: uuid.UUID, image_id: uuid.UUID) -> bool:
        target = await self._session.get(VehicleImage, image_id)
        if target is None or target.vehicle_id != vehicle_id:
            return False

        # Zera a capa de todas e marca a nova: garante que exista UMA capa, nunca
        # duas. Duas capas fariam a listagem escolher uma ao acaso, e o card
        # mostraria uma foto diferente a cada carregamento.
        await self._session.execute(
            update(VehicleImage).where(VehicleImage.vehicle_id == vehicle_id).values(is_cover=False)
        )
        target.is_cover = True
        await self._session.flush()
        return True
