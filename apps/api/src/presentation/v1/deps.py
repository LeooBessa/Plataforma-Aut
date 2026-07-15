"""Injeção de dependência.

Este é o *composition root*: o único lugar que sabe amarrar uma interface do
domínio à sua implementação concreta. Os casos de uso recebem os repositórios
prontos e nunca souberam que existe Postgres do outro lado.

Trocar a implementação (um repositório em memória num teste, outro banco amanhã)
é mexer aqui — e em nenhum outro lugar.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.catalog.admin_use_cases import (
    ArchiveVehicleUseCase,
    ChangeVehicleStatusUseCase,
    CreateVehicleUseCase,
    DeleteImageUseCase,
    DeleteVehicleUseCase,
    DuplicateVehicleUseCase,
    GetAdminCatalogUseCase,
    GetAdminVehicleUseCase,
    ListAdminVehiclesUseCase,
    PrepareImageUploadUseCase,
    RegisterImageUseCase,
    ReorderImagesUseCase,
    SetCoverImageUseCase,
    UpdateVehicleUseCase,
)
from src.application.catalog.use_cases import (
    GetFilterOptionsUseCase,
    GetVehicleBySlugUseCase,
    ListFeaturedVehiclesUseCase,
    ListVehiclesUseCase,
)
from src.application.identity.use_cases import (
    LoginUseCase,
    LogoutUseCase,
    RefreshSessionUseCase,
)
from src.application.ports import EmailSender, RevalidationService, StorageService
from src.application.scheduling.use_cases import (
    CreateAppointmentUseCase,
    GetDashboardStatsUseCase,
    ListAppointmentsUseCase,
    UpdateAppointmentStatusUseCase,
)
from src.core.config import get_settings
from src.core.database import get_session
from src.core.exceptions import AuthenticationError, AuthorizationError
from src.core.security import PasswordHasher, get_password_hasher
from src.core.tokens import decode_access_token
from src.domain.catalog.repositories import VehicleAdminRepository, VehicleRepository
from src.domain.identity.entities import AuthenticatedUser
from src.domain.identity.repositories import RefreshTokenRepository, UserRepository
from src.domain.scheduling.repositories import AppointmentRepository, StatsRepository
from src.infrastructure.database.repositories.appointment_repository import (
    SqlAlchemyAppointmentRepository,
    SqlAlchemyStatsRepository,
)
from src.infrastructure.database.repositories.user_repository import (
    SqlAlchemyRefreshTokenRepository,
    SqlAlchemyUserRepository,
)
from src.infrastructure.database.repositories.vehicle_admin_repository import (
    SqlAlchemyVehicleAdminRepository,
)
from src.infrastructure.database.repositories.vehicle_repository import (
    SqlAlchemyVehicleRepository,
)
from src.infrastructure.email.senders import LoggingEmailSender, ResendEmailSender
from src.infrastructure.revalidation.next_revalidation import (
    NextRevalidationService,
    NoopRevalidationService,
)
from src.infrastructure.storage.supabase_storage import SupabaseStorageService

SessionDep = Annotated[AsyncSession, Depends(get_session)]


# ------------------------------------------------------------------ repositórios


def get_vehicle_repository(session: SessionDep) -> VehicleRepository:
    return SqlAlchemyVehicleRepository(session)


def get_user_repository(session: SessionDep) -> UserRepository:
    return SqlAlchemyUserRepository(session)


def get_refresh_token_repository(session: SessionDep) -> RefreshTokenRepository:
    return SqlAlchemyRefreshTokenRepository(session)


VehicleRepositoryDep = Annotated[VehicleRepository, Depends(get_vehicle_repository)]
UserRepositoryDep = Annotated[UserRepository, Depends(get_user_repository)]
RefreshTokenRepositoryDep = Annotated[RefreshTokenRepository, Depends(get_refresh_token_repository)]
PasswordHasherDep = Annotated[PasswordHasher, Depends(get_password_hasher)]


# ------------------------------------------------------------ casos de uso: catálogo


def get_list_vehicles_use_case(repository: VehicleRepositoryDep) -> ListVehiclesUseCase:
    return ListVehiclesUseCase(repository)


def get_vehicle_by_slug_use_case(repository: VehicleRepositoryDep) -> GetVehicleBySlugUseCase:
    return GetVehicleBySlugUseCase(repository)


def get_list_featured_use_case(repository: VehicleRepositoryDep) -> ListFeaturedVehiclesUseCase:
    return ListFeaturedVehiclesUseCase(repository)


def get_filter_options_use_case(repository: VehicleRepositoryDep) -> GetFilterOptionsUseCase:
    return GetFilterOptionsUseCase(repository)


ListVehiclesDep = Annotated[ListVehiclesUseCase, Depends(get_list_vehicles_use_case)]
GetVehicleDep = Annotated[GetVehicleBySlugUseCase, Depends(get_vehicle_by_slug_use_case)]
ListFeaturedDep = Annotated[ListFeaturedVehiclesUseCase, Depends(get_list_featured_use_case)]
FilterOptionsDep = Annotated[GetFilterOptionsUseCase, Depends(get_filter_options_use_case)]


# ---------------------------------------------------------- casos de uso: identidade


def get_login_use_case(
    users: UserRepositoryDep,
    refresh_tokens: RefreshTokenRepositoryDep,
    hasher: PasswordHasherDep,
) -> LoginUseCase:
    return LoginUseCase(users, refresh_tokens, hasher)


def get_refresh_session_use_case(
    users: UserRepositoryDep, refresh_tokens: RefreshTokenRepositoryDep
) -> RefreshSessionUseCase:
    return RefreshSessionUseCase(users, refresh_tokens)


def get_logout_use_case(refresh_tokens: RefreshTokenRepositoryDep) -> LogoutUseCase:
    return LogoutUseCase(refresh_tokens)


LoginDep = Annotated[LoginUseCase, Depends(get_login_use_case)]
RefreshSessionDep = Annotated[RefreshSessionUseCase, Depends(get_refresh_session_use_case)]
LogoutDep = Annotated[LogoutUseCase, Depends(get_logout_use_case)]


# ------------------------------------------------------------------ autenticação

# auto_error=False para que a ausência do cabeçalho caia no NOSSO tratamento de
# erro, com o mesmo formato de resposta do resto da API. Com auto_error=True, o
# FastAPI devolveria um 403 com corpo em outro formato — e o frontend teria que
# lidar com dois contratos de erro diferentes.
_bearer_scheme = HTTPBearer(auto_error=False)

BearerDep = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)]


async def get_current_user(credentials: BearerDep, users: UserRepositoryDep) -> AuthenticatedUser:
    """Resolve o usuário a partir do access token.

    O usuário é relido do banco a cada requisição, em vez de reconstruído a
    partir do que está dentro do JWT. Custa uma consulta, e paga por si:
    desativar uma conta passa a ter efeito IMEDIATO. Se confiássemos apenas no
    token, um funcionário demitido continuaria com acesso pleno até o token
    expirar — e não haveria como cortá-lo antes disso.
    """
    if credentials is None:
        raise AuthenticationError("Autenticação necessária.")

    payload = decode_access_token(credentials.credentials)
    user = await users.get_by_id(payload.user_id)

    if user is None or not user.is_active:
        raise AuthenticationError("Sessão inválida.")

    return user


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> AuthenticatedUser:
    """Exige perfil ADMIN ou SUPER_ADMIN."""
    if not user.is_admin:
        raise AuthorizationError("Você não tem permissão para esta ação.")
    return user


AdminUser = Annotated[AuthenticatedUser, Depends(require_admin)]


# ------------------------------------------------------- serviços externos (portas)


def get_email_sender() -> EmailSender:
    """Resend se houver chave; senão, um que só escreve no log.

    É o que permite rodar a aplicação inteira — e os testes — sem chave de API e
    sem mandar e-mail de verdade para ninguém. Nenhum caso de uso percebe a
    diferença: os dois implementam a mesma porta.
    """
    if get_settings().resend_api_key.get_secret_value():
        return ResendEmailSender()
    return LoggingEmailSender()


def get_storage_service() -> StorageService:
    return SupabaseStorageService()


def get_revalidation_service() -> RevalidationService:
    """Serviço real se o frontend estiver configurado; um no-op caso contrário.

    Assim a API roda sozinha (em teste, ou API-only) sem tentar avisar um
    frontend que não existe — e nenhum caso de uso percebe a diferença.
    """
    if get_settings().frontend_url and get_settings().revalidate_secret.get_secret_value():
        return NextRevalidationService()
    return NoopRevalidationService()


EmailSenderDep = Annotated[EmailSender, Depends(get_email_sender)]
StorageDep = Annotated[StorageService, Depends(get_storage_service)]
RevalidationDep = Annotated[RevalidationService, Depends(get_revalidation_service)]


# ----------------------------------------------------- repositórios administrativos


def get_vehicle_admin_repository(session: SessionDep) -> VehicleAdminRepository:
    return SqlAlchemyVehicleAdminRepository(session)


def get_appointment_repository(session: SessionDep) -> AppointmentRepository:
    return SqlAlchemyAppointmentRepository(session)


def get_stats_repository(session: SessionDep) -> StatsRepository:
    return SqlAlchemyStatsRepository(session)


VehicleAdminRepositoryDep = Annotated[VehicleAdminRepository, Depends(get_vehicle_admin_repository)]
AppointmentRepositoryDep = Annotated[AppointmentRepository, Depends(get_appointment_repository)]
StatsRepositoryDep = Annotated[StatsRepository, Depends(get_stats_repository)]


# ------------------------------------------------- casos de uso: catálogo (admin)


def get_list_admin_vehicles_use_case(repo: VehicleAdminRepositoryDep) -> ListAdminVehiclesUseCase:
    return ListAdminVehiclesUseCase(repo)


def get_admin_vehicle_use_case(repo: VehicleAdminRepositoryDep) -> GetAdminVehicleUseCase:
    return GetAdminVehicleUseCase(repo)


def get_admin_catalog_use_case(repo: VehicleAdminRepositoryDep) -> GetAdminCatalogUseCase:
    return GetAdminCatalogUseCase(repo)


def get_create_vehicle_use_case(repo: VehicleAdminRepositoryDep) -> CreateVehicleUseCase:
    return CreateVehicleUseCase(repo)


def get_update_vehicle_use_case(
    repo: VehicleAdminRepositoryDep, revalidation: RevalidationDep
) -> UpdateVehicleUseCase:
    return UpdateVehicleUseCase(repo, revalidation)


def get_change_status_use_case(
    repo: VehicleAdminRepositoryDep, revalidation: RevalidationDep
) -> ChangeVehicleStatusUseCase:
    return ChangeVehicleStatusUseCase(repo, revalidation)


def get_duplicate_vehicle_use_case(repo: VehicleAdminRepositoryDep) -> DuplicateVehicleUseCase:
    return DuplicateVehicleUseCase(repo)


def get_archive_vehicle_use_case(
    repo: VehicleAdminRepositoryDep, revalidation: RevalidationDep
) -> ArchiveVehicleUseCase:
    return ArchiveVehicleUseCase(repo, revalidation)


def get_delete_vehicle_use_case(
    repo: VehicleAdminRepositoryDep, revalidation: RevalidationDep
) -> DeleteVehicleUseCase:
    return DeleteVehicleUseCase(repo, revalidation)


def get_prepare_upload_use_case(
    repo: VehicleAdminRepositoryDep, storage: StorageDep
) -> PrepareImageUploadUseCase:
    return PrepareImageUploadUseCase(repo, storage)


def get_register_image_use_case(repo: VehicleAdminRepositoryDep) -> RegisterImageUseCase:
    return RegisterImageUseCase(repo)


def get_delete_image_use_case(
    repo: VehicleAdminRepositoryDep, storage: StorageDep
) -> DeleteImageUseCase:
    return DeleteImageUseCase(repo, storage)


def get_reorder_images_use_case(repo: VehicleAdminRepositoryDep) -> ReorderImagesUseCase:
    return ReorderImagesUseCase(repo)


def get_set_cover_use_case(repo: VehicleAdminRepositoryDep) -> SetCoverImageUseCase:
    return SetCoverImageUseCase(repo)


ListAdminVehiclesDep = Annotated[
    ListAdminVehiclesUseCase, Depends(get_list_admin_vehicles_use_case)
]
GetAdminVehicleDep = Annotated[GetAdminVehicleUseCase, Depends(get_admin_vehicle_use_case)]
AdminCatalogDep = Annotated[GetAdminCatalogUseCase, Depends(get_admin_catalog_use_case)]
CreateVehicleDep = Annotated[CreateVehicleUseCase, Depends(get_create_vehicle_use_case)]
UpdateVehicleDep = Annotated[UpdateVehicleUseCase, Depends(get_update_vehicle_use_case)]
ChangeVehicleStatusDep = Annotated[ChangeVehicleStatusUseCase, Depends(get_change_status_use_case)]
DuplicateVehicleDep = Annotated[DuplicateVehicleUseCase, Depends(get_duplicate_vehicle_use_case)]
ArchiveVehicleDep = Annotated[ArchiveVehicleUseCase, Depends(get_archive_vehicle_use_case)]
DeleteVehicleDep = Annotated[DeleteVehicleUseCase, Depends(get_delete_vehicle_use_case)]
PrepareImageUploadDep = Annotated[PrepareImageUploadUseCase, Depends(get_prepare_upload_use_case)]
RegisterImageDep = Annotated[RegisterImageUseCase, Depends(get_register_image_use_case)]
DeleteImageDep = Annotated[DeleteImageUseCase, Depends(get_delete_image_use_case)]
ReorderImagesDep = Annotated[ReorderImagesUseCase, Depends(get_reorder_images_use_case)]
SetCoverImageDep = Annotated[SetCoverImageUseCase, Depends(get_set_cover_use_case)]


# ---------------------------------------------------- casos de uso: agendamento


def get_create_appointment_use_case(
    appointments: AppointmentRepositoryDep,
    vehicles: VehicleRepositoryDep,
    email: EmailSenderDep,
) -> CreateAppointmentUseCase:
    return CreateAppointmentUseCase(
        appointments=appointments,
        vehicles=vehicles,
        email=email,
        admin_email=get_settings().admin_notification_email,
    )


def get_list_appointments_use_case(repo: AppointmentRepositoryDep) -> ListAppointmentsUseCase:
    return ListAppointmentsUseCase(repo)


def get_update_appointment_status_use_case(
    repo: AppointmentRepositoryDep,
) -> UpdateAppointmentStatusUseCase:
    return UpdateAppointmentStatusUseCase(repo)


def get_dashboard_stats_use_case(repo: StatsRepositoryDep) -> GetDashboardStatsUseCase:
    return GetDashboardStatsUseCase(repo)


CreateAppointmentDep = Annotated[CreateAppointmentUseCase, Depends(get_create_appointment_use_case)]
ListAppointmentsDep = Annotated[ListAppointmentsUseCase, Depends(get_list_appointments_use_case)]
UpdateAppointmentStatusDep = Annotated[
    UpdateAppointmentStatusUseCase, Depends(get_update_appointment_status_use_case)
]
DashboardStatsDep = Annotated[GetDashboardStatsUseCase, Depends(get_dashboard_stats_use_case)]
