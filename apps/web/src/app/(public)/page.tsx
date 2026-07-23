import { Suspense } from 'react';
import { ArrowRight, BadgeCheck, ShieldCheck, Wrench } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { Hero } from '@/features/home/hero';
import { SearchFilters } from '@/features/vehicles/search-filters';
import { VehicleCard, VehicleCardSkeleton } from '@/features/vehicles/vehicle-card';
import { getFilterOptions, listFeaturedVehicles, listVehicles, safely } from '@/lib/api';

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
      {/* O hero busca o destaque e os filtros no servidor; o Suspense evita que
          a página inteira espere por essas consultas. */}
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>

      <Suspense fallback={<GridSkeleton title="Destaques" count={3} />}>
        <FeaturedSection />
      </Suspense>

      <Suspense fallback={<GridSkeleton title="Últimos anúncios" count={6} />}>
        <LatestSection />
      </Suspense>

      <TrustSection />
    </>
  );
}

async function HeroSection() {
  // O hero só depende dos filtros agora: o carro do topo virou um PNG recortado
  // e estático (ver o comentário em `hero.tsx`). `safely` porque uma queda da
  // API não pode derrubar a home — sem filtros o hero perde só a busca.
  const options = await safely(getFilterOptions());

  return (
    <Hero
      search={
        options ? (
          // Dentro do hero a busca não precisa da própria moldura — ela já está
          // numa. Um card dentro de outro card é ruído. Só o fundo semiopaco,
          // para o véu dourado do hero atravessar de leve.
          <SearchFilters options={options} compact className="bg-surface/60" />
        ) : null
      }
    />
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

      <div className="mt-12 flex justify-center">
        <ButtonLink href="/veiculos" variant="secondary" size="lg">
          Ver todo o estoque
          <ArrowRight className="size-4" />
        </ButtonLink>
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

function HeroSkeleton() {
  return (
    <section className="border-line bg-canvas border-b">
      {/* O esqueleto repete a MEDIDA do hero real — mesmo padding, mesmas
          colunas, mesma proporção do carro. Um placeholder de outro tamanho
          faria a página saltar quando o conteúdo chegasse: foi exatamente esse
          o CLS de 0,24 que a listagem acusou no Lighthouse. */}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
          <div className="space-y-5">
            <div className="bg-sunken h-6 w-52 animate-pulse rounded-full" />
            <div className="bg-sunken h-28 w-full animate-pulse rounded" />
            <div className="bg-sunken h-16 w-full animate-pulse rounded" />
            <div className="bg-sunken h-13 w-64 animate-pulse rounded-xl" />
          </div>
          <div className="bg-sunken aspect-[1500/639] w-full animate-pulse rounded-xl" />
        </div>

        <div className="border-line/70 mt-16 border-t pt-8 lg:mt-24">
          <div className="bg-sunken h-3 w-40 animate-pulse rounded-full" />
          <div className="rounded-card bg-surface mt-4 h-[5.5rem] animate-pulse sm:h-[4.75rem]" />
        </div>
      </div>
    </section>
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
