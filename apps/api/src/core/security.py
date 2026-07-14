"""Hashing de senha.

O `PasswordHasher` é um Protocol (uma *porta*, no vocabulário da Clean
Architecture). Os casos de uso dependem da interface, nunca da implementação —
trocar bcrypt por argon2id amanhã é escrever uma classe nova e registrá-la na
injeção de dependência, sem tocar em nenhuma regra de negócio.
"""

from __future__ import annotations

import base64
import hashlib
from typing import Protocol

import bcrypt

# Custo do bcrypt. 12 é o piso recomendado hoje: ~250ms por hash num servidor
# moderno. É lento de propósito — a lentidão é a defesa contra força bruta.
_BCRYPT_ROUNDS = 12


class PasswordHasher(Protocol):
    """Porta de hashing. Os casos de uso conhecem só isto."""

    def hash(self, password: str) -> str: ...

    def verify(self, password: str, password_hash: str) -> bool: ...


class BcryptPasswordHasher:
    """bcrypt com pré-hash SHA-256.

    O pré-hash não é enfeite. O bcrypt **trunca silenciosamente** a senha em 72
    bytes: sem tratamento, uma senha de 100 caracteres e outra que só coincide
    nos 72 primeiros seriam a MESMA senha para o sistema — e ninguém receberia
    erro nenhum. Passar a senha por SHA-256 primeiro produz sempre 44 bytes
    (base64 de 32), então nada é truncado e o comprimento deixa de importar.

    O base64 é necessário porque o digest binário pode conter um byte nulo, e o
    bcrypt trunca no primeiro nulo que encontrar — mesma classe de bug, causa
    diferente.

    É a mesma construção do `bcrypt_sha256` do passlib, sem a dependência.
    """

    def _prehash(self, password: str) -> bytes:
        digest = hashlib.sha256(password.encode("utf-8")).digest()
        return base64.b64encode(digest)

    def hash(self, password: str) -> str:
        salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
        return bcrypt.hashpw(self._prehash(password), salt).decode("utf-8")

    def verify(self, password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(self._prehash(password), password_hash.encode("utf-8"))
        except ValueError:
            # Hash malformado no banco. Retorna False em vez de estourar: um 500
            # aqui contaria ao atacante que aquele usuário existe.
            return False


def get_password_hasher() -> PasswordHasher:
    return BcryptPasswordHasher()
