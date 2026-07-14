from __future__ import annotations

import pytest

from src.core.security import BcryptPasswordHasher

hasher = BcryptPasswordHasher()


def test_senha_correta_e_aceita() -> None:
    assert hasher.verify("senha-secreta", hasher.hash("senha-secreta"))


def test_senha_errada_e_rejeitada() -> None:
    assert not hasher.verify("senha-errada", hasher.hash("senha-secreta"))


def test_hashes_da_mesma_senha_sao_diferentes() -> None:
    """Salt aleatório: duas contas com a mesma senha têm hashes distintos.

    Sem isso, um vazamento revelaria quais usuários compartilham senha — e uma
    rainbow table quebraria todos de uma vez.
    """
    assert hasher.hash("mesma-senha") != hasher.hash("mesma-senha")


def test_hash_nao_contem_a_senha() -> None:
    assert "senha-secreta" not in hasher.hash("senha-secreta")


@pytest.mark.parametrize("tamanho", [72, 73, 100, 500])
def test_senhas_longas_nao_sao_truncadas(tamanho: int) -> None:
    """A armadilha do bcrypt: ele trunca em 72 bytes.

    Sem o pré-hash SHA-256, duas senhas que só divergem DEPOIS do 72º byte
    seriam a mesma senha para o sistema — e o usuário nunca saberia. Este teste
    prova que o pré-hash elimina o limite.
    """
    base = "a" * tamanho
    outra = base[:-1] + "b"  # difere só no último caractere

    hash_base = hasher.hash(base)

    assert hasher.verify(base, hash_base)
    assert not hasher.verify(outra, hash_base), (
        f"senha de {tamanho} bytes foi truncada: duas senhas diferentes colidiram"
    )


def test_senha_com_bytes_nulos_e_unicode() -> None:
    """O bcrypt também trunca no primeiro byte nulo. O base64 do pré-hash impede."""
    assert hasher.verify("senha\x00com-nulo", hasher.hash("senha\x00com-nulo"))
    assert hasher.verify("sênhá-çom-acênto-🚗", hasher.hash("sênhá-çom-acênto-🚗"))


def test_hash_malformado_no_banco_retorna_false_em_vez_de_estourar() -> None:
    """Um 500 aqui contaria ao atacante que o usuário existe. Falha em silêncio."""
    assert not hasher.verify("qualquer", "isto-nao-e-um-hash-bcrypt")
