'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, MessageCircle, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { formatDate, formatPhone, formatPrice, whatsappLink } from '@/lib/format';
import { errorMessage, http } from '@/lib/http';

/**
 * Pedidos de quem quer anunciar o carro — o lead de ESTOQUE.
 *
 * A tela de agendamentos mostra quem quer COMPRAR; esta mostra quem tem carro
 * para VENDER. As duas são listas de lead e por isso se parecem, mas a ordem é
 * oposta: lá o vendedor precisa da visita mais próxima, aqui do pedido que
 * acabou de chegar — quem quer vender está falando com outras lojas ao mesmo
 * tempo, e o pedido de ontem provavelmente já fechou em outro lugar.
 */

type Status = 'new' | 'contacted' | 'published' | 'declined';

type Consignment = {
  id: string;
  owner_name: string;
  phone: string;
  vehicle: string;
  year: number;
  mileage: number;
  asking_price: string;
  city: string | null;
  notes: string | null;
  status: Status;
  created_at: string;
};

type ConsignmentPage = { items: Consignment[]; meta: { total: number } };

const STATUS_LABELS: Record<Status, string> = {
  new: 'Novo',
  contacted: 'Em contato',
  published: 'Anunciado',
  declined: 'Recusado',
};

const STATUS_TONE: Record<Status, 'warning' | 'brand' | 'success' | 'danger'> = {
  new: 'warning',
  contacted: 'brand',
  published: 'success',
  declined: 'danger',
};

export default function AdminAnunciePage() {
  const [page, setPage] = useState<ConsignmentPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (status) params.set('status', status);

      const { data } = await http.get<ConsignmentPage>(`/admin/consignments?${params}`);
      setPage(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [query, status]);

  // Espera 350ms antes de buscar: sem isso, cada tecla digitada vira uma
  // requisição, e a resposta de uma busca antiga pode chegar depois da nova e
  // sobrescrever a lista com o resultado errado.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 350);
    return () => clearTimeout(timer);
  }, [load]);

  const changeStatus = async (id: string, next: Status) => {
    setUpdating(id);
    try {
      await http.patch(`/admin/consignments/${id}/status`, { status: next });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <h1 className="text-content text-2xl font-bold tracking-tight">Carros oferecidos</h1>
      <p className="text-muted mt-1 text-sm">
        Pedidos enviados pelo site por quem quer vender o carro através da loja.
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
            placeholder="Buscar por dono ou carro"
            className="pl-9"
            aria-label="Buscar pedidos"
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

      {page && (
        <p className="text-faint mt-6 text-sm">
          <strong className="text-content font-semibold">{page.meta.total}</strong>{' '}
          {page.meta.total === 1 ? 'pedido' : 'pedidos'}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {page?.items.map((pedido) => (
          <article
            key={pedido.id}
            className="rounded-card bg-surface ring-line p-5 ring-1"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-content font-semibold">{pedido.vehicle}</h2>
                  <Badge tone={STATUS_TONE[pedido.status]}>
                    {STATUS_LABELS[pedido.status]}
                  </Badge>
                </div>
                <p className="text-muted mt-1 text-sm">
                  {pedido.year} · {pedido.mileage.toLocaleString('pt-BR')} km
                  {pedido.city ? ` · ${pedido.city}` : ''}
                </p>
              </div>
              <p className="text-accent text-lg font-semibold">
                {formatPrice(pedido.asking_price)}
              </p>
            </div>

            <div className="border-line mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-sm">
              <span className="text-content font-medium">{pedido.owner_name}</span>
              <span className="text-muted">{formatPhone(pedido.phone)}</span>
              <a
                href={whatsappLink(
                  pedido.phone,
                  `Olá, ${pedido.owner_name.split(' ')[0]}! Recebemos o seu ${pedido.vehicle} no site da Giro Auto.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-btn bg-success-500/10 text-success-700 hover:bg-success-500/20 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors"
              >
                <MessageCircle className="size-3.5" />
                WhatsApp
              </a>
              <span className="text-faint ml-auto text-xs">{formatDate(pedido.created_at)}</span>
            </div>

            {pedido.notes && (
              <p className="text-muted bg-sunken rounded-btn mt-3 p-3 text-sm">{pedido.notes}</p>
            )}

            {/* Só o que ainda espera ação ganha botões. Pedido anunciado ou
                recusado é histórico — oferecer ação nele só cria chance de
                clique errado. */}
            {(pedido.status === 'new' || pedido.status === 'contacted') && (
              <div className="mt-4 flex flex-wrap gap-2">
                {pedido.status === 'new' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={updating === pedido.id}
                    onClick={() => void changeStatus(pedido.id, 'contacted')}
                  >
                    <MessageCircle className="size-4" />
                    Marcar como em contato
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="success"
                  disabled={updating === pedido.id}
                  onClick={() => void changeStatus(pedido.id, 'published')}
                >
                  <Check className="size-4" />
                  Anunciado
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={updating === pedido.id}
                  onClick={() => void changeStatus(pedido.id, 'declined')}
                >
                  <X className="size-4" />
                  Recusar
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>

      {page?.items.length === 0 && (
        <p className="text-muted rounded-card bg-surface ring-line mt-4 p-8 text-center text-sm ring-1">
          Nenhum pedido ainda.
        </p>
      )}
    </div>
  );
}
