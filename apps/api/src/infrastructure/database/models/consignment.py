from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Enum, Index, Integer, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base
from src.domain.consignment.enums import ConsignmentStatus
from src.infrastructure.database.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class ConsignmentRequest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Pedido de quem quer anunciar o carro pela loja.

    É lead de ESTOQUE, ao contrário do agendamento, que é lead de venda. Os dois
    entram sem login e pelo mesmo tipo de formulário público, mas resolvem lados
    opostos do negócio: um traz comprador, este traz carro para vender.

    ----------------------------------------------------------------------------
    POR QUE NÃO HÁ `dealership_id` AQUI
    ----------------------------------------------------------------------------
    O agendamento deriva a concessionária do VEÍCULO — o carro já sabe de quem
    é. Aqui não existe veículo: o carro é de quem está preenchendo, e o campo é
    texto livre.

    Inventar o vínculo (pegar "a primeira concessionária do banco") criaria um
    dado que parece confiável e não é — e o erro só apareceria no dia em que a
    plataforma tivesse duas lojas, com pedidos silenciosamente atribuídos à
    errada. Preferi a ausência explícita: quando houver mais de uma loja, o
    vínculo virá do domínio pelo qual o pedido entrou, que é a informação
    correta, e a coluna nasce com um valor de verdade.

    ----------------------------------------------------------------------------
    O CARRO É TEXTO LIVRE
    ----------------------------------------------------------------------------
    Sem FK para `brands`/`models`. Quem vende sabe descrever o que tem; obrigá-lo
    a achar o modelo numa lista longa, no celular, custa o contato. A loja
    normaliza na hora de criar o anúncio real.
    """

    __tablename__ = "consignment_requests"
    __table_args__ = (
        # A tela do painel abre ordenada por status e data — é o caminho quente,
        # e sem este índice ele vira varredura de tabela assim que os pedidos
        # acumularem.
        Index("ix_consignment_status_created", "status", "created_at"),
    )

    owner_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)

    vehicle: Mapped[str] = mapped_column(String(160), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    mileage: Mapped[int] = mapped_column(Integer, nullable=False)

    # Numeric, nunca float: dinheiro em ponto flutuante acumula erro de
    # arredondamento, e aqui o valor é a base da negociação.
    asking_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    city: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)

    status: Mapped[ConsignmentStatus] = mapped_column(
        Enum(
            ConsignmentStatus,
            name="consignment_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=ConsignmentStatus.NEW,
        server_default=text("'new'"),
    )

    # Guardado para investigar abuso, como no agendamento.
    ip_address: Mapped[str | None] = mapped_column(String(45))
