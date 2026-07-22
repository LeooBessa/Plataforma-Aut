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
              <h2 className="text-content text-lg font-bold">Descrição</h2>
              {/* Texto puro, renderizado pelo JSX — que escapa tudo por padrão.
                  Nada de dangerouslySetInnerHTML: aceitar HTML aqui abriria XSS
                  armazenado, e o admin é justamente quem tem mais poder de
                  causar dano se a conta dele for comprometida. */}
              <p className="text-muted mt-3 leading-relaxed whitespace-pre-line">
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
          <div className="rounded-card shadow-card ring-line bg-surface p-6 ring-1">
            <div className="flex flex-wrap items-center gap-2">
              {vehicle.is_featured && !isSold && <Badge tone="dark">Destaque</Badge>}
              {vehicle.status === 'reserved' && <Badge tone="warning">Reservado</Badge>}
              {isSold && <Badge tone="neutral">Vendido</Badge>}
            </div>

            <h1 className="text-content mt-3 text-2xl font-bold tracking-tight">
              {vehicle.title}
            </h1>

            <p className="text-faint mt-1 text-sm">
              {formatYears(vehicle.year_manufacture, vehicle.year_model)} ·{' '}
              {formatMileage(vehicle.mileage)}
            </p>

            {/* O preço em dourado é o mesmo tratamento que ele recebe no card e
                no destaque da home: o olho aprende, num site inteiro, que o
                dourado é o valor. */}
            <p className="text-accent mt-5 text-3xl font-bold tracking-tight">
              {formatPrice(vehicle.price)}
            </p>

            {vehicle.accepts_financing && vehicle.estimated_installment && (
              <div className="rounded-btn bg-accent-soft mt-4 p-4">
                <p className="text-accent text-sm">
                  <strong className="font-semibold">
                    {vehicle.installments_count}x de{' '}
                    {formatPrice(vehicle.estimated_installment)}
                  </strong>
                </p>
                {vehicle.down_payment && (
                  <p className="text-accent mt-0.5 text-xs">
                    com entrada de {formatPrice(vehicle.down_payment)}
                  </p>
                )}
                {/* A parcela NÃO inclui juros — e dizemos isso. Apresentar uma
                    parcela "com juros" inventada pela plataforma seria informação
                    financeira enganosa. */}
                <p className="text-accent/70 mt-2 text-xs">
                  Simulação sem juros. Condições reais na aprovação do banco.
                </p>
              </div>
            )}

            <div className="mt-6">
              {isSold ? (
                <div className="rounded-btn bg-sunken p-4 text-center">
                  <p className="text-muted text-sm font-medium">
                    Este veículo já foi vendido.
                  </p>
                  <Link
                    href="/veiculos"
                    className="text-accent hover:text-accent mt-1 inline-block text-sm font-semibold"
                  >
                    Ver veículos parecidos
                  </Link>
                </div>
              ) : (
                <VehicleActions slug={vehicle.slug} title={vehicle.title} />
              )}
            </div>

            <ul className="border-line mt-6 space-y-2 border-t pt-5 text-sm">
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
    <li className="text-muted flex items-center gap-2.5">
      {/* Dourado, não verde: estes itens são ATRIBUTOS do anúncio, não uma
          confirmação de que algo deu certo. O verde é reservado para feedback
          de sucesso — usá-lo aqui diluiria o significado dele. */}
      <Check className="text-brand-500 size-4 shrink-0" />
      {children}
    </li>
  );
}

function Breadcrumbs({ title }: { title: string }) {
  return (
    // O breadcrumb serve ao usuário e ao Google: ele aparece no resultado da
    // busca e ajuda o rastreador a entender a hierarquia do site.
    <nav
      aria-label="Você está aqui"
      className="text-faint flex items-center gap-1.5 text-sm"
    >
      <Link href="/" className="hover:text-content transition-colors">
        Home
      </Link>
      <ChevronRight className="size-3.5" />
      <Link href="/veiculos" className="hover:text-content transition-colors">
        Veículos
      </Link>
      <ChevronRight className="size-3.5" />
      <span className="text-content truncate">{title}</span>
    </nav>
  );
}

function Specs({ vehicle }: { vehicle: VehicleDetail }) {
  const items = [
    {
      icon: Calendar,
      label: 'Ano',
      value: formatYears(vehicle.year_manufacture, vehicle.year_model),
    },
    { icon: Gauge, label: 'Quilometragem', value: formatMileage(vehicle.mileage) },
    { icon: null, label: 'Combustível', value: FUEL_LABELS[vehicle.fuel_type] },
    { icon: null, label: 'Câmbio', value: TRANSMISSION_LABELS[vehicle.transmission] },
    { icon: null, label: 'Categoria', value: BODY_LABELS[vehicle.body_type] },
    { icon: Palette, label: 'Cor', value: vehicle.color },
    { icon: null, label: 'Motor', value: vehicle.engine ?? '—' },
    {
      icon: null,
      label: 'Potência',
      value: vehicle.horsepower ? `${vehicle.horsepower} cv` : '—',
    },
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
      <h2 className="text-content text-lg font-bold">Ficha técnica</h2>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {items.map(({ label, value }) => (
          <div key={label} className="border-line border-b pb-3">
            <dt className="text-muted text-xs font-medium tracking-wide uppercase">
              {label}
            </dt>
            <dd className="text-content mt-1 font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {vehicle.service_history && (
        <div className="rounded-card bg-surface ring-line mt-6 p-5 ring-1">
          <h3 className="text-content text-sm font-semibold">Histórico de revisões</h3>
          <p className="text-muted mt-1.5 text-sm leading-relaxed whitespace-pre-line">
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
      <h2 className="text-content text-lg font-bold">Itens de série e opcionais</h2>

      <div className="mt-4 space-y-5">
        {[...groups.entries()].map(([category, names]) => (
          <div key={category}>
            <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
              {category}
            </h3>
            <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {names.map((name) => (
                <li key={name} className="text-muted flex items-center gap-2.5 text-sm">
                  <Check className="text-brand-500 size-4 shrink-0" />
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
        vehicle.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
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
