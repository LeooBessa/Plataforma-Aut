"""Rotas administrativas.

TODAS exigem autenticação. A proteção é declarada UMA vez, no router, e não
endpoint por endpoint — porque proteger endpoint por endpoint significa que, um
dia, alguém adiciona uma rota nova e esquece o decorator. Aqui, uma rota nova
nasce protegida por construção.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.value_objects import (
    MAX_PAGE_SIZE,
    Pagination,
    VehicleFilters,
    VehicleSort,
)
from src.domain.scheduling.enums import AppointmentStatus
from src.domain.scheduling.value_objects import AppointmentFilters
from src.presentation.v1.deps import (
    AdminCatalogDep,
    AdminUser,
    ArchiveVehicleDep,
    ChangeVehicleStatusDep,
    CreateVehicleDep,
    DashboardStatsDep,
    DeleteImageDep,
    DeleteVehicleDep,
    DuplicateVehicleDep,
    GetAdminVehicleDep,
    ListAdminVehiclesDep,
    ListAppointmentsDep,
    PrepareImageUploadDep,
    RegisterImageDep,
    ReorderImagesDep,
    SetCoverImageDep,
    UpdateAppointmentStatusDep,
    UpdateVehicleDep,
    require_admin,
)
from src.presentation.v1.schemas.admin_vehicle import (
    AdminCatalogOut,
    ImageRegisterIn,
    ImageReorderIn,
    UploadUrlIn,
    UploadUrlOut,
    VehicleIn,
    VehicleStatusIn,
)
from src.presentation.v1.schemas.appointment import (
    AppointmentOut,
    AppointmentPageOut,
    AppointmentStatusIn,
    DashboardStatsOut,
)
from src.presentation.v1.schemas.vehicle import (
    ImageOut,
    VehicleDetailOut,
    VehiclePageOut,
)

router = APIRouter(
    prefix="/admin",
    tags=["administração"],
    dependencies=[Depends(require_admin)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Não autenticado"},
        status.HTTP_403_FORBIDDEN: {"description": "Sem permissão"},
    },
)


# ------------------------------------------------------------------- dashboard


@router.get("/stats", response_model=DashboardStatsOut, summary="Números do dashboard")
async def get_stats(use_case: DashboardStatsDep) -> DashboardStatsOut:
    return DashboardStatsOut.model_validate(await use_case.execute())


@router.get(
    "/catalog",
    response_model=AdminCatalogOut,
    summary="Marcas, modelos e opcionais (para o formulário)",
)
async def get_catalog(use_case: AdminCatalogDep) -> AdminCatalogOut:
    """TODAS as marcas e opcionais, inclusive os sem veículo algum.

    Diferente de `/vehicles/filters` (público), que só mostra o que tem anúncio
    publicado. Se este endpoint filtrasse por status, seria impossível cadastrar
    o primeiro carro de uma marca nova — ela não apareceria na lista.
    """
    return AdminCatalogOut.model_validate(await use_case.execute())


# -------------------------------------------------------------------- veículos


@router.get("/vehicles", response_model=VehiclePageOut, summary="Listar anúncios (todos)")
async def list_vehicles(
    use_case: ListAdminVehiclesDep,
    q: Annotated[str | None, Query(max_length=120)] = None,
    status_filter: Annotated[list[VehicleStatus] | None, Query(alias="status")] = None,
    sort: Annotated[VehicleSort, Query()] = VehicleSort.NEWEST,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
) -> VehiclePageOut:
    """Diferente da listagem pública: aqui aparecem rascunhos e arquivados."""
    result = await use_case.execute(
        VehicleFilters(query=q, sort=sort),
        Pagination(page=page, page_size=page_size),
        statuses=status_filter,
    )
    return VehiclePageOut.from_page(result)


@router.get("/vehicles/{vehicle_id}", response_model=VehicleDetailOut, summary="Ver anúncio")
async def get_vehicle(vehicle_id: UUID, use_case: GetAdminVehicleDep) -> VehicleDetailOut:
    return VehicleDetailOut.model_validate(await use_case.execute(vehicle_id))


@router.post(
    "/vehicles",
    response_model=VehicleDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar anúncio",
)
async def create_vehicle(
    payload: VehicleIn, user: AdminUser, use_case: CreateVehicleDep
) -> VehicleDetailOut:
    vehicle = await use_case.execute(payload.to_domain(), user)
    return VehicleDetailOut.model_validate(vehicle)


@router.put("/vehicles/{vehicle_id}", response_model=VehicleDetailOut, summary="Editar anúncio")
async def update_vehicle(
    vehicle_id: UUID, payload: VehicleIn, use_case: UpdateVehicleDep
) -> VehicleDetailOut:
    vehicle = await use_case.execute(vehicle_id, payload.to_domain())
    return VehicleDetailOut.model_validate(vehicle)


@router.patch(
    "/vehicles/{vehicle_id}/status",
    response_model=VehicleDetailOut,
    summary="Publicar, reservar, marcar como vendido ou arquivar",
)
async def change_status(
    vehicle_id: UUID, payload: VehicleStatusIn, use_case: ChangeVehicleStatusDep
) -> VehicleDetailOut:
    vehicle = await use_case.execute(vehicle_id, payload.status)
    return VehicleDetailOut.model_validate(vehicle)


@router.post(
    "/vehicles/{vehicle_id}/duplicate",
    response_model=VehicleDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicar anúncio",
)
async def duplicate_vehicle(
    vehicle_id: UUID, user: AdminUser, use_case: DuplicateVehicleDep
) -> VehicleDetailOut:
    """A cópia nasce como RASCUNHO e SEM as fotos.

    Sem foto porque elas mostram *aquele* carro — quilometragem no painel,
    arranhão no para-choque. Reaproveitá-las noutro veículo é enganar o comprador.
    """
    return VehicleDetailOut.model_validate(await use_case.execute(vehicle_id, user))


@router.post(
    "/vehicles/{vehicle_id}/archive",
    response_model=VehicleDetailOut,
    summary="Arquivar anúncio (a 'exclusão' do dia a dia)",
)
async def archive_vehicle(vehicle_id: UUID, use_case: ArchiveVehicleDep) -> VehicleDetailOut:
    return VehicleDetailOut.model_validate(await use_case.execute(vehicle_id))


@router.delete(
    "/vehicles/{vehicle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir definitivamente (apenas SUPER_ADMIN)",
)
async def delete_vehicle(vehicle_id: UUID, user: AdminUser, use_case: DeleteVehicleDep) -> None:
    """Irreversível, e por isso restrita.

    Falha se houver agendamentos: apagar o veículo destruiria o histórico de
    quem demonstrou interesse nele. Nesse caso, arquive.
    """
    await use_case.execute(vehicle_id, user)


# ---------------------------------------------------------------------- fotos


@router.post(
    "/vehicles/{vehicle_id}/images/upload-url",
    response_model=UploadUrlOut,
    summary="Autorizar upload de foto (direto ao Storage)",
)
async def create_upload_url(
    vehicle_id: UUID, payload: UploadUrlIn, use_case: PrepareImageUploadDep
) -> UploadUrlOut:
    """Passo 1 de 2 do upload.

    A foto NÃO passa por aqui: a função serverless tem limite de tamanho de
    corpo e uma imagem o estoura. Este endpoint devolve uma autorização temporária
    para o browser escrever direto no Storage; depois ele chama `POST .../images`
    para registrar o que subiu.
    """
    signed = await use_case.execute(vehicle_id, payload.content_type)
    return UploadUrlOut(
        upload_url=signed.upload_url,
        token=signed.token,
        storage_path=signed.storage_path,
        public_url=signed.public_url,
    )


@router.post(
    "/vehicles/{vehicle_id}/images",
    response_model=ImageOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar foto já enviada ao Storage",
)
async def register_image(
    vehicle_id: UUID, payload: ImageRegisterIn, use_case: RegisterImageDep
) -> ImageOut:
    """Passo 2 de 2. A primeira foto do anúncio vira a capa automaticamente."""
    image = await use_case.execute(vehicle_id, payload.to_domain())
    return ImageOut.model_validate(image)


@router.patch(
    "/vehicles/{vehicle_id}/images/order",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reordenar a galeria",
)
async def reorder_images(
    vehicle_id: UUID, payload: ImageReorderIn, use_case: ReorderImagesDep
) -> None:
    await use_case.execute(vehicle_id, payload.image_ids)


@router.patch(
    "/vehicles/{vehicle_id}/images/{image_id}/cover",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Definir a foto de capa",
)
async def set_cover(vehicle_id: UUID, image_id: UUID, use_case: SetCoverImageDep) -> None:
    await use_case.execute(vehicle_id, image_id)


@router.delete(
    "/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover foto",
)
async def delete_image(image_id: UUID, use_case: DeleteImageDep) -> None:
    """Remove do banco e depois do Storage, nessa ordem.

    Se a capa for removida, a próxima foto assume — um anúncio publicado sem capa
    aparece sem imagem na listagem, e ninguém clica num card vazio.
    """
    await use_case.execute(image_id)


# ---------------------------------------------------------------- agendamentos


@router.get(
    "/appointments",
    response_model=AppointmentPageOut,
    summary="Listar agendamentos",
)
async def list_appointments(
    use_case: ListAppointmentsDep,
    customer: Annotated[str | None, Query(max_length=120)] = None,
    vehicle_id: Annotated[UUID | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    status_filter: Annotated[list[AppointmentStatus] | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
) -> AppointmentPageOut:
    result = await use_case.execute(
        AppointmentFilters(
            customer=customer,
            vehicle_id=vehicle_id,
            date_from=date_from,
            date_to=date_to,
            statuses=status_filter,
        ),
        Pagination(page=page, page_size=page_size),
    )
    return AppointmentPageOut.from_page(result)


@router.patch(
    "/appointments/{appointment_id}/status",
    response_model=AppointmentOut,
    summary="Confirmar, cancelar ou finalizar",
)
async def update_appointment_status(
    appointment_id: UUID,
    payload: AppointmentStatusIn,
    use_case: UpdateAppointmentStatusDep,
) -> AppointmentOut:
    """Um agendamento já cancelado ou finalizado é histórico e não muda mais."""
    appointment = await use_case.execute(appointment_id, payload.status)
    return AppointmentOut.model_validate(appointment)


@router.get("/health", include_in_schema=False)
async def admin_health(response: Response) -> dict[str, str]:
    """Serve para o frontend testar rapidamente se a sessão ainda é válida."""
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok"}
