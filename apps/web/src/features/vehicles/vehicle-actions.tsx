'use client';

import { useState } from 'react';
import { CalendarCheck, Check, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AppointmentModal } from '@/features/appointments/appointment-modal';

/**
 * Ações da página do veículo.
 *
 * Um Client Component pequeno, cercado por Server Components. É o padrão que
 * mantém a página SEO-friendly: o conteúdo (fotos, ficha, preço) vem no HTML, e
 * só os botões — que precisam de interatividade — carregam JavaScript.
 */
export function VehicleActions({ slug, title }: { slug: string; title: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [shared, setShared] = useState(false);

  const share = async () => {
    const url = window.location.href;

    // No celular, `navigator.share` abre o menu nativo (WhatsApp, Telegram...).
    // É o caminho que o usuário conhece. No desktop, ele não existe — e aí
    // copiamos o link, que é o comportamento esperado ali.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // O usuário cancelou o compartilhamento. Não é erro; não faz nada.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Sem permissão de área de transferência (raro). Falha em silêncio em vez
      // de mostrar um erro que o usuário não pode resolver.
    }
  };

  return (
    <>
      <div className="flex gap-3">
        <Button
          variant="success"
          size="lg"
          onClick={() => setModalOpen(true)}
          className="flex-1"
        >
          <CalendarCheck className="size-4" />
          Agendar visita
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onClick={() => void share()}
          aria-label="Compartilhar anúncio"
          className="shrink-0 px-4"
        >
          {shared ? (
            <>
              <Check className="size-4 text-success-600" />
              <span className="hidden sm:inline">Copiado!</span>
            </>
          ) : (
            <>
              <Share2 className="size-4" />
              <span className="hidden sm:inline">Compartilhar</span>
            </>
          )}
        </Button>
      </div>

      {/* Montado só quando aberto: o estado do formulário nasce limpo a cada
          abertura, sem precisar de um efeito para resetá-lo. */}
      {modalOpen && (
        <AppointmentModal
          vehicleSlug={slug}
          vehicleTitle={title}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
