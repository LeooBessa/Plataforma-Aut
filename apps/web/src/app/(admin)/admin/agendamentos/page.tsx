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

      const { data } = await http.get<AppointmentPage>(
        `/admin/appointments?${params.toString()}`,
      );
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
        <h1 className="text-content text-2xl font-bold tracking-tight">Agendamentos</h1>
        <p className="text-faint mt-1 text-sm">
          Cada linha é um cliente que quer ver um carro.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-faint pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
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
          className="rounded-card bg-danger-500/10 text-danger-400 ring-danger-500/20 flex items-start gap-3 p-4 text-sm ring-1 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-card shadow-card ring-line overflow-hidden bg-surface ring-1">
        {page === null ? (
          <div className="divide-line divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-5">
                <div className="bg-sunken h-4 w-1/3 animate-pulse rounded" />
                <div className="bg-sunken h-3 w-1/2 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : page.items.length === 0 ? (
          <p className="text-faint p-12 text-center text-sm">
            Nenhum agendamento encontrado.
          </p>
        ) : (
          <ul className="divide-line divide-y">
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
                        <p className="text-content font-semibold">
                          {appointment.customer_name}
                        </p>
                        <Badge tone={STATUS_TONE[appointment.status]}>
                          {STATUS_LABELS[appointment.status]}
                        </Badge>
                      </div>

                      <p className="text-muted mt-1 text-sm">{appointment.vehicle.title}</p>

                      <p className="text-content mt-1 text-sm font-medium">
                        {formatDate(appointment.scheduled_date)} às{' '}
                        {formatTime(appointment.scheduled_time)}
                      </p>

                      {appointment.notes && (
                        <p className="rounded-btn bg-canvas text-muted mt-2 p-2.5 text-sm">
                          {appointment.notes}
                        </p>
                      )}

                      {/* Contato a UM clique. O vendedor não deveria precisar
                          copiar um número e colar noutro app — a fricção aqui
                          é medida em vendas perdidas. */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={`tel:+55${appointment.phone}`}
                          className="rounded-btn bg-sunken text-content hover:bg-sunken inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors"
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
                            className="rounded-btn bg-success-500/10 text-success-400 hover:bg-success-500/20 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors"
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
