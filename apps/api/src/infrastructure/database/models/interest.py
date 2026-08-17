from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Index, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base
from src.domain.catalog.enums import BodyType
from src.domain.interest.enums import InterestStatus
from src.infrastructure.database.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class VehicleInterest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Quem quer ser avisado quando o carro certo entrar no estoque.

    É o oposto da consignação: aquela traz CARRO, esta traz COMPRADOR. E a
    diferença de modelagem entre as duas é proposital.

    ----------------------------------------------------------------------------
    AQUI HÁ FK PARA MARCA E MODELO — na consignação não há
    ----------------------------------------------------------------------------
    Quem VENDE descreve o carro que tem, e texto livre é o que não custa o
    contato. Quem COMPRA precisa que a escolha case com o que a loja cadastra:
    todo o valor desta tabela está no CRUZAMENTO com `vehicles`, e cruzamento
    por texto livre não funciona — "fiat toro", "Toro" e "Fiat TORO 1.8" seriam
    três coisas diferentes para o banco.

    `ON DELETE RESTRICT` na marca: apagar uma marca do catálogo com gente
    esperando por ela deixaria pedidos órfãos que nunca mais cruzam com nada.
    Que a exclusão falhe e alguém decida o que fazer.

    ----------------------------------------------------------------------------
    MODELO E CATEGORIA SÃO OPCIONAIS
    ----------------------------------------------------------------------------
    "Qualquer Fiat até 40 mil" é pedido legítimo, e provavelmente o mais comum.
    Nulo aqui significa "tanto faz", e é assim que o cruzamento trata: campo
    vazio não restringe.
    """

    __tablename__ = "vehicle_interests"
    __table_args__ = (
        # O painel abre por status e data, como o de consignação.
        Index("ix_interest_status_created", "status", "created_at"),
        # O cruzamento filtra por marca e teto de preço — este índice é o que
        # segura a consulta quando a lista de espera crescer.
        Index("ix_interest_brand_price", "brand_id", "max_price"),
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    # E-mail é opcional: o canal que a loja usa é o WhatsApp. Fica para quem
    # prefere escrever e para o que é documento.
    email: Mapped[str | None] = mapped_column(String(160))

    brand_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("brands.id", ondelete="RESTRICT"), nullable=False
    )
    model_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vehicle_models.id", ondelete="RESTRICT")
    )
    # MESMO tipo `body_type` que a tabela de veículos usa — sem isso o
    # cruzamento compararia enums diferentes. `values_callable` grava o VALOR
    # ("suv") e não o nome do membro ("SUV"), que é a convenção do banco.
    body_type: Mapped[BodyType | None] = mapped_column(
        Enum(BodyType, name="body_type", values_callable=lambda e: [m.value for m in e])
    )

    # Numeric, nunca float: é o teto que decide se um carro é oportunidade.
    max_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    notes: Mapped[str | None] = mapped_column(Text)

    status: Mapped[InterestStatus] = mapped_column(
        Enum(
            InterestStatus,
            name="interest_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=InterestStatus.NEW,
        server_default=text("'new'"),
    )

    # Só para o limite por IP e para investigar abuso. Não aparece no painel.
    ip_address: Mapped[str | None] = mapped_column(String(45))
