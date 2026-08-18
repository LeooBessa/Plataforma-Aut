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
from src.domain.consignment.enums import ConsignmentStatus
from src.domain.consignment.value_objects import ConsignmentFilters
from src.domain.content.enums import ArticleStatus
from src.domain.content.value_objects import ArticleFilters
from src.domain.interest.enums import InterestStatus
from src.domain.interest.value_objects import InterestFilters
from src.domain.scheduling.enums import AppointmentStatus
from src.domain.scheduling.value_objects import AppointmentFilters
from src.presentation.v1.deps import (
    AdminCatalogDep,
    AdminUser,
    ArchiveVehicleDep,
    ChangeVehicleStatusDep,
    CreateBrandDep,
    CreateModelDep,
    CreateVehicleDep,
    DashboardStatsDep,
    DeleteArticleDep,
    DeleteImageDep,
    DeleteVehicleDep,
    DuplicateVehicleDep,
    GetAdminArticleDep,
    GetAdminVehicleDep,
    ListAdminVehiclesDep,
    ListAppointmentsDep,
    ListConsignmentsDep,
    ListInterestsDep,
    PrepareImageUploadDep,
    RegisterImageDep,
    ReorderImagesDep,
    SaveArticleDep,
    SetCoverImageDep,
    StorageDep,
    UpdateAppointmentStatusDep,
    UpdateConsignmentStatusDep,
    UpdateInterestStatusDep,
    UpdateVehicleDep,
    require_admin,
)
from src.presentation.v1.deps import (
    ListArticlesDep as ListAdminArticlesDep,
)
from src.presentation.v1.schemas.admin_vehicle import (
    AdminBrandOut,
    AdminCatalogOut,
    AdminModelOut,
    BrandCreateIn,
    ImageRegisterIn,
    ImageReorderIn,
    ModelCreateIn,
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
from src.presentation.v1.schemas.consignment import (
    ConsignmentOut,
    ConsignmentPageOut,
    ConsignmentStatusIn,
)
from src.presentation.v1.schemas.content import (
    ArticleIn,
    ArticleOut,
    ArticlePageOut,
)
from src.presentation.v1.schemas.interest import (
    InterestOut,
    InterestPageOut,
    InterestStatusIn,
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


# --------------------------------------------------------------- consignação


@router.get(
    "/consignments",
    response_model=ConsignmentPageOut,
    summary="Pedidos para anunciar o carro",
)
async def list_consignments(
    use_case: ListConsignmentsDep,
    q: Annotated[str | None, Query(max_length=120, description="Busca por dono ou carro")] = None,
    status_filter: Annotated[list[ConsignmentStatus] | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
) -> ConsignmentPageOut:
    """Os mais recentes primeiro.

    Ao contrário dos agendamentos, ordenados pela visita mais próxima: quem quer
    vender o carro está falando com outras lojas ao mesmo tempo, e o pedido que
    acabou de chegar é o que ainda dá para ganhar.
    """
    result = await use_case.execute(
        ConsignmentFilters(query=q, statuses=status_filter or []),
        Pagination(page=page, page_size=page_size),
    )
    return ConsignmentPageOut.from_page(result)


@router.patch(
    "/consignments/{request_id}/status",
    response_model=ConsignmentOut,
    summary="Marcar como contatado, anunciado ou recusado",
)
async def update_consignment_status(
    request_id: UUID,
    payload: ConsignmentStatusIn,
    use_case: UpdateConsignmentStatusDep,
) -> ConsignmentOut:
    pedido = await use_case.execute(request_id, payload.status)
    return ConsignmentOut.model_validate(pedido)


# ------------------------------------------------------------------ interesse


@router.get(
    "/interests",
    response_model=InterestPageOut,
    summary="Quem pediu para ser avisado",
)
async def list_interests(
    use_case: ListInterestsDep,
    q: Annotated[
        str | None, Query(max_length=120, description="Busca por pessoa, marca ou modelo")
    ] = None,
    status_filter: Annotated[list[InterestStatus] | None, Query(alias="status")] = None,
    com_estoque: Annotated[
        bool, Query(alias="matching", description="Só quem já tem carro compatível no pátio")
    ] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
) -> InterestPageOut:
    """Cada item já vem com os carros do estoque que batem com o pedido.

    É o que separa esta tela de uma lista morta: sem o cruzamento, o vendedor
    teria de abrir o estoque e conferir de cabeça a cada carro que entra — e não
    faria. Com `matching=true`, a lista mostra só quem dá para atender HOJE.
    """
    result = await use_case.execute(
        InterestFilters(query=q, statuses=status_filter or [], only_with_matches=com_estoque),
        Pagination(page=page, page_size=page_size),
    )
    return InterestPageOut.from_page(result)


@router.patch(
    "/interests/{interest_id}/status",
    response_model=InterestOut,
    summary="Marcar como avisado ou encerrado",
)
async def update_interest_status(
    interest_id: UUID,
    payload: InterestStatusIn,
    use_case: UpdateInterestStatusDep,
) -> InterestOut:
    pedido = await use_case.execute(interest_id, payload.status)
    return InterestOut.model_validate(pedido)


# ------------------------------------------------------- escrita no catálogo


@router.post(
    "/catalog/brands",
    response_model=AdminBrandOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar marca",
)
async def create_brand(payload: BrandCreateIn, use_case: CreateBrandDep) -> AdminBrandOut:
    """O catálogo NUNCA vai estar completo.

    São milhares de modelos no mercado brasileiro, e qualquer lista curada terá
    buraco. Sem esta rota, faltando uma marca o vendedor trava no select e
    depende de um programador — o que na prática significa não cadastrar o carro.
    """
    marca = await use_case.execute(payload.name)
    return AdminBrandOut.model_validate(marca)


@router.post(
    "/catalog/models",
    response_model=AdminModelOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar modelo",
)
async def create_model(payload: ModelCreateIn, use_case: CreateModelDep) -> AdminModelOut:
    modelo = await use_case.execute(payload.brand_id, payload.name)
    return AdminModelOut.model_validate(modelo)


# ------------------------------------------------------------------- artigos


@router.post(
    "/articles/cover-upload-url",
    response_model=UploadUrlOut,
    summary="Autorizar upload da capa do artigo",
)
async def create_article_cover_upload_url(
    payload: UploadUrlIn, storage: StorageDep
) -> UploadUrlOut:
    """Mesmo desenho do upload de foto de carro: a imagem NÃO passa por aqui.

    A função serverless tem limite de tamanho de corpo e uma imagem o estoura. O
    browser recebe uma autorização temporária e escreve direto no Storage.

    Diferente das fotos de veículo, a autorização não exige um artigo existente:
    quem escreve escolhe a capa enquanto redige, antes de salvar pela primeira
    vez.
    """
    from src.infrastructure.storage.supabase_storage import build_article_cover_path

    signed = await storage.create_signed_upload(path=build_article_cover_path(payload.content_type))
    return UploadUrlOut(
        upload_url=signed.upload_url,
        token=signed.token,
        storage_path=signed.storage_path,
        public_url=signed.public_url,
    )


@router.get("/articles", response_model=ArticlePageOut, summary="Listar artigos (todos)")
async def list_admin_articles(
    use_case: ListAdminArticlesDep,
    q: Annotated[str | None, Query(max_length=120)] = None,
    status_filter: Annotated[list[ArticleStatus] | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
) -> ArticlePageOut:
    """Enxerga rascunho, ao contrário da rota pública."""
    result = await use_case.execute(
        ArticleFilters(query=q, statuses=status_filter or []),
        Pagination(page=page, page_size=page_size),
    )
    return ArticlePageOut.from_page(result)


@router.get("/articles/{article_id}", response_model=ArticleOut, summary="Ver artigo")
async def get_admin_article(article_id: UUID, use_case: GetAdminArticleDep) -> ArticleOut:
    return ArticleOut.model_validate(await use_case.execute(article_id))


@router.post(
    "/articles",
    response_model=ArticleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar artigo",
)
async def create_article(payload: ArticleIn, use_case: SaveArticleDep) -> ArticleOut:
    return ArticleOut.model_validate(await use_case.execute(payload.to_domain()))


@router.put("/articles/{article_id}", response_model=ArticleOut, summary="Editar artigo")
async def update_article(
    article_id: UUID, payload: ArticleIn, use_case: SaveArticleDep
) -> ArticleOut:
    artigo = await use_case.execute(payload.to_domain(), article_id=article_id)
    return ArticleOut.model_validate(artigo)


@router.delete(
    "/articles/{article_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir artigo",
)
async def delete_article(article_id: UUID, use_case: DeleteArticleDep) -> None:
    await use_case.execute(article_id)
