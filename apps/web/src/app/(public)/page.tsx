import { Suspense } from 'react';
import { ArrowRight, BadgeCheck, Search, ShieldCheck, Wrench } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { Hero } from '@/features/home/hero';
import { VehicleCard, VehicleCardSkeleton } from '@/features/vehicles/vehicle-card';
import { listFeaturedVehicles, listVehicles, safely } from '@/lib/api';

/**
 * Home.
 *
 * Server Component: os veículos vêm no HTML. O Googlebot lê os carros, os preços
 * e os links sem executar JavaScript — e o visitante vê conteúdo já no primeiro
 * frame, em vez de um esqueleto girando.
 */

// ISR: servida estática, regenerada a cada 5 min. Quando o admin publica ou
// edita um anúncio, a revalidação por tag atualiza a home em segundos.
export const revalidate = 300;

export default function HomePage() {
  return (
    <>
      {/* O hero é estático (foto de vitrine + texto), sem dado de API — por isso
          entra direto, sem Suspense. */}
      <Hero />

      {/* Logo abaixo da dobra: o convite CHAMATIVO para o estoque, no lugar onde
          antes ficava a busca. */}
      <EstoqueCTA />

      <Suspense fallback={<GridSkeleton title="Seleção da casa" count={3} />}>
        <FeaturedSection />
      </Suspense>

      <Suspense fallback={<GridSkeleton title="No estoque" count={6} />}>
        <LatestSection />
      </Suspense>

      <TrustSection />
    </>
  );
}

/**
 * O convite para o estoque.
 *
 * Um bloco PRETO com botão DOURADO. Sobre a página clara, o preto salta e o
 * dourado grita "clique aqui" — é o único lugar da home onde o dourado vira
 * botão inteiro (em todo o resto ele é só detalhe), justamente porque aqui ele
 * TEM de chamar atenção. A busca completa (marca, preço, ano, câmbio) mora na
 * página de estoque, para onde este botão leva.
 */
function EstoqueCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20 lg:px-8">
      <div className="rounded-card bg-inverse relative overflow-hidden px-6 py-12 text-center sm:px-14 sm:py-16">
        {/* Brilho dourado difuso ao fundo — dá profundidade ao preto. */}
        <div
          aria-hidden
          className="bg-brand-500/15 pointer-events-none absolute -top-1/3 left-1/2 size-[36rem] -translate-x-1/2 rounded-full blur-[120px]"
        />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center">
          <p className="text-brand-400 flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] uppercase">
            <Search className="size-3.5" />
            Explore o estoque
          </p>
          <h2 className="text-on-inverse mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Todo o estoque, num só lugar
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/65 text-pretty">
            Filtre por marca, preço, ano, câmbio e cidade — e encontre o carro certo em segundos.
          </p>
          <ButtonLink
            href="/veiculos"
            size="lg"
            className="from-brand-400 to-brand-600 text-ink-950 shadow-gold mt-8 bg-gradient-to-b font-semibold hover:from-brand-300 hover:to-brand-500"
          >
            Ver todo o estoque
            <ArrowRight className="size-4" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

async function FeaturedSection() {
  const vehicles = await safely(listFeaturedVehicles(3));
  if (!vehicles || vehicles.length === 0) return null;

  return (
    <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeader
        title="Seleção da casa"
        subtitle="Escolhidos a dedo pela nossa equipe"
        href="/veiculos?featured=true"
      />

      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    </section>
  );
}

async function LatestSection() {
  const page = await safely(listVehicles({ sort: 'newest', page_size: 6 }));

  // Falha da API e catálogo vazio são coisas DIFERENTES, e a mensagem precisa
  // ser diferente. Dizer "nenhum veículo disponível" quando a API caiu esconde
  // a falha atrás de uma tela plausível — e ninguém vai investigar.
  if (!page) {
    return (
      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-card border-line-strong border border-dashed py-16 text-center">
          <p className="text-content font-medium">Não foi possível carregar os veículos.</p>
          <p className="text-faint mt-1 text-sm">
            Estamos com uma instabilidade momentânea. Tente novamente em instantes.
          </p>
        </div>
      </section>
    );
  }

  if (page.items.length === 0) {
    return (
      <section className="mx-auto mt-16 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-faint">Nenhum veículo disponível no momento.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeader
        title="No estoque"
        subtitle={`${page.meta.total} ${page.meta.total === 1 ? 'veículo disponível' : 'veículos disponíveis'}`}
        href="/veiculos"
      />

      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {page.items.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    </section>
  );
}

function TrustSection() {
  const items = [
    {
      icon: ShieldCheck,
      title: 'Procedência verificada',
      text: 'Histórico consultado e laudo cautelar em todos os veículos do estoque.',
    },
    {
      icon: Wrench,
      title: 'Revisão completa',
      text: 'Cada carro passa por checklist técnico antes de ser anunciado.',
    },
    {
      icon: BadgeCheck,
      title: 'Transparência total',
      text: 'Quilometragem, número de donos e manutenções — tudo no anúncio.',
    },
  ];

  return (
    <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-card border-line bg-surface/50 grid gap-8 border p-8 sm:grid-cols-3 sm:p-12">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <span className="rounded-btn border-accent/30 bg-accent-soft text-accent flex size-11 items-center justify-center border">
              <Icon className="size-5" />
            </span>
            <h3 className="text-content mt-4 font-medium">{title}</h3>
            <p className="text-muted mt-1.5 text-sm leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href: '/veiculos' | '/veiculos?featured=true';
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-content text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {/* Filete dourado sob o título — o detalhe que amarra a identidade. */}
        <div
          aria-hidden
          className="from-brand-500 mt-2 h-px w-16 bg-gradient-to-r to-transparent"
        />
        <p className="text-faint mt-2.5 text-sm">{subtitle}</p>
      </div>
      <a
        href={href}
        className="text-accent hover:text-accent hidden shrink-0 items-center gap-1 text-sm font-medium transition-colors sm:flex"
      >
        Ver todos
        <ArrowRight className="size-4" />
      </a>
    </div>
  );
}

function GridSkeleton({ title, count }: { title: string; count: number }) {
  return (
    <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
      <h2 className="text-content text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <VehicleCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
