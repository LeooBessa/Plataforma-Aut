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
        className="rounded-card bg-danger-500/10 text-danger-400 ring-danger-500/20 flex items-start gap-3 p-5 text-sm ring-1 ring-inset"
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
          <h1 className="text-content text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-faint mt-1 text-sm">Visão geral do estoque e dos agendamentos</p>
        </div>
        <ButtonLink href="/admin/veiculos">
          <Car className="size-4" />
          Gerenciar anúncios
        </ButtonLink>
      </header>

      {/* O agendamento PENDENTE vem primeiro e destacado em dourado.
          É o único número desta tela que exige ação humana hoje: cada um é um
          cliente esperando resposta. Os outros são informação; este é tarefa —
          e o dourado é a cor que o painel inteiro reserva para o que importa. */}
      {stats && stats.pending_appointments > 0 && (
        <Link
          href="/admin/agendamentos"
          className="rounded-card bg-accent-soft ring-brand-500/25 hover:ring-brand-500/50 flex items-center gap-4 p-5 ring-1 transition-all ring-inset"
        >
          <span className="rounded-btn from-brand-400 to-brand-600 text-ink-950 flex size-11 shrink-0 items-center justify-center bg-gradient-to-b">
            <CalendarClock className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-accent font-semibold">
              {stats.pending_appointments}{' '}
              {stats.pending_appointments === 1
                ? 'visita aguardando confirmação'
                : 'visitas aguardando confirmação'}
            </p>
            <p className="text-accent/80 mt-0.5 text-sm">
              Cada uma é um cliente esperando seu retorno.
            </p>
          </div>
          <Badge tone="gold">Ver agora</Badge>
        </Link>
      )}

      <section>
        <h2 className="text-content text-sm font-semibold">Estoque</h2>
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
        <h2 className="text-content text-sm font-semibold">Movimento</h2>
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
    neutral: 'bg-sunken text-muted',
    success: 'bg-success-500/10 text-success-400',
    warning: 'bg-warning-500/10 text-warning-400',
  }[tone];

  return (
    <div className="rounded-card shadow-card ring-line bg-surface p-5 ring-1">
      <div className="flex items-start justify-between gap-3">
        <p className="text-faint text-sm">{label}</p>
        <span
          className={`rounded-btn flex size-9 shrink-0 items-center justify-center ${toneClass}`}
        >
          {icon}
        </span>
      </div>

      {/* O esqueleto tem a MESMA altura do número. Sem isso, a tela "pula"
          quando os dados chegam — e o admin clica no lugar errado. */}
      {value === undefined ? (
        <div className="bg-sunken mt-3 h-8 w-20 animate-pulse rounded" />
      ) : (
        <p className="text-content mt-3 text-2xl font-bold tracking-tight">{value}</p>
      )}

      {hint && <p className="text-faint mt-1 text-xs">{hint}</p>}
    </div>
  );
}
