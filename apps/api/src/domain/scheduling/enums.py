from __future__ import annotations

from enum import StrEnum


class AppointmentStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"

    @property
    def is_open(self) -> bool:
        """Ainda demanda ação do vendedor."""
        return self in {AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED}
