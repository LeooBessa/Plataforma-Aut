"""Testes de integração da API pública de veículos.

Rodam contra um Postgres real, porque é justamente o comportamento do Postgres
que estamos testando: busca textual, semântica do filtro de opcionais, ordenação
estável. Um banco falso ou SQLite validaria uma ficção.
"""

from __future__ import annotations

from httpx import AsyncClient

from src.domain.catalog.enums import BodyType, FuelType, TransmissionType, VehicleStatus
from tests.conftest import VehicleFactory

BASE = "/api/v1/vehicles"


# ------------------------------------------------------------------ visibilidade
#
# A regra mais cara de errar do sistema: um rascunho vazando para o site público
# expõe preço errado, foto errada ou carro que não existe.


async def test_rascunho_e_arquivado_nao_aparecem_na_listagem(
    client: AsyncClient, vehicles: VehicleFactory
) -> None:
    await vehicles.create(slug="publicado", status=VehicleStatus.ACTIVE)
    await vehicles.create(slug="rascunho", status=VehicleStatus.DRAFT)
    await vehicles.create(slug="arquivado", status=VehicleStatus.ARCHIVED)

    response = await client.get(BASE)

    assert response.status_code == 200
    slugs = {item["slug"] for item in response.json()["items"]}
    assert slugs == {"publicado"}


async def test_reservado_continua_listado(client: AsyncClient, vehicles: VehicleFactory) -> None:
    """Reservado gera urgência e ainda capta lead. Some da listagem seria perder venda."""
    await vehicles.create(slug="reservado", status=VehicleStatus.RESERVED)

    response = await client.get(BASE)

    assert [i["slug"] for i in response.json()["items"]] == ["reservado"]


async def test_vendido_some_da_listagem_mas_a_pagina_continua_de_pe(
    client: AsyncClient, vehicles: VehicleFactory
) -> None:
    """A página de um vendido acumulou SEO e links. Devolver 404 nela joga isso fora."""
    await vehicles.create(slug="vendido", status=VehicleStatus.SOLD)

    listagem = await client.get(BASE)
    assert listagem.json()["items"] == []

    pagina = await client.get(f"{BASE}/vendido")
    assert pagina.status_code == 200
    assert pagina.json()["status"] == "sold"


async def test_pagina_de_rascunho_devolve_404(
    client: AsyncClient, vehicles: VehicleFactory
) -> None:
    await vehicles.create(slug="rascunho", status=VehicleStatus.DRAFT)

    response = await client.get(f"{BASE}/rascunho")

    assert response.status_code == 404


# ------------------------------------------------------------------------- busca


async def test_busca_sem_acento_encontra_texto_com_acento(
    client: AsyncClient, vehicles: VehicleFactory
) -> None:
    """O usuário brasileiro digita sem acento. Se isto quebrar, a busca fica cega."""
    await vehicles.create(
        slug="com-acento", description="Câmbio automático, direção elétrica, único dono."
    )

    response = await client.get(BASE, params={"q": "cambio automatico"})

    assert [i["slug"] for i in response.json()["items"]] == ["com-acento"]


async def test_busca_encontra_pelo_nome_do_modelo(
    client: AsyncClient, vehicles: VehicleFactory
) -> None:
    """Prova a denormalização: o nome do modelo vem de outra tabela.

    Se `brand_name`/`model_name` deixarem de ser copiados para `vehicles`, a
    coluna gerada `search_vector` não os enxerga (coluna gerada não faz JOIN) e
    a busca mais comum do site — pelo modelo — retorna vazio.
    """
    await vehicles.create(brand="Honda", model="Civic", slug="honda-civic")
    await vehicles.create(brand="Toyota", model="Corolla", slug="toyota-corolla")

    response = await client.get(BASE, params={"q": "civic"})

    assert [i["slug"] for i in response.json()["items"]] == ["honda-civic"]


async def test_busca_sem_resultado_nao_inventa_falso_positivo(
    client: AsyncClient, vehicles: VehicleFactory
) -> None:
    await vehicles.create(brand="Toyota", model="Corolla")

    response = await client.get(BASE, params={"q": "ferrari"})

    assert response.json()["items"] == []
    assert response.json()["meta"]["total"] == 0


# ----------------------------------------------------------------------- filtros


