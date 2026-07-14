'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, MessageCircle, Phone, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import type { Appointment } from '@/lib/api';
import { formatDate, formatPhone, formatTime, whatsappLink } from '@/lib/format';
import { errorMessage, http } from '@/lib/http';

type AppointmentPage = {
  items: Appointment[];
  meta: { total: number };
};

type Status = Appointment['status'];

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Finalizado',
};

const STATUS_TONE: Record<Status, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'danger',
  completed: 'neutral',
};

export default function AdminAgendamentosPage() {
  const [page, setPage] = useState<AppointmentPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState('');
  const [status, setStatus] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (customer) params.set('customer', customer);
      if (status) params.set('status', status);

      const { data } = await http.get<AppointmentPage>(`/admin/appointments?${params.toString()}`);
      setPage(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [customer, status]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 350);
    return () => clearTimeout(timer);
  }, [load]);

  const changeStatus = async (id: string, next: Status) => {
    setUpdating(id);
    try {
      await http.patch(`/admin/appointments/${id}/status`, { status: next });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950">Agendamentos</h1>
        <p className="mt-1 text-sm text-ink-500">
          Cada linha é um cliente que quer ver um carro.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <Input
            type="search"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Buscar pelo nome do cliente"
            className="pl-10"
            aria-label="Buscar por cliente"
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
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-5">
                <div className="h-4 w-1/3 animate-pulse rounded bg-ink-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
              </div>
            ))}
          </div>
        ) : page.items.length === 0 ? (
          <p className="p-12 text-center text-sm text-ink-500">Nenhum agendamento encontrado.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {page.items.map((appointment) => {
              // Concluído ou cancelado é histórico: não muda mais. A API recusa,
              // e a interface não oferece o botão — evitar o erro é melhor do
              // que exibi-lo.
              const isOpen =
                appointment.status === 'pending' || appointment.status === 'confirmed';

              return (
                <li key={appointment.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink-900">{appointment.customer_name}</p>
                        <Badge tone={STATUS_TONE[appointment.status]}>
                          {STATUS_LABELS[appointment.status]}
                        </Badge>
                      </div>

                      <p className="mt-1 text-sm text-ink-600">{appointment.vehicle.title}</p>

                      <p className="mt-1 text-sm font-medium text-ink-900">
                        {formatDate(appointment.scheduled_date)} às{' '}
                        {formatTime(appointment.scheduled_time)}
                      </p>

                      {appointment.notes && (
                        <p className="mt-2 rounded-btn bg-ink-50 p-2.5 text-sm text-ink-600">
                          {appointment.notes}
                        </p>
                      )}

                      {/* Contato a UM clique. O vendedor não deveria precisar
                          copiar um número e colar noutro app — a fricção aqui
                          é medida em vendas perdidas. */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={`tel:+55${appointment.phone}`}
                          className="inline-flex items-center gap-1.5 rounded-btn bg-ink-100 px-2.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-ink-200"
                        >
                          <Phone className="size-3.5" />
                          {formatPhone(appointment.phone)}
                        </a>

                        {appointment.whatsapp && (
                          <a
                            href={whatsappLink(
                              appointment.whatsapp,
                              `Olá, ${appointment.customer_name.split(' ')[0]}! Sobre sua visita ao ${appointment.vehicle.title}...`,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-btn bg-success-50 px-2.5 py-1.5 text-xs font-medium text-success-700 transition-colors hover:bg-success-100"
                          >
                            <MessageCircle className="size-3.5" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="flex shrink-0 gap-2">
                        {appointment.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="success"
                            disabled={updating === appointment.id}
                            onClick={() => void changeStatus(appointment.id, 'confirmed')}
                          >
                            <Check className="size-3.5" />
                            Confirmar
                          </Button>
                        )}
                        {appointment.status === 'confirmed' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={updating === appointment.id}
                            onClick={() => void changeStatus(appointment.id, 'completed')}
                          >
                            <Check className="size-3.5" />
                            Finalizar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={updating === appointment.id}
                          onClick={() => void changeStatus(appointment.id, 'cancelled')}
                        >
                          <X className="size-3.5" />
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
