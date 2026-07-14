"""Casos de uso de agendamento."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from uuid import UUID

from src.application.ports import EmailSender
from src.core.exceptions import NotFoundError, ValidationError
from src.domain.catalog.enums import VehicleStatus
from src.domain.catalog.repositories import VehicleRepository
from src.domain.catalog.value_objects import Page, Pagination
from src.domain.scheduling.entities import (
    Appointment,
    AppointmentDraft,
    DashboardStats,
)
from src.domain.scheduling.enums import AppointmentStatus
from src.domain.scheduling.repositories import AppointmentRepository, StatsRepository
from src.domain.scheduling.value_objects import (
    BUSINESS_HOURS_END,
    BUSINESS_HOURS_START,
    MAX_DAYS_AHEAD,
    AppointmentFilters,
)

logger = logging.getLogger(__name__)

# Um agendamento para um carro arquivado ou em rascunho não existe: o cliente
# nem deveria ter visto o anúncio. Vendido, porém, é permitido — a página
# continua no ar e alguém pode querer ver um parecido.
SCHEDULABLE_STATUSES = [VehicleStatus.ACTIVE, VehicleStatus.RESERVED]


@dataclass(frozen=True, slots=True)
class CreateAppointmentUseCase:
    """Cria o lead.

    Este é o caso de uso mais valioso da plataforma: cada execução bem-sucedida
    é um cliente querendo ver um carro. A regra número um aqui é **nunca perder
    o lead** — nem por falha de e-mail, nem por indisponibilidade de terceiros.
    """

    appointments: AppointmentRepository
    vehicles: VehicleRepository
    email: EmailSender
    admin_email: str

    async def execute(self, draft: AppointmentDraft, vehicle_slug: str) -> Appointment:
        vehicle = await self.vehicles.get_by_slug(vehicle_slug, statuses=SCHEDULABLE_STATUSES)
        if vehicle is None:
            raise NotFoundError("Veículo não encontrado ou indisponível para visita.")

        self._validate_schedule(draft)

        appointment = await self.appointments.create(
            AppointmentDraft(
                vehicle_id=vehicle.id,
                customer_name=draft.customer_name.strip(),
                phone=draft.phone,
                whatsapp=draft.whatsapp,
                email=draft.email.strip().lower(),
                scheduled_date=draft.scheduled_date,
                scheduled_time=draft.scheduled_time,
                notes=draft.notes,
                ip_address=draft.ip_address,
            )
        )

        # O e-mail é enviado DEPOIS de gravar, e a falha dele é engolida de
        # propósito.
        #
        # Em serverless não existe fila nem worker: ou mandamos o e-mail dentro
        # da requisição, ou não mandamos. Se deixássemos a exceção subir, uma
        # instabilidade no provedor de e-mail devolveria erro ao cliente — que
        # tentaria de novo, ou desistiria — mesmo com o agendamento JÁ salvo no
        # banco. Perderíamos a venda por causa de um e-mail.
        #
        # Então: o lead está seguro no banco, e a notificação é best-effort. Se
        # falhar, vai para o log e o admin ainda vê o agendamento no painel.
        await self._notify_admin(appointment)

        return appointment

    def _validate_schedule(self, draft: AppointmentDraft) -> None:
        today = date.today()

        if draft.scheduled_date < today:
            raise ValidationError("A data da visita não pode estar no passado.")

        if draft.scheduled_date > today + timedelta(days=MAX_DAYS_AHEAD):
            raise ValidationError(
                f"Só é possível agendar visitas com até {MAX_DAYS_AHEAD} dias de antecedência."
            )

        if not BUSINESS_HOURS_START <= draft.scheduled_time <= BUSINESS_HOURS_END:
            raise ValidationError(
                f"Escolha um horário entre {BUSINESS_HOURS_START:%H:%M} e "
                f"{BUSINESS_HOURS_END:%H:%M}."
            )

    async def _notify_admin(self, appointment: Appointment) -> None:
        if not self.admin_email:
            return

        html = f"""
        <h2>Nova visita agendada</h2>
        <p><strong>Veículo:</strong> {appointment.vehicle.title}</p>
        <p><strong>Cliente:</strong> {appointment.customer_name}</p>
        <p><strong>Telefone:</strong> {appointment.phone}</p>
        <p><strong>E-mail:</strong> {appointment.email}</p>
        <p><strong>Data:</strong> {appointment.scheduled_date:%d/%m/%Y} às
           {appointment.scheduled_time:%H:%M}</p>
        <p><strong>Observações:</strong> {appointment.notes or "—"}</p>
        """

        enviado = await self.email.send(
            to=self.admin_email,
            subject=f"Nova visita: {appointment.vehicle.title}",
            html=html,
        )

        if not enviado:
            # O lead ESTÁ salvo. Isto é só a notificação que não saiu.
            logger.error(
                "Falha ao notificar o admin do agendamento %s — o lead está salvo no banco.",
                appointment.id,
            )


@dataclass(frozen=True, slots=True)
class ListAppointmentsUseCase:
    appointments: AppointmentRepository

    async def execute(
        self, filters: AppointmentFilters, pagination: Pagination
    ) -> Page[Appointment]:
        if filters.date_from and filters.date_to and filters.date_from > filters.date_to:
            raise ValidationError("A data inicial não pode ser maior que a final.")

        return await self.appointments.search(filters, pagination)


@dataclass(frozen=True, slots=True)
class UpdateAppointmentStatusUseCase:
    appointments: AppointmentRepository

    async def execute(self, appointment_id: UUID, status: AppointmentStatus) -> Appointment:
        current = await self.appointments.get_by_id(appointment_id)
        if current is None:
            raise NotFoundError("Agendamento não encontrado.")

        # Um agendamento finalizado ou cancelado é histórico. Reabri-lo apagaria
        # o registro do que aconteceu — e o painel deixaria de refletir a
        # realidade do atendimento.
        if not current.status.is_open:
            raise ValidationError(
                f"Este agendamento já foi {current.status.value} e não pode mais mudar de status."
            )

        updated = await self.appointments.update_status(appointment_id, status)
        if updated is None:
            raise NotFoundError("Agendamento não encontrado.")

        return updated


@dataclass(frozen=True, slots=True)
class GetDashboardStatsUseCase:
    stats: StatsRepository

    async def execute(self) -> DashboardStats:
        return await self.stats.get_dashboard_stats()