async def test_filtro_de_preco(client: AsyncClient, vehicles: VehicleFactory) -> None:
    await vehicles.create(slug="barato", price="50000.00")
    await vehicles.create(slug="medio", price="100000.00")
    await vehicles.create(slug="caro", price="200000.00")

    response = await client.get(BASE, params={"price_min": 60000, "price_max": 150000})

    assert [i["slug"] for i in response.json()["items"]] == ["medio"]


async def test_filtro_de_opcionais_exige_todos_e_nao_qualquer_um(
    client: AsyncClient, vehicles: VehicleFactory, features: dict[str, object]
) -> None:
    """Quem marca "teto solar" E "câmera de ré" quer os dois, não qualquer um.

    Com semântica OU, o usuário filtraria por teto solar e receberia carros sem
    teto solar. É o tipo de erro que destrói a confiança na busca.
    """
    teto = features["teto-solar"]
    camera = features["camera-de-re"]
    airbag = features["airbags"]

    await vehicles.create(slug="so-teto", feature_objs=[teto])  # type: ignore[list-item]
    await vehicles.create(slug="so-camera", feature_objs=[camera])  # type: ignore[list-item]
    await vehicles.create(slug="ambos", feature_objs=[teto, camera, airbag])  # type: ignore[list-item]

    response = await client.get(BASE, params={"features": ["teto-solar", "camera-de-re"]})

    assert [i["slug"] for i in response.json()["items"]] == ["ambos"]


async def test_filtros_combinados(client: AsyncClient, vehicles: VehicleFactory) -> None:
    await vehicles.create(
        slug="alvo",
        brand="Honda",
        fuel=FuelType.FLEX,
        transmission=TransmissionType.AUTOMATIC,
        body=BodyType.SUV,
        price="90000.00",
    )
    await vehicles.create(
        slug="fuel-errado",
        brand="Honda",
        fuel=FuelType.DIESEL,
        transmission=TransmissionType.AUTOMATIC,
        body=BodyType.SUV,
        price="90000.00",
    )
    await vehicles.create(
        slug="cambio-errado",
        brand="Honda",
        fuel=FuelType.FLEX,
        transmission=TransmissionType.MANUAL,
        body=BodyType.SUV,
        price="90000.00",
    )

    response = await client.get(
        BASE,
        params={"brand": "honda", "fuel": ["flex"], "transmission": ["automatic"], "body": ["suv"]},
    )

    assert [i["slug"] for i in response.json()["items"]] == ["alvo"]


async def test_intervalo_de_preco_invertido_e_rejeitado(client: AsyncClient) -> None:
    """Sem esta validação, a API devolveria lista vazia — e o usuário leria
    "não há carros" em vez de "seu filtro está invertido"."""
    response = await client.get(BASE, params={"price_min": 100000, "price_max": 50000})

    assert response.status_code == 422
    assert "mínimo" in response.json()["error"]["message"]


# -------------------------------------------------------------------- paginação


async def test_paginacao_e_estavel_entre_paginas(
    client: AsyncClient, vehicles: VehicleFactory
) -> None:
    """Sem desempate estável na ordenação, o mesmo carro aparece em duas páginas
    e outro some. Todos aqui têm o MESMO preço de propósito — é o caso que expõe
    o bug."""
    for i in range(10):
        await vehicles.create(slug=f"carro-{i}", price="100000.00")

    p1 = await client.get(BASE, params={"sort": "price_asc", "page": 1, "page_size": 5})
    p2 = await client.get(BASE, params={"sort": "price_asc", "page": 2, "page_size": 5})

    slugs1 = [i["slug"] for i in p1.json()["items"]]
    slugs2 = [i["slug"] for i in p2.json()["items"]]

    assert len(slugs1) == 5
    assert len(slugs2) == 5
    assert not set(slugs1) & set(slugs2), "carro repetido entre as páginas"
    assert len(set(slugs1 + slugs2)) == 10, "carro sumiu entre as páginas"


async def test_metadados_da_pagina(client: AsyncClient, vehicles: VehicleFactory) -> None:
    for i in range(7):
        await vehicles.create(slug=f"v-{i}")

    response = await client.get(BASE, params={"page": 2, "page_size": 3})
    meta = response.json()["meta"]

    assert meta["total"] == 7
    assert meta["total_pages"] == 3
    assert meta["has_next"] is True
    assert meta["has_previous"] is True


