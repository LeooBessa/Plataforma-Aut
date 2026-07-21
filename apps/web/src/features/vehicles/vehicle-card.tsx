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
 * usuário a mirar; no celular, isso é fricção real e derruba o clique.
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
        'group rounded-card relative flex flex-col overflow-hidden',
        'border-ink-800 bg-ink-900 border',
        'transition-all duration-500 ease-out',
        // Num site escuro, sombra não separa nada (preto sobre preto). A
        // elevação vem da BORDA que acende em dourado.
        'hover:border-brand-600/50 hover:shadow-card-hover hover:-translate-y-1',
        'motion-reduce:hover:translate-y-0',
      )}
    >
      <div className="bg-ink-850 relative aspect-[4/3] overflow-hidden">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt_text ?? vehicle.title}
            fill
            // `sizes` impede o navegador de baixar uma imagem de 1200px para um
            // card de 300px no celular — onde está a maioria dos compradores.
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            className={cn(
              'object-cover transition-transform duration-700 ease-out',
              'group-hover:scale-[1.04] motion-reduce:group-hover:scale-100',
              isSold && 'grayscale',
            )}
          />
        ) : (
          <div className="text-silver-500 flex h-full items-center justify-center text-sm">
            Sem foto
          </div>
        )}

        <div className="absolute top-3 left-3 flex gap-2">
          {vehicle.is_featured && !isSold && <Badge tone="gold">Destaque</Badge>}
          {isReserved && <Badge tone="warning">Reservado</Badge>}
          {isSold && <Badge tone="neutral">Vendido</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-silver-100 line-clamp-2 leading-snug font-medium">
          {vehicle.title}
        </h3>

        <p className="text-silver-500 mt-1 text-sm">
          {formatYears(vehicle.year_manufacture, vehicle.year_model)}
        </p>

        {/* `<ul>`, não `<dl>`: são chips de ícone+texto, não pares
            termo/definição. Um `<dl>` com `<div>` dentro é HTML inválido. */}
        <ul className="text-silver-400 mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Spec icon={<Gauge className="size-3.5" />} label={formatMileage(vehicle.mileage)} />
          <Spec icon={<Fuel className="size-3.5" />} label={FUEL_LABELS[vehicle.fuel_type]} />
          <Spec
            icon={<Settings2 className="size-3.5" />}
            label={TRANSMISSION_LABELS[vehicle.transmission]}
          />
          <Spec icon={<MapPin className="size-3.5" />} label={vehicle.city} />
        </ul>

        {/* `mt-auto` alinha os preços de todos os cards na mesma linha, mesmo
            que um título ocupe duas linhas e outro só uma. */}
        <div className="border-ink-800 mt-5 mt-auto flex items-end justify-between border-t pt-4">
          <p className="text-gold-gradient text-xl font-semibold tracking-tight">
            {formatPrice(vehicle.price)}
          </p>
          <span className="text-silver-500 group-hover:text-brand-400 text-sm transition-colors">
            Ver detalhes
          </span>
        </div>
      </div>
    </Link>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="text-silver-600" aria-hidden>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </li>
  );
}

/** Esqueleto exibido enquanto a listagem carrega. */
export function VehicleCardSkeleton() {
  return (
    <div className="rounded-card border-ink-800 bg-ink-900 overflow-hidden border">
      <div className="bg-ink-850 aspect-[4/3] animate-pulse" />
      <div className="space-y-3 p-5">
        <div className="bg-ink-800 h-4 w-3/4 animate-pulse rounded" />
        <div className="bg-ink-800 h-3 w-1/3 animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-ink-800 h-3 animate-pulse rounded" />
          ))}
        </div>
        <div className="bg-ink-800 h-6 w-1/2 animate-pulse rounded" />
      </div>
    </div>
  );
}
