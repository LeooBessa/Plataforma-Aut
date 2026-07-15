import { Suspense } from 'react';
import { ArrowRight, BadgeCheck, ShieldCheck, Wrench } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
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

// ISR: a página é servida estática e regenerada a cada 5 minutos. Uma visita não
// espera pelo banco; e quando o admin publica um anúncio, disparamos a
// revalidação por tag (Fase 7) e a home atualiza em segundos.
export const revalidate = 300;

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Cada seção tem seu próprio Suspense. Assim o banner aparece
          instantaneamente e as listas chegam quando chegarem — em vez de a
          página inteira esperar pela consulta mais lenta. */}
      <Suspense fallback={<SearchSkeleton />}>
        <SearchSection />
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

function Hero() {
  return (
    <section className="bg-ink-950 relative overflow-hidden">
      {/* Brilho azul difuso ao fundo — dá profundidade sem competir com o texto. */}
      <div
        aria-hidden
        className="bg-brand-600/25 absolute -top-40 -right-40 size-[36rem] rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-brand-500/10 absolute -bottom-32 -left-32 size-[28rem] rounded-full blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-brand-200 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15 ring-inset">
            <BadgeCheck className="size-3.5" />
            Procedência verificada
          </p>

          {/* `text-balance` distribui as palavras entre as linhas do título em vez
              de deixar uma palavra órfã na última — detalhe pequeno que separa
              um site cuidado de um genérico. */}
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
            O carro certo, sem <span className="text-brand-400">surpresa nenhuma</span>.
          </h1>

          <p className="text-ink-300 mt-6 max-w-xl text-lg leading-relaxed text-pretty">
            Seminovos selecionados, revisados e com histórico transparente. Escolha o seu,
            agende uma visita e faça o test drive.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/veiculos" size="lg">
              Ver veículos
              <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink
              href="/contato"
              size="lg"
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
            >
              Falar com um consultor
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

async function SearchSection() {
  const options = await safely(getFilterOptions());

  // Sem as opções, o formulário de busca não tem o que oferecer. Some, em vez de
  // aparecer vazio e quebrado.
  if (!options) return null;

  return (
    // `relative z-10` é OBRIGATÓRIO, não estético.
    //
    // O banner acima é `position: relative`. Na ordem de pintura do CSS,
    // elementos posicionados são desenhados DEPOIS dos estáticos — então o banner
    // cobriria a metade de cima deste card, mesmo vindo antes no HTML. O bug
    // aparece exatamente porque a busca "invade" o banner com margem negativa.
    //
    // Só apareceu ao olhar a página renderizada: nenhum teste de unidade,
    // nenhum type-check e nenhum lint pegaria isto.
    <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* A margem negativa põe a busca na dobra, sem o usuário precisar rolar —
          é o elemento mais importante da home. */}
      <div className="-mt-10 lg:-mt-12">
        <SearchFilters options={options} compact />
      </div>
    </section>
  );
}

async function FeaturedSection() {
  const vehicles = await safely(listFeaturedVehicles(3));

  if (!vehicles || vehicles.length === 0) return null;

  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeader
        title="Destaques da semana"
        subtitle="Selecionados pela nossa equipe"
        href="/veiculos?featured=true"
      />

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle, index) => (
          // Só os 3 primeiros carregam com prioridade: são os que aparecem na
          // dobra e definem o LCP. Marcar todos como prioritários faria o
          // navegador competir consigo mesmo e pioraria o tempo de carregamento.
          <VehicleCard key={vehicle.id} vehicle={vehicle} priority={index < 3} />
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
        <div className="rounded-card border-ink-200 border border-dashed py-16 text-center">
          <p className="text-ink-900 font-medium">Não foi possível carregar os veículos.</p>
          <p className="text-ink-500 mt-1 text-sm">
            Estamos com uma instabilidade momentânea. Tente novamente em instantes.
          </p>
        </div>
      </section>
    );
  }

  if (page.items.length === 0) {
    return (
      <section className="mx-auto mt-16 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-ink-500">Nenhum veículo disponível no momento.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeader
        title="Últimos anúncios"
        subtitle={`${page.meta.total} ${page.meta.total === 1 ? 'veículo disponível' : 'veículos disponíveis'}`}
        href="/veiculos"
      />

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {page.items.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <ButtonLink href="/veiculos" variant="secondary" size="lg">
          Ver todos os veículos
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
    <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-card bg-ink-50 ring-ink-100 grid gap-6 p-8 ring-1 sm:grid-cols-3 sm:p-10">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <span className="rounded-btn text-brand-600 ring-ink-100 flex size-11 items-center justify-center bg-white shadow-sm ring-1">
              <Icon className="size-5" />
            </span>
            <h3 className="text-ink-900 mt-4 font-semibold">{title}</h3>
            <p className="text-ink-600 mt-1.5 text-sm leading-relaxed">{text}</p>
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
        <h2 className="text-ink-950 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="text-ink-500 mt-1 text-sm">{subtitle}</p>
      </div>
      <a
        href={href}
        className="text-brand-600 hover:text-brand-700 hidden shrink-0 items-center gap-1 text-sm font-semibold sm:flex"
      >
        Ver todos
        <ArrowRight className="size-4" />
      </a>
    </div>
  );
}

function SearchSkeleton() {
  return (
    // Mesmo `z-10` do componente real: senão o esqueleto também sumiria atrás
    // do banner, e a tela "piscaria" ao trocar um pelo outro.
    <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-card shadow-card -mt-10 h-24 animate-pulse bg-white lg:-mt-12" />
    </section>
  );
}

function GridSkeleton({ title, count }: { title: string; count: number }) {
  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <h2 className="text-ink-950 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <VehicleCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
