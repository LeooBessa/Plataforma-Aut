"""Casos de uso administrativos do catálogo."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from src.application.ports import SignedUpload, StorageService
from src.core.exceptions import AuthorizationError, ConflictError, NotFoundError, ValidationError
from src.domain.catalog.entities import AdminCatalog, Image, VehicleDetail, VehicleSummary
from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.repositories import VehicleAdminRepository
from src.domain.catalog.value_objects import Page, Pagination, VehicleFilters
from src.domain.catalog.write_models import ImageWrite, VehicleWrite
from src.domain.identity.entities import AuthenticatedUser

# Um anúncio pode ter muitas fotos, mas não infinitas: a galeria fica
# impraticável, a página pesa e o Storage vira depósito.
MAX_IMAGES_PER_VEHICLE = 20


@dataclass(frozen=True, slots=True)
class ListAdminVehiclesUseCase:
    """Listagem do painel: enxerga TODOS os status, inclusive rascunho."""

    repository: VehicleAdminRepository

    async def execute(
        self,
        filters: VehicleFilters,
        pagination: Pagination,
        statuses: list[VehicleStatus] | None = None,
    ) -> Page[VehicleSummary]:
        return await self.repository.search_admin(filters, pagination, statuses=statuses)


@dataclass(frozen=True, slots=True)
class GetAdminVehicleUseCase:
    repository: VehicleAdminRepository

    async def execute(self, vehicle_id: UUID) -> VehicleDetail:
        vehicle = await self.repository.get_by_id(vehicle_id)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado.")
        return vehicle


@dataclass(frozen=True, slots=True)
class GetAdminCatalogUseCase:
    """Alimenta os selects do formulário de cadastro.

    Devolve TODAS as marcas e opcionais — inclusive os que ainda não têm veículo
    nenhum. É o oposto do endpoint público de filtros, e o motivo está em
    `AdminCatalog`.
    """

    repository: VehicleAdminRepository

    async def execute(self) -> AdminCatalog:
        return await self.repository.get_catalog()


@dataclass(frozen=True, slots=True)
class CreateVehicleUseCase:
    repository: VehicleAdminRepository

    async def execute(self, data: VehicleWrite, user: AuthenticatedUser) -> VehicleDetail:
        _validate(data)
        return await self.repository.create(data, created_by=user.id)


@dataclass(frozen=True, slots=True)
class UpdateVehicleUseCase:
    repository: VehicleAdminRepository

    async def execute(self, vehicle_id: UUID, data: VehicleWrite) -> VehicleDetail:
        _validate(data)

        vehicle = await self.repository.update(vehicle_id, data)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado.")
        return vehicle


@dataclass(frozen=True, slots=True)
class ChangeVehicleStatusUseCase:
    """Publicar, reservar, marcar como vendido, arquivar."""

    repository: VehicleAdminRepository

    async def execute(self, vehicle_id: UUID, status: VehicleStatus) -> VehicleDetail:
        current = await self.repository.get_by_id(vehicle_id)
        if current is None:
            raise NotFoundError("Veículo não encontrado.")

        # Publicar um anúncio sem foto é pior do que não publicar: o card fica
        # vazio na listagem, e um carro sem foto não vende — só polui a busca e
        # dá ao visitante a impressão de que o site está quebrado.
        if status is VehicleStatus.ACTIVE and not current.images:
            raise ValidationError("Adicione pelo menos uma foto antes de publicar o anúncio.")

        vehicle = await self.repository.change_status(vehicle_id, status)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado.")
        return vehicle


@dataclass(frozen=True, slots=True)
class DuplicateVehicleUseCase:
    """Duplicar um anúncio.

    Existe porque concessionária costuma ter três carros quase iguais. A cópia
    nasce como RASCUNHO, nunca publicada: senão dois anúncios idênticos
    apareceriam no site no mesmo instante, e o admin teria que correr para
    corrigir o que ainda nem editou.
    """

    repository: VehicleAdminRepository

    async def execute(self, vehicle_id: UUID, user: AuthenticatedUser) -> VehicleDetail:
        copy = await self.repository.duplicate(vehicle_id, created_by=user.id)
        if copy is None:
            raise NotFoundError("Veículo não encontrado.")
        return copy


@dataclass(frozen=True, slots=True)
class ArchiveVehicleUseCase:
    """A "exclusão" do dia a dia.

    Arquivar tira o anúncio do ar preservando o histórico, os agendamentos e as
    métricas. Um anúncio apagado por engano é receita perdida — e não há desfazer.
    """

    repository: VehicleAdminRepository

    async def execute(self, vehicle_id: UUID) -> VehicleDetail:
        vehicle = await self.repository.change_status(vehicle_id, VehicleStatus.ARCHIVED)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado.")
        return vehicle


@dataclass(frozen=True, slots=True)
class DeleteVehicleUseCase:
    """Remoção definitiva. Restrita ao SUPER_ADMIN."""

    repository: VehicleAdminRepository

    async def execute(self, vehicle_id: UUID, user: AuthenticatedUser) -> None:
        if not user.is_super_admin:
            raise AuthorizationError(
                "Apenas o administrador principal pode excluir um anúncio "
                "definitivamente. Use 'arquivar'."
            )

        vehicle = await self.repository.get_by_id(vehicle_id)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado.")

        removed = await self.repository.delete(vehicle_id)
        if not removed:
            # O banco recusou (ondelete=RESTRICT): existem agendamentos ligados
            # a este veículo. Apagá-lo destruiria o histórico dos leads.
            raise ConflictError("Este veículo tem agendamentos e não pode ser excluído. Arquive-o.")


# --------------------------------------------------------------------- imagens


@dataclass(frozen=True, slots=True)
class PrepareImageUploadUseCase:
    """Emite a autorização para o browser enviar a foto DIRETO ao Storage.

    O backend nunca vê os bytes da imagem — ver o comentário em
    `infrastructure/storage/supabase_storage.py`.
    """

    repository: VehicleAdminRepository
    storage: StorageService

    async def execute(self, vehicle_id: UUID, content_type: str) -> SignedUpload:
        from src.infrastructure.storage.supabase_storage import build_storage_path

        vehicle = await self.repository.get_by_id(vehicle_id)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado.")

        if len(vehicle.images) >= MAX_IMAGES_PER_VEHICLE:
            raise ValidationError(
                f"Este anúncio já tem {MAX_IMAGES_PER_VEHICLE} fotos, o máximo permitido."
            )

        return await self.storage.create_signed_upload(
            path=build_storage_path(vehicle_id, content_type)
        )


@dataclass(frozen=True, slots=True)
class RegisterImageUseCase:
    """Grava no banco a foto que o browser já subiu ao Storage."""

    repository: VehicleAdminRepository

    async def execute(self, vehicle_id: UUID, image: ImageWrite) -> Image:
        registered = await self.repository.add_image(vehicle_id, image)
        if registered is None:
            raise NotFoundError("Veículo não encontrado.")
        return registered


@dataclass(frozen=True, slots=True)
class DeleteImageUseCase:
    repository: VehicleAdminRepository
    storage: StorageService

    async def execute(self, image_id: UUID) -> None:
        storage_path = await self.repository.delete_image(image_id)
        if storage_path is None:
            raise NotFoundError("Imagem não encontrada.")

        # A ORDEM importa. Primeiro o banco, depois o Storage.
        #
        # Se o arquivo fosse apagado primeiro e o banco falhasse, sobraria um
        # registro apontando para uma foto que não existe — e a galeria exibiria
        # imagem quebrada para o visitante.
        #
        # Nesta ordem, o pior caso é um arquivo órfão no Storage: invisível,
        # inofensivo, e barato. Falha do Storage não derruba a operação (o
        # adapter devolve False e loga).
        await self.storage.delete(path=storage_path)


@dataclass(frozen=True, slots=True)
class ReorderImagesUseCase:
    repository: VehicleAdminRepository

    async def execute(self, vehicle_id: UUID, image_ids: list[UUID]) -> None:
        if len(set(image_ids)) != len(image_ids):
            raise ValidationError("A lista de imagens tem itens repetidos.")

        ok = await self.repository.reorder_images(vehicle_id, image_ids)
        if not ok:
            raise ValidationError("A lista precisa conter exatamente as imagens deste veículo.")


@dataclass(frozen=True, slots=True)
class SetCoverImageUseCase:
    repository: VehicleAdminRepository

    async def execute(self, vehicle_id: UUID, image_id: UUID) -> None:
        ok = await self.repository.set_cover_image(vehicle_id, image_id)
        if not ok:
            raise NotFoundError("Imagem não encontrada neste veículo.")


# -------------------------------------------------------------------- validação


def _validate(data: VehicleWrite) -> None:
    """Regras de negócio que o schema não expressa.

    O Pydantic garante o formato (é inteiro? é positivo?). Estas são as regras
    de *domínio*, que dependem da relação entre campos — e por isso vivem aqui,
    e não na borda HTTP: valem também para um import em lote ou um script, que
    não passam pelo FastAPI.
    """
    if data.year_model < data.year_manufacture:
        raise ValidationError(
            "O ano do modelo não pode ser anterior ao de fabricação.",
            details={"year_model": data.year_model, "year_manufacture": data.year_manufacture},
        )

    if data.down_payment is not None and data.down_payment >= data.price:
        raise ValidationError("A entrada não pode ser maior ou igual ao valor do veículo.")

    if data.installments_count is not None and not data.accepts_financing:
        raise ValidationError(
            "Não faz sentido informar parcelas num anúncio que não aceita financiamento."
        )
