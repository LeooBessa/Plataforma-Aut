'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import type { FilterOptions } from '@/lib/api';
// Categoria (`body`) e câmbio (`transmission`) saíram da tela a pedido da loja:
// eram ruído numa vitrine pequena, onde quem quer um automático já vê isso no
// cartão do carro. A API continua aceitando os dois parâmetros, então link
// antigo com `?body=suv` na URL segue funcionando.
import { FUEL_LABELS, SORT_OPTIONS } from '@/lib/labels';
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

/**
 * A escada de "até quanto" é construída a partir dos preços que EXISTEM.
 *
 * Antes era uma lista fixa de R$ 50 mil a R$ 200 mil, e isso é uma armadilha
 * silenciosa: enquanto o pátio esteve com carros de R$ 239 mil para cima,
 * TODAS as opções devolviam zero resultado. O filtro não parecia quebrado — só
 * parecia que a loja não tinha nada, o que é bem pior.
 *
 * Derivar dos limites reais resolve isso para qualquer estoque: pátio de
 * populares gera degraus de R$ 40 mil, pátio de importados gera degraus de
 * R$ 300 mil, e nenhum dos dois precisa de alguém lembrar de vir editar aqui.
 */
function faixasDePreco(min: number, max: number): number[] {
  if (!(max > min)) return [];

  // Degraus "redondos": R$ 43.750 é matematicamente correto e horrível de ler.
  //
  // Divide por 6, não por 5, e a diferença é maior do que parece: o passo é o
  // primeiro valor redondo ACIMA do bruto, então dividir por menos empurra o
  // passo para o degrau redondo seguinte e a escada fica grossa. Num pátio de
  // R$ 18 mil a R$ 300 mil, por 5 sobravam duas opções — R$ 100 mil e R$ 200
  // mil — e quem procurava carro de R$ 40 mil não tinha onde clicar.
  const bruto = (max - min) / 6;
  const passo =
    [5_000, 10_000, 20_000, 25_000, 50_000, 100_000, 250_000, 500_000].find((c) => c >= bruto) ??
    1_000_000;

  const faixas: number[] = [];
  for (let v = Math.ceil((min + 1) / passo) * passo; v < max && faixas.length < 6; v += passo) {
    faixas.push(v);
  }
  return faixas;
}

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

  // As marcas vêm de quem TEM carro à venda, então lista vazia aqui significa
  // pátio vazio — e um painel de filtros sobre nada é só ruído. Volta inteiro
  // sozinho no instante em que o primeiro anúncio entra.
  const temEstoque = options.brands.length > 0;

  // Filtro com uma opção só não filtra nada — apenas ocupa espaço e sugere uma
  // escolha que não existe. A loja tem um endereço só, então "cidade" cai neste
  // caso quase sempre; a regra fica genérica porque, se um dia houver uma
  // segunda unidade, o filtro reaparece sozinho.
  const mostrarCidade = options.cities.length > 1;

  const faixas = faixasDePreco(Number(options.price_min ?? 0), Number(options.price_max ?? 0));

  const activeCount = ['brand', 'model', 'city', 'fuel', 'price_max', 'year_min'].filter((key) =>
    searchParams.has(key),
  ).length;

  const clearAll = () => {
    setQuery('');
    startTransition(() => router.push(pathname as Route, { scroll: false }));
  };

  return (
    <div
      className={cn(
        'rounded-card shadow-card ring-line bg-surface p-4 ring-1 sm:p-5',
        // O esmaecimento durante a transição é a única indicação de "carregando".
        // Trocar a lista por um spinner faria a tela piscar a cada tecla.
        isPending && 'opacity-60 transition-opacity',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-faint pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
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

      {temEstoque && (!compact || showAdvanced) && (
        <div className="border-line mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
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

          {mostrarCidade && (
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
          )}

          {faixas.length > 0 && (
            <Select
              value={searchParams.get('price_max') ?? ''}
              onChange={(e) => updateParams({ price_max: e.target.value || undefined })}
              aria-label="Preço máximo"
            >
              <option value="">Qualquer preço</option>
              {faixas.map((price) => (
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
          )}

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
        <div className="border-line mt-4 flex items-center justify-between border-t pt-3">
          <p className="text-faint text-sm">
            {activeCount} {activeCount === 1 ? 'filtro ativo' : 'filtros ativos'}
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="text-accent hover:text-accent flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <X className="size-3.5" />
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
