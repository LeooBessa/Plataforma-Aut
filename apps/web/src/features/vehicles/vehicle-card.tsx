import Image from 'next/image';
import Link from 'next/link';
import { Fuel, Gauge, MapPin, Settings2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { VehicleSummary } from '@/lib/api';
import { formatMileage, formatPrice, formatYears } from '@/lib/format';
import { FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

/**
 * O card do veículo — o componente mais visto do site.
 *
 * O card INTEIRO é um link. Um "Ver detalhes" pequeno no canto obrigaria o
 * usuário a mirar; no celular, isso é fricção real e derruba o clique. A área de
 * toque é o card todo.
 */
export function VehicleCard({
  vehicle,
  priority = false,
}: {
  vehicle: VehicleSummary;
  /** True apenas para os primeiros cards visíveis — ver o comentário no <Image>. */
  priority?: boolean;
}) {
  const cover = vehicle.cover_image;
  const isSold = vehicle.status === 'sold';
  const isReserved = vehicle.status === 'reserved';

  return (
    <Link
      href={`/veiculos/${vehicle.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card bg-white',
        'shadow-card ring-1 ring-ink-100',
        'transition-[box-shadow,transform] duration-300 ease-out',
        'hover:-translate-y-1 hover:shadow-card-hover',
        'motion-reduce:hover:translate-y-0',
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt_text ?? vehicle.title}
            fill
            // `sizes` é o que impede o navegador de baixar uma imagem de 1200px
            // para um card de 300px no celular. Sem isto, o `fill` faz o browser
            // assumir 100vw e o site fica lento em rede móvel — que é onde a
            // maioria dos compradores está.
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            // No Next 16, `priority` está deprecado. Para a imagem que provavelmente
            // é o LCP (os primeiros cards), carregamos com prioridade alta; o
            // resto fica lazy, que é o padrão.
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            className={cn(
              'object-cover transition-transform duration-500 ease-out',
              'group-hover:scale-[1.04] motion-reduce:group-hover:scale-100',
              isSold && 'grayscale',
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-400">
            Sem foto
          </div>
        )}

        <div className="absolute left-3 top-3 flex gap-2">
          {vehicle.is_featured && !isSold && <Badge tone="dark">Destaque</Badge>}
          {isReserved && <Badge tone="warning">Reservado</Badge>}
          {isSold && <Badge tone="neutral">Vendido</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-ink-900">{vehicle.title}</h3>

        <p className="mt-1 text-sm text-ink-500">
          {formatYears(vehicle.year_manufacture, vehicle.year_model)}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-ink-600">
          <Spec icon={<Gauge className="size-3.5" />} label={formatMileage(vehicle.mileage)} />
          <Spec icon={<Fuel className="size-3.5" />} label={FUEL_LABELS[vehicle.fuel_type]} />
          <Spec
            icon={<Settings2 className="size-3.5" />}
            label={TRANSMISSION_LABELS[vehicle.transmission]}
          />
          <Spec icon={<MapPin className="size-3.5" />} label={vehicle.city} />
        </dl>

        {/* `mt-auto` empurra o preço para baixo: assim os preços de todos os
            cards ficam alinhados na mesma linha, mesmo que um título ocupe duas
            linhas e outro só uma. Cards com preços em alturas diferentes ficam
            visualmente bagunçados. */}
        <div className="mt-auto flex items-end justify-between pt-4">
          <p className="text-xl font-bold tracking-tight text-ink-950">
            {formatPrice(vehicle.price)}
          </p>
          <span className="text-sm font-semibold text-brand-600 transition-colors group-hover:text-brand-700">
            Ver detalhes
          </span>
        </div>
      </div>
    </Link>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink-400">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

/** Esqueleto exibido enquanto a listagem carrega. */
export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card bg-white shadow-card ring-1 ring-ink-100">
      <div className="aspect-[4/3] animate-pulse bg-ink-100" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-ink-100" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-ink-100" />
          ))}
        </div>
        <div className="h-6 w-1/2 animate-pulse rounded bg-ink-100" />
      </div>
    </div>
  );
}
