import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Calendar,
  Check,
  ChevronRight,
  Gauge,
  KeyRound,
  MapPin,
  Palette,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Gallery } from '@/features/vehicles/gallery';
import { VehicleActions } from '@/features/vehicles/vehicle-actions';
import { ApiError, getVehicle, type VehicleDetail } from '@/lib/api';
import { formatMileage, formatPrice, formatYears } from '@/lib/format';
import { BODY_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/labels';

// ISR: página estática, regenerada a cada 5 minutos. Quando o admin editar este
// anúncio, a tag `vehicle:<slug>` é invalidada e a página se atualiza em segundos.
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

/**
 * `cache()` do React deduplica a chamada.
 *
 * `generateMetadata` e o componente da página precisam do MESMO veículo. Sem
 * isto, seriam duas requisições idênticas à API a cada página renderizada —
 * o dobro do custo, para o mesmo dado.
 */
const loadVehicle = cache(async (slug: string): Promise<VehicleDetail | null> => {
  try {
    return await getVehicle(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await loadVehicle(slug);

  if (!vehicle) {
    return { title: 'Veículo não encontrado' };
  }

  const title = `${vehicle.title} ${vehicle.year_model}`;
  const description =
    vehicle.description?.slice(0, 155) ??
    `${vehicle.title} ${formatYears(vehicle.year_manufacture, vehicle.year_model)}, ` +
      `${formatMileage(vehicle.mileage)}, ${FUEL_LABELS[vehicle.fuel_type]}. ` +
      `${formatPrice(vehicle.price)}.`;

  const cover = vehicle.images.find((image) => image.is_cover) ?? vehicle.images[0];

  return {
    title,
    description,
    // A imagem do Open Graph é o que aparece quando alguém cola o link no
    // WhatsApp. Um anúncio de carro compartilhado SEM foto praticamente não é
    // clicado — e o WhatsApp é o principal canal de compartilhamento no Brasil.
    openGraph: {
      title: `${title} — ${formatPrice(vehicle.price)}`,
      description,
      type: 'website',
      images: cover ? [{ url: cover.url, width: 1200, height: 800, alt: vehicle.title }] : [],
    },
    alternates: { canonical: `/veiculos/${slug}` },
  };
}

export default async function VeiculoPage({ params }: Props) {
  const { slug } = await params;
  const vehicle = await loadVehicle(slug);

  if (!vehicle) notFound();

  const isSold = vehicle.status === 'sold';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <JsonLd vehicle={vehicle} />

      <Breadcrumbs title={vehicle.title} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
        <div className="min-w-0">
          <Gallery images={vehicle.images} title={vehicle.title} />

          {vehicle.description && (
            <section className="mt-10">
              <h2 className="text-lg font-bold text-ink-950">Descrição</h2>
              {/* Texto puro, renderizado pelo JSX — que escapa tudo por padrão.
                  Nada de dangerouslySetInnerHTML: aceitar HTML aqui abriria XSS
                  armazenado, e o admin é justamente quem tem mais poder de
                  causar dano se a conta dele for comprometida. */}
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-600">
                {vehicle.description}
              </p>
            </section>
          )}

          <Specs vehicle={vehicle} />

          {vehicle.features.length > 0 && <Features vehicle={vehicle} />}
        </div>

        {/* `sticky` mantém o preço e o botão de agendar sempre à vista enquanto
            o usuário lê a ficha. O botão que converte não pode sumir da tela. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card bg-white p-6 shadow-card ring-1 ring-ink-100">
            <div className="flex flex-wrap items-center gap-2">
              {vehicle.is_featured && !isSold && <Badge tone="dark">Destaque</Badge>}
              {vehicle.status === 'reserved' && <Badge tone="warning">Reservado</Badge>}
              {isSold && <Badge tone="neutral">Vendido</Badge>}
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-950">
              {vehicle.title}
            </h1>

            <p className="mt-1 text-sm text-ink-500">
              {formatYears(vehicle.year_manufacture, vehicle.year_model)} ·{' '}
              {formatMileage(vehicle.mileage)}
            </p>

            <p className="mt-5 text-3xl font-bold tracking-tight text-ink-950">
              {formatPrice(vehicle.price)}
            </p>

            {vehicle.accepts_financing && vehicle.estimated_installment && (
              <div className="mt-4 rounded-btn bg-brand-50 p-4">
                <p className="text-sm text-brand-900">
                  <strong className="font-semibold">
                    {vehicle.installments_count}x de{' '}
                    {formatPrice(vehicle.estimated_installment)}
                  </strong>
                </p>
                {vehicle.down_payment && (
                  <p className="mt-0.5 text-xs text-brand-700">
                    com entrada de {formatPrice(vehicle.down_payment)}
                  </p>
                )}
                {/* A parcela NÃO inclui juros — e dizemos isso. Apresentar uma
                    parcela "com juros" inventada pela plataforma seria informação
                    financeira enganosa. */}
                <p className="mt-2 text-xs text-brand-700/80">
                  Simulação sem juros. Condições reais na aprovação do banco.
                </p>
              </div>
            )}

            <div className="mt-6">
              {isSold ? (
                <div className="rounded-btn bg-ink-100 p-4 text-center">
                  <p className="text-sm font-medium text-ink-700">Este veículo já foi vendido.</p>
                  <Link
                    href="/veiculos"
                    className="mt-1 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Ver veículos parecidos
                  </Link>
                </div>
              ) : (
                <VehicleActions slug={vehicle.slug} title={vehicle.title} />
              )}
            </div>

            <ul className="mt-6 space-y-2 border-t border-ink-100 pt-5 text-sm">
              {vehicle.accepts_trade && <Perk>Aceita seu carro na troca</Perk>}
              {vehicle.accepts_financing && <Perk>Financiamento facilitado</Perk>}
              {vehicle.ipva_paid && <Perk>IPVA pago</Perk>}
              {vehicle.licensing_paid && <Perk>Licenciamento em dia</Perk>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-ink-600">
      <Check className="size-4 shrink-0 text-success-600" />
      {children}
    </li>
  );
}

function Breadcrumbs({ title }: { title: string }) {
  return (
    // O breadcrumb serve ao usuário e ao Google: ele aparece no resultado da
    // busca e ajuda o rastreador a entender a hierarquia do site.
    <nav aria-label="Você está aqui" className="flex items-center gap-1.5 text-sm text-ink-500">
      <Link href="/" className="transition-colors hover:text-ink-900">
        Home
      </Link>
      <ChevronRight className="size-3.5" />
      <Link href="/veiculos" className="transition-colors hover:text-ink-900">
        Veículos
      </Link>
      <ChevronRight className="size-3.5" />
      <span className="truncate text-ink-900">{title}</span>
    </nav>
  );
}

function Specs({ vehicle }: { vehicle: VehicleDetail }) {
  const items = [
    { icon: Calendar, label: 'Ano', value: formatYears(vehicle.year_manufacture, vehicle.year_model) },
    { icon: Gauge, label: 'Quilometragem', value: formatMileage(vehicle.mileage) },
    { icon: null, label: 'Combustível', value: FUEL_LABELS[vehicle.fuel_type] },
    { icon: null, label: 'Câmbio', value: TRANSMISSION_LABELS[vehicle.transmission] },
    { icon: null, label: 'Categoria', value: BODY_LABELS[vehicle.body_type] },
    { icon: Palette, label: 'Cor', value: vehicle.color },
    { icon: null, label: 'Motor', value: vehicle.engine ?? '—' },
    { icon: null, label: 'Potência', value: vehicle.horsepower ? `${vehicle.horsepower} cv` : '—' },
    { icon: null, label: 'Portas', value: vehicle.doors ? String(vehicle.doors) : '—' },
    {
      icon: Users,
      label: 'Proprietários',
      value: vehicle.owners_count !== null ? String(vehicle.owners_count) : '—',
    },
    { icon: KeyRound, label: 'Chave reserva', value: vehicle.has_spare_key ? 'Sim' : 'Não' },
    { icon: null, label: 'Manual', value: vehicle.has_manual ? 'Sim' : 'Não' },
    { icon: MapPin, label: 'Localização', value: `${vehicle.city} — ${vehicle.state}` },
  ];

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-ink-950">Ficha técnica</h2>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {items.map(({ label, value }) => (
          <div key={label} className="border-b border-ink-100 pb-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dt>
            <dd className="mt-1 font-medium text-ink-900">{value}</dd>
          </div>
        ))}
      </dl>

      {vehicle.service_history && (
        <div className="mt-6 rounded-card bg-ink-50 p-5 ring-1 ring-ink-100">
          <h3 className="text-sm font-semibold text-ink-900">Histórico de revisões</h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-600">
            {vehicle.service_history}
          </p>
        </div>
      )}
    </section>
  );
}

