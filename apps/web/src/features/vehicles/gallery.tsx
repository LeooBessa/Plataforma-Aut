'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

import type { Image as VehicleImage } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Galeria de fotos.
 *
 * A foto é o que vende o carro — o comprador olha as imagens antes de ler
 * qualquer especificação. Por isso: foto grande, troca instantânea, zoom em tela
 * cheia e navegação pelo teclado.
 */
export function Gallery({ images, title }: { images: VehicleImage[]; title: string }) {
  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const total = images.length;

  const go = (delta: number) => {
    // O módulo faz a galeria circular: depois da última vem a primeira. Chegar
    // ao fim e não poder avançar é uma parede desnecessária.
    setCurrent((index) => (index + delta + total) % total);
  };

  // Navegação por teclado. Sem isto, quem não usa mouse não navega a galeria —
  // e o zoom em tela cheia viraria uma armadilha sem saída (sem Esc).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'Escape') setZoomed(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Trava a rolagem do fundo enquanto o zoom está aberto. Sem isso, rolar dentro
  // do lightbox move a página atrás — e ao fechar, o usuário está noutro lugar.
  useEffect(() => {
    document.body.style.overflow = zoomed ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [zoomed]);

  if (total === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-card bg-ink-100 text-sm text-ink-400">
        Sem fotos
      </div>
    );
  }

  const active = images[current];

  return (
    <>
      <div className="space-y-3">
        <div className="group relative aspect-[4/3] overflow-hidden rounded-card bg-ink-100">
          <Image
            src={active.url}
            alt={active.alt_text ?? `${title} — foto ${current + 1} de ${total}`}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            // A foto principal é quase certamente o LCP da página. No Next 16,
            // `priority` está deprecado; a forma atual é esta.
            loading="eager"
            fetchPriority="high"
            className="object-cover"
          />

          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-btn bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Ampliar foto"
          >
            <ZoomIn className="size-5" />
          </button>

          {total > 1 && (
            <>
              <NavButton side="left" onClick={() => go(-1)} />
              <NavButton side="right" onClick={() => go(1)} />

              <p className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                {current + 1} / {total}
              </p>
            </>
          )}
        </div>

        {total > 1 && (
          <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
            {images.map((image, index) => (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(index)}
                  aria-label={`Ver foto ${index + 1}`}
                  aria-current={index === current}
                  className={cn(
                    'relative aspect-[4/3] w-full overflow-hidden rounded-btn ring-2 transition-all',
                    index === current
                      ? 'ring-brand-600'
                      : 'opacity-60 ring-transparent hover:opacity-100',
                  )}
                >
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {zoomed && (
        <div
          // `role="dialog"` + `aria-modal` fazem o leitor de tela entender que o
          // resto da página está inacessível enquanto isto estiver aberto.
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — foto ampliada`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-btn text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="size-6" />
          </button>

          <div
            className="relative h-full w-full max-w-6xl"
            // Impede que o clique na própria imagem feche o lightbox.
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={active.url}
              alt={active.alt_text ?? title}
              fill
              sizes="100vw"
              className="object-contain"
            />

            {total > 1 && (
              <>
                <NavButton side="left" onClick={() => go(-1)} dark />
                <NavButton side="right" onClick={() => go(1)} dark />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NavButton({
  side,
  onClick,
  dark = false,
}: {
  side: 'left' | 'right';
  onClick: () => void;
  dark?: boolean;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Foto anterior' : 'Próxima foto'}
      className={cn(
        'absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur transition-colors',
        side === 'left' ? 'left-3' : 'right-3',
        dark
          ? 'bg-white/10 text-white hover:bg-white/20'
          : 'bg-white/85 text-ink-900 hover:bg-white',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
