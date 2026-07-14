'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  Send,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/features/vehicles/image-uploader';
import { VehicleForm } from '@/features/vehicles/vehicle-form';
import type { VehicleDetail, VehicleStatus } from '@/lib/api';
import { errorMessage, http } from '@/lib/http';
import { STATUS_LABELS } from '@/lib/labels';

const STATUS_TONE: Record<VehicleStatus, 'success' | 'warning' | 'neutral' | 'brand'> = {
  active: 'success',
  reserved: 'warning',
  draft: 'brand',
  sold: 'neutral',
  archived: 'neutral',
};

/** No Next 16, `params` é uma Promise — `use()` a resolve num Client Component. */
export default function EditarVeiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Um contador que, ao mudar, dispara o recarregamento.
  //
  // Parece rebuscado, mas evita um antipadrão real: chamar `setState` de forma
  // síncrona dentro de um efeito provoca renders em cascata (o lint do React
  // acusa). Aqui o efeito só reage a `id` e `reloadKey`, e a atualização de
  // estado acontece dentro de uma função assíncrona — como deve ser.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    // `cancelled` protege contra atualizar o estado de um componente que já foi
    // desmontado — o que acontece se o admin sair da página enquanto a
    // requisição está em voo. Sem isso, o React reclama de vazamento.
    let cancelled = false;

    (async () => {
      try {
        const { data } = await http.get<VehicleDetail>(`/admin/vehicles/${id}`);
        if (!cancelled) setVehicle(data);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const changeStatus = async (status: VehicleStatus) => {
    setBusy(true);
    setError(null);
    try {
      await http.patch(`/admin/vehicles/${id}/status`, { status });
      reload();
    } catch (err) {
      // A API recusa publicar sem foto. A mensagem dela é clara e específica —
      // repetimos exatamente o que ela diz, em vez de inventar uma genérica.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      const { data } = await http.post<VehicleDetail>(`/admin/vehicles/${id}/duplicate`);
      router.push(`/admin/veiculos/${data.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const archive = async () => {
    setBusy(true);
    try {
      await http.post(`/admin/vehicles/${id}/archive`);
      router.push('/admin/veiculos');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const destroy = async () => {
    // Confirmação porque é IRREVERSÍVEL. A API ainda recusa se houver
    // agendamentos — mas um clique acidental num botão de exclusão não deveria
    // depender da rede para ser desfeito.
    if (!confirm('Excluir este anúncio definitivamente? Esta ação não pode ser desfeita.')) {
      return;
    }

    setBusy(true);
    try {
      await http.delete(`/admin/vehicles/${id}`);
      router.push('/admin/veiculos');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (!vehicle) {
    return (
      <div className="text-ink-500 flex items-center gap-3 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando anúncio...
      </div>
    );
  }

  const canPublish = vehicle.status !== 'active' && vehicle.status !== 'sold';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/admin/veiculos"
          className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Voltar aos anúncios
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-ink-950 text-2xl font-bold tracking-tight">
                {vehicle.title}
              </h1>
              <Badge tone={STATUS_TONE[vehicle.status]}>{STATUS_LABELS[vehicle.status]}</Badge>
            </div>

            {vehicle.status === 'active' && (
              <a
                href={`/veiculos/${vehicle.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:text-brand-700 mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium"
              >
                Ver no site
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {canPublish && (
              <Button
                variant="success"
                disabled={busy}
                onClick={() => void changeStatus('active')}
              >
                <Send className="size-4" />
                Publicar
              </Button>
            )}
            {vehicle.status === 'active' && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void changeStatus('sold')}
              >
                Marcar como vendido
              </Button>
            )}
            <Button variant="secondary" disabled={busy} onClick={() => void duplicate()}>
              <Copy className="size-4" />
              Duplicar
            </Button>
            {vehicle.status !== 'archived' && (
              <Button variant="ghost" disabled={busy} onClick={() => void archive()}>
                <Archive className="size-4" />
                Arquivar
              </Button>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => void destroy()}>
              <Trash2 className="text-danger-600 size-4" />
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-card bg-danger-50 text-danger-700 ring-danger-500/20 flex items-start gap-2.5 p-4 text-sm ring-1 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* As FOTOS vêm primeiro, antes do formulário.
          É a primeira coisa que falta depois de criar o rascunho, e sem elas o
          anúncio não pode ser publicado. Enterrá-las no fim da página faria o
          admin procurar. */}
      <section className="rounded-card shadow-card ring-ink-100 bg-white p-6 ring-1">
        <div className="flex items-center justify-between">
          <h2 className="text-ink-900 text-sm font-semibold">Fotos</h2>
          <span className="text-ink-500 text-xs">{vehicle.images.length} de 20</span>
        </div>

        {vehicle.images.length === 0 && (
          <p className="rounded-btn bg-warning-50 text-warning-700 ring-warning-600/20 mt-2 p-3 text-xs ring-1 ring-inset">
            Este anúncio ainda não tem fotos e por isso <strong>não pode ser publicado</strong>.
          </p>
        )}

        <div className="mt-4">
          <ImageUploader
            vehicleId={vehicle.id}
            images={vehicle.images}
            onChange={reload}
          />
        </div>
      </section>

      {/* `key` força o formulário a remontar quando o veículo é recarregado —
          senão os campos manteriam os valores antigos do React Hook Form. */}
      <VehicleForm key={vehicle.id} vehicle={vehicle} />
    </div>
  );
}
