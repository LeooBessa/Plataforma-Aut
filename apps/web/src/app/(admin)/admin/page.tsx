'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  Camera,
  Car,
  CheckCircle2,
  Clock,
  Eye,
  FileEdit,
  HandCoins,
  Star,
  Wallet,
} from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import type { DashboardStats } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { errorMessage, http } from '@/lib/http';

/**
 * Painel.
 *
 * ============================================================================
 * A REGRA DESTA TELA: TAREFA ANTES DE NÚMERO
 * ============================================================================
 * Um painel que só conta coisas vira papel de parede — passa a ser olhado sem
 * ser lido. O que sustenta o hábito de abrir é ele responder "o que eu faço
 * agora?", e não "quantos carros eu tenho".
 *
 * Por isso a ordem é: o que exige ação hoje, depois o que aconteceu na semana,
 * e só então os totais. E o bloco de ação some inteiro quando não há nada
 * pendente — alerta que fica aceso o tempo todo deixa de ser alerta.
 */

/** Quantas semanas o gráfico mostra. Combina com o que a API devolve. */
const SEMANAS = 8;

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
        className="rounded-card bg-danger-500/10 text-danger-700 ring-danger-500/20 flex items-start gap-3 p-5 text-sm ring-1 ring-inset"
      >
        <AlertCircle className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Não foi possível carregar o painel</p>
          <p className="mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-content text-2xl font-bold tracking-tight">Painel</h1>
          <p className="text-faint mt-1 text-sm">O que precisa de você, e como a semana foi</p>
        </div>
        <ButtonLink href="/admin/veiculos/novo">
          <Car className="size-4" />
          Cadastrar veículo
        </ButtonLink>
      </header>

      <Pendencias stats={stats} />

      <section>
        <h2 className="text-content text-sm font-semibold">Contatos recebidos</h2>
        <p className="text-faint mt-0.5 text-sm">Últimas {SEMANAS} semanas</p>
        <GraficoDeContatos stats={stats} />
      </section>

      <section>
        <h2 className="text-content text-sm font-semibold">Anúncios mais vistos</h2>
        <p className="text-faint mt-0.5 text-sm">
          Muita visita e nenhum agendamento costuma ser foto ruim ou preço fora
        </p>
        <MaisVistos stats={stats} />
      </section>

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
          <Stat label="Vendidos" value={stats?.sold_vehicles} icon={<Wallet className="size-5" />} />
          <Stat
            label="Rascunhos"
            value={stats?.draft_vehicles}
            icon={<FileEdit className="size-5" />}
            tone="warning"
            hint={stats && stats.draft_vehicles > 0 ? 'Ainda não publicados' : undefined}
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
          <Stat label="Visualizações" value={stats?.total_views} icon={<Eye className="size-5" />} />
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

// ---------------------------------------------------------------- pendências

/**
 * O bloco de tarefas. Só mostra o que tem contagem maior que zero.
 *
 * As duas primeiras linhas são pessoas esperando resposta; as duas últimas são
 * dinheiro parado. Nessa ordem de propósito: cliente sem retorno vai embora
 * hoje, carro encalhado ainda estará lá amanhã.
 */
