'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  Car,
  CheckCircle2,
  Eye,
  FileEdit,
  Star,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import type { DashboardStats } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { errorMessage, http } from '@/lib/http';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    http
      .get<DashboardStats>('/admin/stats')
      .then(({ data }) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-card bg-danger-50 p-5 text-sm text-danger-700 ring-1 ring-inset ring-danger-500/20"
      >
        <AlertCircle className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Não foi possível carregar o dashboard</p>
          <p className="mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">Visão geral do estoque e dos agendamentos</p>
        </div>
        <ButtonLink href="/admin/veiculos">
          <Car className="size-4" />
          Gerenciar anúncios
        </ButtonLink>
      </header>

      {/* O agendamento PENDENTE vem primeiro e destacado em verde.
          É o único número desta tela que exige ação humana hoje: cada um é um
          cliente esperando resposta. Os outros são informação; este é tarefa. */}
      {stats && stats.pending_appointments > 0 && (
        <Link
          href="/admin/agendamentos"
          className="flex items-center gap-4 rounded-card bg-success-50 p-5 ring-1 ring-inset ring-success-500/25 transition-shadow hover:shadow-card"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-success-600 text-white">
            <CalendarClock className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-success-700">
              {stats.pending_appointments}{' '}
              {stats.pending_appointments === 1
                ? 'visita aguardando confirmação'
                : 'visitas aguardando confirmação'}
            </p>
            <p className="mt-0.5 text-sm text-success-700/80">
              Cada uma é um cliente esperando seu retorno.
            </p>
          </div>
          <Badge tone="success">Ver agora</Badge>
        </Link>
      )}

      <section>
        <h2 className="text-sm font-semibold text-ink-700">Estoque</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total de veículos"
            value={stats?.total_vehicles}
            icon={<Car className="size-5" />}
          />
          <Stat
            label="Disponíveis"
            value={stats?.active_vehicles}
            icon={<CheckCircle2 className="size-5" />}
            tone="success"
          />
          <Stat
            label="Vendidos"
            value={stats?.sold_vehicles}
            icon={<Wallet className="size-5" />}
          />
          <Stat
            label="Rascunhos"
            value={stats?.draft_vehicles}
            icon={<FileEdit className="size-5" />}
            tone="warning"
            hint={
              stats && stats.draft_vehicles > 0 ? 'Anúncios ainda não publicados' : undefined
            }
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink-700">Movimento</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Valor do estoque"
            value={stats ? formatPrice(stats.inventory_value) : undefined}
            icon={<Wallet className="size-5" />}
            hint="Somente veículos à venda"
          />
          <Stat
            label="Visualizações"
            value={stats?.total_views}
            icon={<Eye className="size-5" />}
          />
          <Stat
            label="Agendamentos"
            value={stats?.total_appointments}
            icon={<Calendar className="size-5" />}
          />
          <Stat
            label="Em destaque"
            value={stats?.featured_vehicles}
            icon={<Star className="size-5" />}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: number | string | undefined;
  icon: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
  hint?: string;
}) {
  const toneClass = {
    neutral: 'bg-ink-100 text-ink-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
  }[tone];

  return (
    <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-ink-100">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-500">{label}</p>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-btn ${toneClass}`}>
          {icon}
        </span>
      </div>

      {/* O esqueleto tem a MESMA altura do número. Sem isso, a tela "pula"
          quando os dados chegam — e o admin clica no lugar errado. */}
      {value === undefined ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded bg-ink-100" />
      ) : (
        <p className="mt-3 text-2xl font-bold tracking-tight text-ink-950">{value}</p>
      )}

      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
