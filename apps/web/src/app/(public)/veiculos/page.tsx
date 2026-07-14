import { Suspense } from 'react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { SearchFilters } from '@/features/vehicles/search-filters';
import { VehicleCard, VehicleCardSkeleton } from '@/features/vehicles/vehicle-card';
import { getFilterOptions, listVehicles, type VehicleSearchParams } from '@/lib/api';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Veículos à venda',
  description:
    'Encontre seu próximo carro entre nossos seminovos selecionados. Filtre por marca, modelo, preço, ano e combustível.',
};

const PAGE_SIZE = 12;

/**
 * No Next 16, `searchParams` é uma PROMISE.
 *
 * Acessar `searchParams.page` direto (como no Next 14) não compila mais — o
 * acesso síncrono foi removido, não apenas depreciado.
 */
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VeiculosPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-ink-950 text-3xl font-bold tracking-tight sm:text-4xl">
          Veículos à venda
        </h1>
        <p className="text-ink-500 mt-2">
          Seminovos selecionados, revisados e com procedência verificada.
        </p>
      </header>

      <div className="mt-8">
        <Suspense fallback={<div className="rounded-card bg-ink-100 h-40 animate-pulse" />}>
          <Filters />
        </Suspense>
      </div>

      {/* A `key` força o Suspense a remontar quando os filtros mudam. Sem ela, o
          React reusaria a árvore anterior e o esqueleto nunca apareceria numa
          busca nova. */}
      <Suspense key={JSON.stringify(params)} fallback={<ResultsSkeleton />}>
        <Results params={params} />
      </Suspense>
    </div>
  );
}

async function Filters() {
  const options = await getFilterOptions();
  return <SearchFilters options={options} />;
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
    // Ignora lixo em vez de mandar `NaN` para a API — que devolveria 422 e
    // transformaria uma URL adulterada numa página de erro.
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
    featured: first('featured') === 'true' ? true : undefined,
    sort: first('sort'),
    page: number('page') ?? 1,
    page_size: PAGE_SIZE,
  };
}

async function Results({ params }: { params: Record<string, string | string[] | undefined> }) {
  const page = await listVehicles(parseParams(params));

  if (page.items.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <p className="text-ink-500 mt-8 text-sm">
        <strong className="text-ink-900 font-semibold">{page.meta.total}</strong>{' '}
        {page.meta.total === 1 ? 'veículo encontrado' : 'veículos encontrados'}
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {page.items.map((vehicle, index) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} priority={index < 3} />
        ))}
      </div>

      {page.meta.total_pages > 1 && <Pagination meta={page.meta} params={params} />}
    </>
  );
}

function Pagination({
  meta,
  params,
}: {
  meta: { page: number; total_pages: number; has_next: boolean; has_previous: boolean };
  params: Record<string, string | string[] | undefined>;
}) {
  /**
   * A paginação são LINKS de verdade (`<a href>`), não botões com onClick.
   *
   * Isso não é preciosismo: o Googlebot só descobre a página 2 se houver um link
   * para ela. Com botões em JavaScript, o rastreador vê só a página 1 — e os
   * outros 90% do estoque nunca são indexados. Num marketplace, isso é jogar
   * fora a maior parte do tráfego orgânico possível.
   */
  const buildHref = (targetPage: number): Route => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (key === 'page' || value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) query.append(key, item);
      } else {
        query.append(key, value);
      }
    }

    if (targetPage > 1) query.set('page', String(targetPage));

    const qs = query.toString();
    // O cast é necessário porque a query string é montada em runtime e o
    // `typedRoutes` não tem como validá-la em tempo de compilação. O caminho
    // base (`/veiculos`) é que ele verifica — e é o que importa.
    return `/veiculos${qs ? `?${qs}` : ''}` as Route;
  };

  // Janela de páginas ao redor da atual. Listar 200 páginas seria inútil para o
  // usuário e um convite ao Google gastar orçamento de rastreamento à toa.
  const windowSize = 5;
  const start = Math.max(1, Math.min(meta.page - 2, meta.total_pages - windowSize + 1));
  const pages = Array.from(
    { length: Math.min(windowSize, meta.total_pages) },
    (_, i) => start + i,
  );

  return (
    <nav className="mt-12 flex items-center justify-center gap-1" aria-label="Paginação">
      {meta.has_previous && (
        <Link
          href={buildHref(meta.page - 1)}
          rel="prev"
          className="rounded-btn text-ink-600 hover:bg-ink-100 flex size-10 items-center justify-center transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Link>
      )}

      {pages.map((pageNumber) => (
        <Link
          key={pageNumber}
          href={buildHref(pageNumber)}
          aria-current={pageNumber === meta.page ? 'page' : undefined}
          className={cn(
            'rounded-btn flex size-10 items-center justify-center text-sm font-medium transition-colors',
            pageNumber === meta.page
              ? 'bg-ink-950 text-white'
              : 'text-ink-600 hover:bg-ink-100',
          )}
        >
          {pageNumber}
        </Link>
      ))}

      {meta.has_next && (
        <Link
          href={buildHref(meta.page + 1)}
          rel="next"
          className="rounded-btn text-ink-600 hover:bg-ink-100 flex size-10 items-center justify-center transition-colors"
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </Link>
      )}
    </nav>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border-ink-200 mt-16 flex flex-col items-center border border-dashed py-20 text-center">
      <span className="bg-ink-100 text-ink-400 flex size-14 items-center justify-center rounded-full">
        <SearchX className="size-6" />
      </span>
      <h2 className="text-ink-900 mt-5 text-lg font-semibold">Nenhum veículo encontrado</h2>
      <p className="text-ink-500 mt-1.5 max-w-sm text-sm">
        Tente remover algum filtro ou buscar por outro termo.
      </p>
      {/* Um beco sem saída é onde o usuário abandona o site. Sempre há uma porta. */}
      <ButtonLink href="/veiculos" variant="secondary" className="mt-6">
        Ver todos os veículos
      </ButtonLink>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <>
      <div className="bg-ink-100 mt-8 h-4 w-40 animate-pulse rounded" />
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <VehicleCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}
