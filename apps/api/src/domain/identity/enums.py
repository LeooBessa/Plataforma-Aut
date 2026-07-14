from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    """Perfis de acesso.

    Hierárquico: SUPER_ADMIN ⊃ ADMIN ⊃ SELLER.

    - SELLER: gerencia os próprios anúncios e agendamentos.
    - ADMIN: gerencia tudo dentro da sua concessionária, inclusive usuários.
    - SUPER_ADMIN: atravessa concessionárias. Existe desde já porque o modelo é
      multi-tenant; hoje, com uma única concessionária, é quem opera a plataforma.
    """

    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    SELLER = "seller"
