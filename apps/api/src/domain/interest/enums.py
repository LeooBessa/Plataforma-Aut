from __future__ import annotations

from enum import StrEnum


class InterestStatus(StrEnum):
    """Estágios de um pedido de aviso ("me avise quando chegar").

    O ciclo é o do AVISO, não o da venda: a loja não vende aqui, ela avisa. Por
    isso `NOTIFIED` (a oferta foi disparada) e não "vendido" — o que acontece
    depois do aviso é uma negociação normal, que vive no agendamento.

    `CLOSED` é para quem já comprou, desistiu ou parou de responder. Sem ele a
    lista só cresce, e uma lista que nunca encolhe deixa de ser lida.
    """

    NEW = "new"
    NOTIFIED = "notified"
    CLOSED = "closed"

    @property
    def is_open(self) -> bool:
        """Ainda deve ser cruzado com o estoque a cada carro que entra."""
        return self in {InterestStatus.NEW, InterestStatus.NOTIFIED}
