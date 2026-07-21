'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import type { FilterOptions } from '@/lib/api';
import { BODY_LABELS, FUEL_LABELS, SORT_OPTIONS, TRANSMISSION_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

/**
 * Busca e filtros.
 *
 * ============================================================================
 * A DECISÃO CENTRAL: OS FILTROS VIVEM NA URL, NÃO NO ESTADO DO REACT.
 * ============================================================================
 *
 * `/veiculos?marca=toyota&preco_max=80000` é uma URL de verdade. Consequências,
 * todas gratuitas:
 *
 *   • O Google indexa cada combinação de filtro como uma página. Num marketplace,
 *     o tráfego orgânico é o principal canal de aquisição — guardar o filtro em
 *     `useState` significaria que essas páginas simplesmente não existem para a
 *     busca.
 *   • O usuário compartilha o link no WhatsApp e o amigo vê os MESMOS carros.
 *   • O botão "voltar" do navegador funciona.
 *   • A página é renderizada no servidor: o resultado já vem no HTML.
 *
 * A sensação de "filtro instantâneo" (que o briefing pede) vem do `useTransition`:
 * a lista ANTERIOR continua visível, levemente esmaecida, enquanto a nova chega.
 * Não há tela em branco, não há spinner piscando.
 */

const DEBOUNCE_MS = 400;

export function SearchFilters({
  options,
  compact = false,
  className,
}: {
  options: FilterOptions;
  /** Versão reduzida, para o banner da home. */
  compact?: boolean;
  /** Permite ao hero da home trocar a moldura do card pela dele. */
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // O campo de texto tem estado local para poder ter debounce. Sem ele, cada
  // tecla digitada dispararia uma navegação e uma consulta ao banco.
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }

      // Mudar qualquer filtro volta para a página 1. Sem isto, quem estivesse na
      // página 5 e filtrasse por "Toyota" cairia na página 5 de um resultado que
      // talvez tenha só uma — e veria uma lista vazia, achando que não há Toyota.
      params.delete('page');

      startTransition(() => {
        // O cast é inevitável: a query string é montada em runtime, e o
        // `typedRoutes` só consegue verificar caminhos estáticos. O que ele
        // protege — o caminho base — continua sendo verificado nos <Link>.
        router.push(`${pathname}?${params.toString()}` as Route, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Debounce do campo de texto.
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (query === current) return;

    const timer = setTimeout(() => {
      updateParams({ q: query || undefined });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, searchParams, updateParams]);

  const selectedBrand = searchParams.get('brand') ?? '';
  const brandModels = options.brands.find((b) => b.slug === selectedBrand)?.models ?? [];

  const activeCount = [
    'brand',
    'model',
    'city',
    'fuel',
    'transmission',
    'body',
    'price_max',
    'year_min',
  ].filter((key) => searchParams.has(key)).length;

  const clearAll = () => {
    setQuery('');
    startTransition(() => router.push(pathname as Route, { scroll: false }));
  };

  return (
    <div
      className={cn(
        'rounded-card shadow-card ring-ink-800 bg-ink-900 p-4 ring-1 sm:p-5',
        // O esmaecimento durante a transição é a única indicação de "carregando".
        // Trocar a lista por um spinner faria a tela piscar a cada tecla.
        isPending && 'opacity-60 transition-opacity',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-silver-600 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busque por marca, modelo ou versão — ex: corolla xei"
            className="pl-10"
            aria-label="Buscar veículos"
          />
        </div>

        <Select
          value={searchParams.get('sort') ?? 'relevance'}
          onChange={(e) => updateParams({ sort: e.target.value })}
          aria-label="Ordenar por"
          className="sm:w-52"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {compact && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowAdvanced((v) => !v)}
            className="sm:w-auto"
          >
            <SlidersHorizontal className="size-4" />
            Filtros
            {activeCount > 0 && (
              <span className="bg-brand-600 ml-1 rounded-full px-1.5 text-xs text-white">
                {activeCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {(!compact || showAdvanced) && (
        <div className="border-ink-800 mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={selectedBrand}
            onChange={(e) =>
              // Trocar a marca LIMPA o modelo. Sem isto, sobraria "Toyota +
              // Civic" na URL — um filtro que nunca retorna nada, e o usuário
              // não entende por quê.
              updateParams({ brand: e.target.value || undefined, model: undefined })
            }
            aria-label="Marca"
          >
            <option value="">Todas as marcas</option>
            {options.brands.map((brand) => (
              <option key={brand.slug} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </Select>

          <Select
            value={searchParams.get('model') ?? ''}
            onChange={(e) => updateParams({ model: e.target.value || undefined })}
            // Sem marca escolhida, a lista de modelos seria enorme e inútil.
            disabled={!selectedBrand}
            aria-label="Modelo"
          >
            <option value="">{selectedBrand ? 'Todos os modelos' : 'Escolha a marca'}</option>
            {brandModels.map((model) => (
              <option key={model.slug} value={model.slug}>
                {model.name}
              </option>
            ))}
          </Select>

          <Select
            value={searchParams.get('city') ?? ''}
            onChange={(e) => updateParams({ city: e.target.value || undefined })}
            aria-label="Cidade"
          >
            <option value="">Todas as cidades</option>
            {options.cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>

          <Select
            value={searchParams.get('price_max') ?? ''}
            onChange={(e) => updateParams({ price_max: e.target.value || undefined })}
            aria-label="Preço máximo"
          >
            <option value="">Qualquer preço</option>
            {[50_000, 80_000, 100_000, 130_000, 160_000, 200_000].map((price) => (
              <option key={price} value={price}>
                Até{' '}
                {price.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                })}
              </option>
            ))}
          </Select>

          <Select
            value={searchParams.get('fuel') ?? ''}
            onChange={(e) => updateParams({ fuel: e.target.value || undefined })}
            aria-label="Combustível"
          >
            <option value="">Qualquer combustível</option>
            {Object.entries(FUEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select
            value={searchParams.get('transmission') ?? ''}
            onChange={(e) => updateParams({ transmission: e.target.value || undefined })}
            aria-label="Câmbio"
          >
            <option value="">Qualquer câmbio</option>
            {Object.entries(TRANSMISSION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select
            value={searchParams.get('body') ?? ''}
            onChange={(e) => updateParams({ body: e.target.value || undefined })}
            aria-label="Categoria"
          >
            <option value="">Qualquer categoria</option>
            {Object.entries(BODY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select
            value={searchParams.get('year_min') ?? ''}
            onChange={(e) => updateParams({ year_min: e.target.value || undefined })}
            aria-label="Ano a partir de"
          >
            <option value="">Qualquer ano</option>
            {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i).map((year) => (
              <option key={year} value={year}>
                A partir de {year}
              </option>
            ))}
          </Select>
        </div>
      )}

      {activeCount > 0 && (
        <div className="border-ink-800 mt-4 flex items-center justify-between border-t pt-3">
          <p className="text-silver-500 text-sm">
            {activeCount} {activeCount === 1 ? 'filtro ativo' : 'filtros ativos'}
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="text-brand-400 hover:text-brand-300 flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <X className="size-3.5" />
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