function Pendencias({ stats }: { stats: DashboardStats | null }) {
  if (!stats) {
    return <div className="rounded-card bg-sunken h-24 animate-pulse" />;
  }

  const itens = [
    {
      quando: stats.pending_appointments > 0,
      href: '/admin/agendamentos' as const,
      icon: CalendarClock,
      texto:
        stats.pending_appointments === 1
          ? '1 visita aguardando confirmação'
          : `${stats.pending_appointments} visitas aguardando confirmação`,
      apoio: 'Cada uma é um cliente esperando seu retorno.',
      tom: 'brand' as const,
    },
    {
      quando: stats.pending_consignments > 0,
      href: '/admin/anuncie' as const,
      icon: HandCoins,
      texto:
        stats.pending_consignments === 1
          ? '1 carro oferecido sem resposta'
          : `${stats.pending_consignments} carros oferecidos sem resposta`,
      apoio: 'Quem quer vender está falando com outras lojas ao mesmo tempo.',
      tom: 'brand' as const,
    },
    {
      quando: stats.vehicles_without_photo > 0,
      href: '/admin/veiculos' as const,
      icon: Camera,
      texto:
        stats.vehicles_without_photo === 1
          ? '1 veículo à venda sem foto'
          : `${stats.vehicles_without_photo} veículos à venda sem foto`,
      apoio: 'Anúncio sem foto quase não é clicado — está no site sem estar de verdade.',
      tom: 'warning' as const,
    },
    {
      quando: stats.stale_vehicles > 0,
      href: '/admin/veiculos' as const,
      icon: Clock,
      texto:
        stats.stale_vehicles === 1
          ? '1 veículo há mais de 60 dias à venda'
          : `${stats.stale_vehicles} veículos há mais de 60 dias à venda`,
      apoio: 'Capital parado. Costuma pedir revisão de preço ou de foto.',
      tom: 'warning' as const,
    },
  ].filter((i) => i.quando);

  if (itens.length === 0) {
    return (
      <div className="rounded-card ring-line bg-surface flex items-center gap-3 p-5 ring-1">
        <span className="rounded-btn bg-success-500/10 text-success-500 flex size-10 shrink-0 items-center justify-center">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <p className="text-content font-semibold">Nada pendente</p>
          <p className="text-faint mt-0.5 text-sm">
            Nenhuma visita, oferta ou anúncio esperando por você.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-content text-sm font-semibold">Precisa de você</h2>
      <div className="mt-3 space-y-2.5">
        {itens.map(({ href, icon: Icon, texto, apoio, tom }) => (
          <Link
            key={texto}
            href={href}
            className={`rounded-card flex items-center gap-4 p-4 ring-1 transition-all ring-inset ${
              tom === 'brand'
                ? 'bg-accent-soft ring-brand-500/25 hover:ring-brand-500/50'
                : 'bg-warning-600/10 ring-warning-600/25 hover:ring-warning-600/50'
            }`}
          >
            <span
              className={`rounded-btn flex size-10 shrink-0 items-center justify-center ${
                tom === 'brand'
                  ? 'from-brand-400 to-brand-600 text-ink-950 bg-linear-to-b'
                  : 'bg-warning-600/20 text-warning-600'
              }`}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={tom === 'brand' ? 'text-accent font-semibold' : 'text-content font-semibold'}>
                {texto}
              </p>
              <p className="text-muted mt-0.5 text-sm">{apoio}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------- gráfico

/**
 * Barras empilhadas, feitas com `div` — sem biblioteca de gráfico.
 *
 * Uma biblioteca traria dezenas de kB e um canvas para desenhar oito barras.
 * Com altura em porcentagem o resultado é o mesmo, responsivo de graça, e o
 * conteúdo continua sendo texto que o leitor de tela alcança.
 */
function GraficoDeContatos({ stats }: { stats: DashboardStats | null }) {
  if (!stats) {
    return <div className="rounded-card bg-sunken mt-3 h-56 animate-pulse" />;
  }

  const semanas = stats.leads_by_week;
  const maior = Math.max(...semanas.map((s) => s.appointments + s.consignments), 1);
  const total = semanas.reduce((soma, s) => soma + s.appointments + s.consignments, 0);

  return (
    <div className="rounded-card shadow-card ring-line bg-surface mt-3 p-5 ring-1">
      {total === 0 ? (
        <p className="text-faint py-12 text-center text-sm">
          Nenhum contato nas últimas {SEMANAS} semanas. Assim que entrar o primeiro pedido de
          visita ou de anúncio, ele aparece aqui.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2 sm:gap-3" style={{ height: '11rem' }}>
            {semanas.map((s) => {
              const soma = s.appointments + s.consignments;
              return (
                <div key={s.week_start} className="flex h-full flex-1 flex-col justify-end gap-1.5">
                  <p className="text-faint text-center text-xs tabular-nums">{soma || ''}</p>
                  {/* `title` dá o detalhe no passar do mouse; o aria-label
                      entrega a mesma informação a quem usa leitor de tela. */}
                  <div
                    className="flex w-full flex-col justify-end gap-0.5"
                    style={{ height: `${(soma / maior) * 100}%` }}
                    title={`${rotuloSemana(s.week_start)}: ${s.appointments} visita(s), ${s.consignments} oferta(s)`}
                    aria-label={`Semana de ${rotuloSemana(s.week_start)}: ${s.appointments} agendamentos e ${s.consignments} carros oferecidos`}
                    role="img"
                  >
                    {s.consignments > 0 && (
                      <div
                        className="bg-brand-300 w-full rounded-t-sm"
                        style={{ height: `${(s.consignments / Math.max(soma, 1)) * 100}%` }}
                      />
                    )}
                    {s.appointments > 0 && (
                      <div
                        className="bg-brand-600 w-full rounded-t-sm"
                        style={{ height: `${(s.appointments / Math.max(soma, 1)) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-line mt-3 flex items-end justify-between gap-2 border-t pt-3 sm:gap-3">
            {semanas.map((s) => (
              <p key={s.week_start} className="text-faint flex-1 text-center text-[11px]">
                {rotuloSemana(s.week_start)}
              </p>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-5 text-xs">
            <span className="text-muted flex items-center gap-1.5">
              <span className="bg-brand-600 size-2.5 rounded-sm" />
              Agendamentos
            </span>
            <span className="text-muted flex items-center gap-1.5">
              <span className="bg-brand-300 size-2.5 rounded-sm" />
              Carros oferecidos
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/** "11/08" — a segunda-feira que abre a semana. */
function rotuloSemana(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

// --------------------------------------------------------------- mais vistos

function MaisVistos({ stats }: { stats: DashboardStats | null }) {
  if (!stats) {
    return <div className="rounded-card bg-sunken mt-3 h-40 animate-pulse" />;
  }

  if (stats.top_viewed.length === 0) {
    return (
      <p className="text-faint rounded-card ring-line bg-surface mt-3 p-8 text-center text-sm ring-1">
        Nenhum veículo à venda ainda.
      </p>
    );
  }

  return (
    <div className="rounded-card shadow-card ring-line bg-surface mt-3 divide-y divide-(--color-line) overflow-hidden ring-1">
      {stats.top_viewed.map((v) => (
        <a
          key={v.slug}
          href={`/veiculos/${v.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-sunken flex items-center gap-4 p-4 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="text-content truncate text-sm font-medium">{v.title}</p>
            <p className="text-accent mt-0.5 text-sm font-semibold">{formatPrice(v.price)}</p>
          </div>
          <div className="flex shrink-0 gap-5 text-right">
            <div>
              <p className="text-content text-sm font-semibold tabular-nums">{v.views}</p>
              <p className="text-faint text-xs">visitas</p>
            </div>
            <div>
              <p className="text-content text-sm font-semibold tabular-nums">{v.appointments}</p>
              <p className="text-faint text-xs">agendam.</p>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------- stat

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
    success: 'bg-success-500/10 text-success-700',
    warning: 'bg-warning-600/10 text-warning-700',
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
