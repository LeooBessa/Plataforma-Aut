import { Suspense } from 'react';
import { SearchX } from 'lucide-react';

import { ConsignmentSection } from '@/features/consignment/consignment-section';
import { Hero } from '@/features/home/hero';
import { SearchFilters } from '@/features/vehicles/search-filters';
import { VehicleCard, VehicleCardSkeleton } from '@/features/vehicles/vehicle-card';
import { getFilterOptions, listVehicles, safely, type VehicleSearchParams } from '@/lib/api';

/**
 * Home.
 *
 * Server Component: os veículos vêm no HTML. O Googlebot lê os carros, os preços
 * e os links sem executar JavaScript — e o visitante vê conteúdo já no primeiro
 * frame, em vez de um esqueleto girando.
 *
 * A home LÊ `searchParams` (a busca vive aqui embaixo, na seção "Nosso
 * estoque"), então é renderizada sob demanda — não mais estática. O SSR entrega
 * o estoque completo por padrão, então o Googlebot continua vendo os carros.
 */

const PAGE_SIZE = 12;

type Props = {
  // No Next 16, `searchParams` é uma PROMISE — acesso síncrono foi removido.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <>
      {/* Hero estático (foto de vitrine + texto), sem dado de API. */}
      <Hero />

      <EstoqueSection params={params} />

      {/* Entre o estoque e o rodapé: quem chega quer comprar, e só depois de
          rolar a vitrine é que quem TEM um carro para vender se reconhece. */}
      <ConsignmentSection />
    </>
  );
}

/**
 * A seção de estoque — e a razão de a busca ter voltado para a home.
 *
 * A busca é o CABEÇALHO desta seção, e a grade de carros vem logo abaixo. Ela
 * não flutua mais solta no branco (era essa a reclamação): pertence à grade que
 * controla. E filtra AO VIVO — digitar ou escolher um filtro atualiza os cards
 * aqui mesmo, sem trocar de página, que é exatamente o que faltava.
 *
 * Duas fronteiras de Suspense, como na página /veiculos: os filtros carregam de
 * um lado, a grade do outro. A `key` na grade a força a remontar quando o filtro
 * muda — sem ela, o React reusaria a árvore e o esqueleto nunca apareceria.
 */
function EstoqueSection({ params }: { params: Record<string, string | string[] | undefined> }) {
  // Padding de baixo pequeno (`pb-4`): esta é a última seção antes do rodapé (o
  // bloco de confiança saiu). O respiro até o rodapé vem do `mt` do próprio
  // rodapé — assim o estoque "encosta" nele, sem uma faixa branca no meio.
  return (
    <section id="estoque" className="mx-auto max-w-7xl px-4 pt-16 pb-4 sm:px-6 lg:px-8 lg:pt-20">
      <div>
        <h2 className="text-content text-2xl font-semibold tracking-tight sm:text-3xl">
          Nosso estoque
        </h2>
        {/* Filete azul sob o título — o detalhe que amarra a identidade. */}
        <div
          aria-hidden
          className="from-brand-500 mt-2 h-px w-16 bg-gradient-to-r to-transparent"
        />
        <p className="text-faint mt-2.5 text-sm">
          Busque e filtre sem sair da página — os resultados aparecem aqui embaixo.
        </p>
      </div>

      <div className="mt-6">
        <Suspense fallback={<FiltersSkeleton />}>
          <Filters />
        </Suspense>
      </div>

      <Suspense key={JSON.stringify(params)} fallback={<ResultsSkeleton />}>
        <Results params={params} />
      </Suspense>
    </section>
  );
}

async function Filters() {
  const options = await safely(getFilterOptions());
  if (!options) return null;
  return <SearchFilters options={options} compact />;
}

/** Converte os parâmetros da URL (strings) no formato tipado da API. */
function parseParams(raw: Record<string, string | string[] | undefined>): VehicleSearchParams {
  const first = (key: string): string | undefined => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const all = (key: string): string[] | undefined => {
    const value = raw[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  };
  const number = (key: string): number | undefined => {
    const value = first(key);
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    q: first('q'),
    brand: first('brand'),
    model: first('model'),
    city: first('city'),
    year_min: number('year_min'),
    year_max: number('year_max'),
    price_min: number('price_min'),
    price_max: number('price_max'),
    fuel: all('fuel') as VehicleSearchParams['fuel'],
    transmission: all('transmission') as VehicleSearchParams['transmission'],
    body: all('body') as VehicleSearchParams['body'],
    features: all('features'),
    sort: first('sort'),
    page: number('page') ?? 1,
    page_size: PAGE_SIZE,
  };
}

async function Results({ params }: { params: Record<string, string | string[] | undefined> }) {
  const page = await safely(listVehicles(parseParams(params)));

  // Falha da API e catálogo vazio são coisas DIFERENTES, e a mensagem precisa
  // ser diferente. Dizer "nenhum resultado" quando a API caiu esconde a falha
  // atrás de uma tela plausível — e ninguém vai investigar.
  if (!page) {
    return (
      <div className="rounded-card border-line-strong mt-8 border border-dashed py-16 text-center">
        <p className="text-content font-medium">Não foi possível carregar os veículos.</p>
        <p className="text-faint mt-1 text-sm">
          Estamos com uma instabilidade momentânea. Tente novamente em instantes.
        </p>
      </div>
    );
  }

  if (page.items.length === 0) {
    return (
      <div className="rounded-card border-line-strong mt-8 flex flex-col items-center border border-dashed py-16 text-center">
        <span className="bg-sunken text-faint flex size-14 items-center justify-center rounded-full">
          <SearchX className="size-6" />
        </span>
        <h3 className="text-content mt-5 text-lg font-semibold">Nenhum veículo para esse filtro</h3>
        <p className="text-faint mt-1.5 max-w-sm text-sm">
          Tente remover algum filtro ou buscar por outro termo.
        </p>
      </div>
    );
  }

  return (
    <>
      <h3 className="text-faint mt-8 text-sm font-normal">
        <strong className="text-content font-semibold">{page.meta.total}</strong>{' '}
        {page.meta.total === 1 ? 'veículo encontrado' : 'veículos encontrados'}
      </h3>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {page.items.map((vehicle, index) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} priority={index < 3} />
        ))}
      </div>
    </>
  );
}

function FiltersSkeleton() {
  return <div className="rounded-card bg-sunken h-[5.5rem] animate-pulse sm:h-[4.75rem]" />;
}

function ResultsSkeleton() {
  return (
    <>
      <div className="bg-sunken mt-8 h-4 w-40 animate-pulse rounded" />
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <VehicleCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}