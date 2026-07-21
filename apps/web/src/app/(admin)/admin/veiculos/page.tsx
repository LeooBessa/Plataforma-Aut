'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, Plus, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import type { VehicleStatus, VehicleSummary } from '@/lib/api';
import { formatMileage, formatPrice, formatYears } from '@/lib/format';
import { errorMessage, http } from '@/lib/http';
import { STATUS_LABELS } from '@/lib/labels';

type VehiclePage = {
  items: VehicleSummary[];
  meta: { total: number; page: number; total_pages: number };
};

const STATUS_TONE: Record<VehicleStatus, 'success' | 'warning' | 'neutral' | 'brand'> = {
  active: 'success',
  reserved: 'warning',
  draft: 'brand',
  sold: 'neutral',
  archived: 'neutral',
};

export default function AdminVeiculosPage() {
  const [page, setPage] = useState<VehiclePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (status) params.set('status', status);

      const { data } = await http.get<VehiclePage>(`/admin/vehicles?${params.toString()}`);
      setPage(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [query, status]);

  // Debounce: sem ele, cada tecla digitada dispararia uma consulta ao banco.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 350);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-silver-100 text-2xl font-bold tracking-tight">Anúncios</h1>
          <p className="text-silver-500 mt-1 text-sm">
            {/* Diferente do site público, aqui aparecem TAMBÉM rascunhos e
                arquivados — é a visão de quem opera o estoque. */}
            Todos os anúncios, incluindo rascunhos e arquivados.
          </p>
        </div>
        <ButtonLink href="/admin/veiculos/novo">
          <Plus className="size-4" />
          Novo anúncio
        </ButtonLink>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-silver-600 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por marca, modelo ou versão"
            className="pl-10"
            aria-label="Buscar anúncios"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrar por status"
          className="sm:w-52"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-card bg-danger-500/10 text-danger-400 ring-danger-500/20 flex items-start gap-3 p-4 text-sm ring-1 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-card shadow-card ring-ink-800 overflow-hidden bg-ink-900 ring-1">
        {page === null ? (
          <div className="divide-ink-800 divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="rounded-btn bg-ink-850 size-16 shrink-0 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="bg-ink-850 h-4 w-1/3 animate-pulse rounded" />
                  <div className="bg-ink-850 h-3 w-1/4 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : page.items.length === 0 ? (
          <p className="text-silver-500 p-12 text-center text-sm">Nenhum anúncio encontrado.</p>
        ) : (
          <ul className="divide-ink-800 divide-y">
            {page.items.map((vehicle) => (
              <li key={vehicle.id}>
                {/* A linha INTEIRA é um link. Um "editar" pequeno no canto
                    obrigaria o admin a mirar — e ele passa o dia nesta tela. */}
                <Link
                  href={`/admin/veiculos/${vehicle.id}`}
                  className="hover:bg-ink-850 flex items-center gap-4 p-4 transition-colors"
                >
                  <div className="rounded-btn bg-ink-850 relative size-16 shrink-0 overflow-hidden">
                    {vehicle.cover_image ? (
                      <Image
                        src={vehicle.cover_image.url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-silver-600 flex h-full items-center justify-center text-[10px]">
                        sem foto
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-silver-100 truncate font-medium">{vehicle.title}</p>
                    <p className="text-silver-500 mt-0.5 truncate text-sm">
                      {formatYears(vehicle.year_manufacture, vehicle.year_model)} ·{' '}
                      {formatMileage(vehicle.mileage)} · {vehicle.city}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-silver-100 font-semibold">{formatPrice(vehicle.price)}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {vehicle.is_featured && <Badge tone="dark">Destaque</Badge>}
                    <Badge tone={STATUS_TONE[vehicle.status]}>
                      {STATUS_LABELS[vehicle.status]}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {page && page.meta.total > 0 && (
        <p className="text-silver-500 text-sm">
          {page.meta.total} {page.meta.total === 1 ? 'anúncio' : 'anúncios'}
        </p>
      )}
    </div>
  );
}
