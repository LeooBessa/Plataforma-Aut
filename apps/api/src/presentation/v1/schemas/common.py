"""Validações compartilhadas entre schemas da borda HTTP."""

from __future__ import annotations

import re

# Telefone brasileiro: 10 dígitos (fixo) ou 11 (celular, com o 9).
_PHONE_DIGITS = re.compile(r"^\d{10,11}$")


def clean_phone(value: str) -> str:
    """Guarda só os dígitos.

    O usuário digita "(84) 99987-7293"; quem procura no painel digita
    "84999877293". Gravar a máscara faria as duas coisas não se encontrarem, e
    ainda impediria montar um link de WhatsApp — que exige só números.

    Está aqui, e não dentro de um schema, porque agendamento e consignação
    precisam exatamente da mesma regra. Duplicá-la garantiria que um dia as duas
    divergissem — e a que ficasse para trás aceitaria telefone inválido em
    silêncio.
    """
    digits = re.sub(r"\D", "", value)

    if not _PHONE_DIGITS.match(digits):
        raise ValueError("Telefone inválido. Use DDD + número, ex: (84) 99987-7293.")

    return digits
