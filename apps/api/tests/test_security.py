from __future__ import annotations

import uuid
from typing import Any

import pytest

from src.application.catalog.admin_use_cases import RegisterImageUseCase
from src.core.config import Settings
from src.core.exceptions import ValidationError
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


# ---------------------------------------------------------------------------
# Guard de configuração de produção
#
# O risco que estes testes cobrem: a aplicação subir em produção com um default
# de desenvolvimento. Nada no comportamento do site denunciaria — o login
# funciona, as páginas carregam — e um JWT_SECRET_KEY default significa que
# qualquer pessoa forja um token de super_admin.
# ---------------------------------------------------------------------------

_VALID_SECRET = "a" * 64  # o que `openssl rand -hex 32` produziria


def _producao(**overrides: Any) -> Settings:
    """Settings de produção, sem ler o .env da máquina.

    `_env_file=None` é essencial: sem ele, o teste passaria ou falharia conforme
    o .env de quem está rodando — e no CI, onde não há .env, o resultado seria
    outro. O teste precisa depender só do que ele mesmo declara.
    """
    valores: dict[str, Any] = {
        "environment": "production",
        "jwt_secret_key": _VALID_SECRET,
        "database_url": "postgresql+asyncpg://u:p@host:6543/db",
        "cors_origins": ["https://site-real.com.br"],
        "debug": False,
        **overrides,
    }
    return Settings(_env_file=None, **valores)


def test_producao_valida_sobe() -> None:
    assert _producao().is_production


def test_producao_recusa_jwt_secret_default() -> None:
    """O caso que motiva o guard: a env var não chegou até o processo."""
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        _producao(jwt_secret_key="dev-only-insecure-secret-change-me")


def test_producao_recusa_jwt_secret_curto() -> None:
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        _producao(jwt_secret_key="curto-demais")


def test_producao_recusa_cors_em_localhost() -> None:
    """CORS em localhost em produção = a env var não chegou."""
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        _producao(cors_origins=["http://localhost:3000"])


def test_producao_recusa_debug_ligado() -> None:
    """DEBUG=true faz o SQLAlchemy logar toda query, com dados de clientes."""
    with pytest.raises(ValueError, match="DEBUG"):
        _producao(debug=True)


def test_producao_recusa_banco_ausente() -> None:
    with pytest.raises(ValueError, match="DATABASE_URL"):
        _producao(database_url="")


def test_desenvolvimento_aceita_os_defaults() -> None:
    """O guard vale SÓ para produção.

    Se ele valesse em desenvolvimento, clonar o repositório e rodar `dev:api`
    exigiria configurar segredos antes de ver a primeira tela — e o atrito faria
    alguém apagar o guard em vez de configurar.
    """
    dev = Settings(_env_file=None, environment="development")
    assert not dev.is_production


# ---------------------------------------------------------------------------
# Caminho da imagem no Storage
#
# O upload é em duas etapas, e entre elas quem fala é o cliente. Estes testes
# provam que o backend não acredita no caminho que ele confirma.
# ---------------------------------------------------------------------------


def _valida_caminho(vehicle_id: uuid.UUID, path: str) -> str:
    return RegisterImageUseCase._validate_path(vehicle_id, path)


def test_caminho_da_pasta_do_veiculo_e_aceito() -> None:
    vehicle_id = uuid.uuid4()
    path = f"vehicles/{vehicle_id}/abc123.webp"
    assert _valida_caminho(vehicle_id, path) == path


def test_caminho_de_outro_veiculo_e_recusado() -> None:
    """O ataque concreto: confirmar a foto de outro anúncio e depois apagá-la."""
    with pytest.raises(ValidationError):
        _valida_caminho(uuid.uuid4(), f"vehicles/{uuid.uuid4()}/foto.webp")


@pytest.mark.parametrize(
    "sufixo",
    [
        "../../outro/foto.webp",  # escapa da pasta mesmo casando com o prefixo
        "",  # pasta sem arquivo
        "/",
    ],
)
def test_caminhos_malformados_sao_recusados(sufixo: str) -> None:
    vehicle_id = uuid.uuid4()
    with pytest.raises(ValidationError):
        _valida_caminho(vehicle_id, f"vehicles/{vehicle_id}/{sufixo}")


def test_caminho_fora_da_pasta_vehicles_e_recusado() -> None:
    with pytest.raises(ValidationError):
        _valida_caminho(uuid.uuid4(), "outro-bucket/qualquer.webp")