async def test_page_size_absurdo_e_rejeitado(client: AsyncClient) -> None:
    """Um page_size=100000 varreria a tabela inteira. O teto é defesa."""
    response = await client.get(BASE, params={"page_size": 100000})

    assert response.status_code == 422


# ------------------------------------------------------------------- ordenação


async def test_ordenacao_por_preco(client: AsyncClient, vehicles: VehicleFactory) -> None:
    await vehicles.create(slug="c", price="30000.00")
    await vehicles.create(slug="a", price="10000.00")
    await vehicles.create(slug="b", price="20000.00")

    asc = await client.get(BASE, params={"sort": "price_asc"})
    desc = await client.get(BASE, params={"sort": "price_desc"})

    assert [i["slug"] for i in asc.json()["items"]] == ["a", "b", "c"]
    assert [i["slug"] for i in desc.json()["items"]] == ["c", "b", "a"]


async def test_destaque_vem_primeiro_sem_termo_de_busca(
    client: AsyncClient, vehicles: VehicleFactory
) -> None:
    await vehicles.create(slug="comum", is_featured=False)
    await vehicles.create(slug="destaque", is_featured=True)

    response = await client.get(BASE)

    assert response.json()["items"][0]["slug"] == "destaque"


# --------------------------------------------------------------------- detalhe


async def test_ficha_completa(
    client: AsyncClient, vehicles: VehicleFactory, features: dict[str, object]
) -> None:
    await vehicles.create(
        slug="corolla-completo",
        brand="Toyota",
        model="Corolla",
        version="XEi 2.0",
        feature_objs=[features["teto-solar"]],  # type: ignore[list-item]
    )

    response = await client.get(f"{BASE}/corolla-completo")
    body = response.json()

    assert response.status_code == 200
    assert body["title"] == "Toyota Corolla XEi 2.0"
    assert [f["slug"] for f in body["features"]] == ["teto-solar"]
    assert len(body["images"]) == 1
    assert body["images"][0]["is_cover"] is True


async def test_slug_inexistente_devolve_404(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/nao-existe")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# --------------------------------------------------------------------- destaques


async def test_destaques_so_traz_destaque_publicado(
    client: AsyncClient, vehicles: VehicleFactory
) -> None:
    await vehicles.create(slug="destaque-ativo", is_featured=True)
    await vehicles.create(slug="destaque-rascunho", is_featured=True, status=VehicleStatus.DRAFT)
    await vehicles.create(slug="comum", is_featured=False)

    response = await client.get(f"{BASE}/featured")

    assert [i["slug"] for i in response.json()] == ["destaque-ativo"]


# ------------------------------------------------------------- opções de filtro


async def test_opcoes_de_filtro_so_mostram_o_que_existe(
    client: AsyncClient,
    vehicles: VehicleFactory,
    features: dict[str, object],
) -> None:
    """Oferecer um filtro que devolve zero resultados faz o site parecer quebrado."""
    await vehicles.create(
        brand="Honda",
        model="Civic",
        city="Campinas",
        price="80000.00",
        year_manufacture=2019,
        year_model=2020,
        feature_objs=[features["airbags"]],  # type: ignore[list-item]
    )
    # Só existe como rascunho: não pode aparecer em filtro nenhum.
    await vehicles.create(
        brand="Ferrari", model="F40", city="Mônaco", slug="oculto", status=VehicleStatus.DRAFT
    )

    response = await client.get(f"{BASE}/filters")
    body = response.json()

    marcas = {b["slug"] for b in body["brands"]}
    assert marcas == {"honda"}, "marca de veículo não publicado vazou para o filtro"
    assert body["cities"] == ["Campinas"]
    assert [f["slug"] for f in body["features"]] == ["airbags"]
    assert body["price_min"] == "80000.00"
    assert body["year_max"] == 2020


async def test_a_rota_filters_nao_e_confundida_com_um_slug(client: AsyncClient) -> None:
    """`/vehicles/filters` tem que cair na rota de filtros, não em `/{slug}`.

    Se `/{slug}` fosse declarada antes, ela engoliria "filters" como se fosse o
    slug de um carro e devolveria 404.
    """
    response = await client.get(f"{BASE}/filters")

    assert response.status_code == 200
    assert "brands" in response.json()