function Features({ vehicle }: { vehicle: VehicleDetail }) {
  // Agrupa por categoria: 18 opcionais numa lista solta viram ruído. Separados em
  // Segurança, Conforto e Tecnologia, o comprador acha o que procura.
  const groups = new Map<string, string[]>();

  const CATEGORY_LABELS: Record<string, string> = {
    safety: 'Segurança',
    comfort: 'Conforto',
    technology: 'Tecnologia',
    performance: 'Desempenho',
    exterior: 'Exterior',
    interior: 'Interior',
  };

  for (const feature of vehicle.features) {
    const key = CATEGORY_LABELS[feature.category] ?? 'Outros';
    groups.set(key, [...(groups.get(key) ?? []), feature.name]);
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-ink-950">Itens de série e opcionais</h2>

      <div className="mt-4 space-y-5">
        {[...groups.entries()].map(([category, names]) => (
          <div key={category}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {category}
            </h3>
            <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {names.map((name) => (
                <li key={name} className="flex items-center gap-2.5 text-sm text-ink-700">
                  <Check className="size-4 shrink-0 text-success-600" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Dados estruturados para o Google.
 *
 * É o que torna o anúncio elegível a "rich result": o preço, a quilometragem e a
 * disponibilidade aparecem direto na página de busca, antes de o usuário clicar.
 * Num marketplace, isso muda a taxa de clique de forma mensurável.
 */
function JsonLd({ vehicle }: { vehicle: VehicleDetail }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: vehicle.title,
    description: vehicle.description ?? undefined,
    image: vehicle.images.map((image) => image.url),
    brand: { '@type': 'Brand', name: vehicle.brand_name },
    model: vehicle.model_name,
    vehicleModelDate: String(vehicle.year_model),
    productionDate: String(vehicle.year_manufacture),
    color: vehicle.color,
    numberOfDoors: vehicle.doors ?? undefined,
    fuelType: FUEL_LABELS[vehicle.fuel_type],
    vehicleTransmission: TRANSMISSION_LABELS[vehicle.transmission],
    bodyType: BODY_LABELS[vehicle.body_type],
    mileageFromOdometer: {
      '@type': 'QuantitativeValue',
      value: vehicle.mileage,
      unitCode: 'KMT',
    },
    offers: {
      '@type': 'Offer',
      price: vehicle.price,
      priceCurrency: 'BRL',
      availability:
        vehicle.status === 'sold'
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/InStock',
      url: `${siteUrl}/veiculos/${vehicle.slug}`,
      itemCondition: 'https://schema.org/UsedCondition',
    },
  };

  return (
    <script
      type="application/ld+json"
      // O escape de `<` impede que uma descrição contendo "</script>" feche a
      // tag e injete HTML na página — que seria XSS via dados do próprio anúncio.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
