'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BellRing, Check, MessageCircle, Search, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import type { Interest, InterestPage } from '@/lib/api';
import { formatDate, formatPhone, formatPrice, whatsappLink } from '@/lib/format';
import { errorMessage, http } from '@/lib/http';
import { BODY_LABELS } from '@/lib/labels';

/**
 * Lista de espera — quem pediu para ser avisado.
 *
 * A DIFERENÇA PARA AS OUTRAS DUAS TELAS DE LEAD é que esta não é uma fila de
 * pedidos a responder: é um cruzamento. Agendamento e "carros oferecidos" pedem
 * resposta um a um; aqui a pergunta é outra — "de quem está esperando, para
 * quem eu já tenho carro HOJE?".
 *
 * Por isso o padrão da tela é o filtro "só com carro disponível" LIGADO. Abrir
 * na lista completa mostraria dezenas de pedidos que não dá para atender, e o
 * vendedor fecharia. Abrindo no que dá para fazer agora, a tela vira tarefa.
 */

type Status = 'new' | 'notified' | 'closed';

const STATUS_LABELS: Record<Status, string> = {
  new: 'Aguardando',
  notified: 'Avisado',
  closed: 'Encerrado',
};

const STATUS_TONE: Record<Status, 'warning' | 'brand' | 'success'> = {
  new: 'warning',
  notified: 'brand',
  closed: 'success',
};

export default function AdminInteressesPage() {
  const [page, setPage] = useState<InterestPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [soComCarro, setSoComCarro] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      if (soComCarro) params.set('matching', 'true');

      const { data } = await http.get<InterestPage>(`/admin/interests?${params}`);
      setPage(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [query, status, soComCarro]);

  // 350ms de espera: sem isso cada tecla vira uma requisição, e a resposta de
  // uma busca antiga pode chegar depois da nova e sobrescrever a lista.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 350);
    return () => clearTimeout(timer);
  }, [load]);

  const changeStatus = async (id: string, next: Status) => {
    setUpdating(id);
    try {
      await http.patch(`/admin/interests/${id}/status`, { status: next });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <h1 className="text-content text-2xl font-bold tracking-tight">Lista de espera</h1>
      <p className="text-muted mt-1 text-sm">
        Quem pediu para ser avisado quando o carro certo aparecer.
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-btn bg-danger-500/10 text-danger-700 mt-5 flex items-start gap-2.5 p-3.5 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por pessoa, marca ou modelo"
            className="pl-9"
            aria-label="Buscar na lista de espera"
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

      {/* Ligado por padrão — é a fila do que dá para fazer hoje. */}
      <label className="text-muted mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={soComCarro}
          onChange={(e) => setSoComCarro(e.target.checked)}
          className="accent-brand-600 size-4"
        />
        Mostrar só quem já tem carro compatível no estoque
      </label>

      {page && (
        <p className="text-faint mt-6 text-sm">
          <strong className="text-content font-semibold">{page.meta.total}</strong>{' '}
          {page.meta.total === 1 ? 'pessoa' : 'pessoas'}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {page?.items.map((pedido) => (
          <Linha
            key={pedido.id}
            pedido={pedido}
            atualizando={updating === pedido.id}
            onStatus={changeStatus}
          />
        ))}
      </div>

      {page?.items.length === 0 && (
        <p className="text-muted rounded-card bg-surface ring-line mt-4 p-8 text-center text-sm ring-1">
          {soComCarro
            ? 'Ninguém da lista tem carro compatível no estoque agora. Desmarque acima para ver todos.'
            : 'Ninguém na lista de espera ainda.'}
        </p>
      )}
    </div>
  );
}

function Linha({
  pedido,
  atualizando,
  onStatus,
}: {
  pedido: Interest;
  atualizando: boolean;
  onStatus: (id: string, next: Status) => void;
}) {
  const status = pedido.status as Status;

  // O perfil em uma linha: "Fiat Toro · Picape · até R$ 60.000". Modelo e
  // categoria só entram quando a pessoa escolheu — vazio significa "tanto faz".
  const perfil = [
    pedido.model_name ? `${pedido.brand_name} ${pedido.model_name}` : pedido.brand_name,
    pedido.body_type ? BODY_LABELS[pedido.body_type] : null,
    `até ${formatPrice(pedido.max_price)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="rounded-card bg-surface ring-line p-5 ring-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-content font-semibold">{perfil}</h2>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
          </div>
          <p className="text-muted mt-1 text-sm">
            {pedido.name} · {formatPhone(pedido.phone)}
            {pedido.email ? ` · ${pedido.email}` : ''}
          </p>
        </div>
        <span className="text-faint text-xs">{formatDate(pedido.created_at)}</span>
      </div>

      {pedido.notes && (
        <p className="text-muted bg-sunken rounded-btn mt-3 p-3 text-sm">{pedido.notes}</p>
      )}

      {/* O CRUZAMENTO — o motivo de esta tela existir.
          Sem ele, o vendedor teria de abrir o estoque e conferir de cabeça a
          cada carro que entra, e não faria. */}
      {pedido.matches.length > 0 ? (
        <div className="rounded-btn bg-accent-soft ring-brand-500/20 mt-4 p-3.5 ring-1 ring-inset">
          <p className="text-accent flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4" />
            {pedido.matches.length === 1
              ? '1 carro no estoque combina'
              : `${pedido.matches.length} carros no estoque combinam`}
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {pedido.matches.map((carro) => (
              <li key={carro.slug} className="flex flex-wrap items-center gap-x-2 text-sm">
                <a
                  href={`/veiculos/${carro.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-content font-medium hover:underline"
                >
                  {carro.title}
                </a>
                <span className="text-accent font-semibold">{formatPrice(carro.price)}</span>
              </li>
            ))}
          </ul>

          {/* A mensagem já vai escrita com o carro mais barato que serve — é o
              que transforma "tenho um match" em "a oferta foi enviada". */}
          <a
            href={whatsappLink(
              pedido.phone,
              `Olá, ${pedido.name.split(' ')[0]}! Você pediu para ser avisado sobre ${pedido.brand_name} aqui na Giro Auto. ` +
                `Acabou de entrar um ${pedido.matches[0].title} por ${formatPrice(pedido.matches[0].price)}. Quer ver?`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-btn bg-success-700 hover:bg-success-800 mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white transition-colors"
          >
            <MessageCircle className="size-3.5" />
            Enviar oferta no WhatsApp
          </a>
        </div>
      ) : (
        <p className="text-faint mt-4 flex items-center gap-1.5 text-sm">
          <BellRing className="size-4" />
          Nenhum carro compatível no estoque agora.
        </p>
      )}

      {/* Só o que ainda espera ação ganha botões. Pedido encerrado é histórico. */}
      {status !== 'closed' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {status === 'new' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={atualizando}
              onClick={() => onStatus(pedido.id, 'notified')}
            >
              <Check className="size-4" />
              Marcar como avisado
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={atualizando}
            onClick={() => onStatus(pedido.id, 'closed')}
          >
            Encerrar
          </Button>
        </div>
      )}
    </article>
  );
}
