from __future__ import annotations

import uuid
from datetime import date, time
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, Index, String, Text, Time, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.domain.scheduling.enums import AppointmentStatus
from src.infrastructure.database.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from src.infrastructure.database.models.catalog import Vehicle


class Appointment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Agendamento de visita — o lead. É o ativo comercial da plataforma.

    Duas consequências práticas disso:

    1. O visitante NÃO precisa de conta. Exigir cadastro para agendar uma visita
       derruba a conversão. Os dados do cliente ficam aqui, denormalizados.

    2. `ondelete="RESTRICT"` no veículo: um anúncio com agendamentos não pode ser
       apagado do banco. Ele é arquivado (`status = ARCHIVED`). Apagar o veículo
       levaria junto o histórico de quem demonstrou interesse nele.
    """

    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_status_date", "status", "scheduled_date"),
        Index("ix_appointments_dealership_status", "dealership_id", "status"),
    )

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("vehicles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    dealership_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("dealerships.id", ondelete="CASCADE"), nullable=False
    )

    customer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    whatsapp: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    scheduled_time: Mapped[time] = mapped_column(Time, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(
            AppointmentStatus,
            name="appointment_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=AppointmentStatus.PENDING,
        server_default=text("'pending'"),
    )

    # Guardado para investigar abuso e correlacionar com o rate limit.
    ip_address: Mapped[str | None] = mapped_column(String(45))

    vehicle: Mapped[Vehicle] = relationship(back_populates="appointments")
