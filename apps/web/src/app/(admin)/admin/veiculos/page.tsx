'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950">Anúncios</h1>
        <p className="mt-1 text-sm text-ink-500">
          {/* Diferente do site público, aqui aparecem TAMBÉM rascunhos e
              arquivados — é a visão de quem opera o estoque. */}
          Todos os anúncios, incluindo rascunhos e arquivados.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
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
          className="flex items-start gap-3 rounded-card bg-danger-50 p-4 text-sm text-danger-700 ring-1 ring-inset ring-danger-500/20"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-card bg-white shadow-card ring-1 ring-ink-100">
        {page === null ? (
          <div className="divide-y divide-ink-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="size-16 shrink-0 animate-pulse rounded-btn bg-ink-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-ink-100" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-ink-100" />
                </div>
              </div>
            ))}
          </div>
        ) : page.items.length === 0 ? (
          <p className="p-12 text-center text-sm text-ink-500">Nenhum anúncio encontrado.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {page.items.map((vehicle) => (
              <li
                key={vehicle.id}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-ink-50"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-btn bg-ink-100">
                  {vehicle.cover_image ? (
                    <Image
                      src={vehicle.cover_image.url}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-ink-400">
                      sem foto
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-900">{vehicle.title}</p>
                  <p className="mt-0.5 truncate text-sm text-ink-500">
                    {formatYears(vehicle.year_manufacture, vehicle.year_model)} ·{' '}
                    {formatMileage(vehicle.mileage)} · {vehicle.city}
                  </p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-semibold text-ink-950">{formatPrice(vehicle.price)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {vehicle.is_featured && <Badge tone="dark">Destaque</Badge>}
                  <Badge tone={STATUS_TONE[vehicle.status]}>
                    {STATUS_LABELS[vehicle.status]}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {page && page.meta.total > 0 && (
        <p className="text-sm text-ink-500">
          {page.meta.total} {page.meta.total === 1 ? 'anúncio' : 'anúncios'}
        </p>
      )}
    </div>
  );
}
