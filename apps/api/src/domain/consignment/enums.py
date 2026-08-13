from __future__ import annotations

from enum import StrEnum


class ConsignmentStatus(StrEnum):
    """Estágios de um pedido para anunciar o carro.

    O ciclo é o da consignação, não o de uma compra: a loja não adquire o
    veículo, ela o coloca à venda. Por isso `PUBLISHED` (foi anunciado) e não
    "comprado".
    """

    NEW = "new"
    CONTACTED = "contacted"
    PUBLISHED = "published"
    DECLINED = "declined"

    @property
    def is_open(self) -> bool:
        """Ainda espera ação da loja.

        Serve para o painel destacar o que precisa de resposta — um pedido
        parado em `NEW` é dinheiro esperando na porta.
        """
        return self in {ConsignmentStatus.NEW, ConsignmentStatus.CONTACTED}
