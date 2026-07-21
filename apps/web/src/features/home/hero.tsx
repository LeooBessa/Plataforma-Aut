import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Search, ShieldCheck } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import type { VehicleSummary } from '@/lib/api';
import { formatMileage, formatPrice, formatYears } from '@/lib/format';

/**
 * Hero da home — três colunas.
 *
 *   ESQUERDA: texto curto (a promessa da marca)
 *   CENTRO:   o logo ÂUREON
 *   DIREITA:  foto de um carro que está DE VERDADE no estoque
 *
 * A foto da direita não é uma imagem decorativa fixa: vem do veículo marcado
 * como destaque no painel. Isso significa que o topo do site sempre mostra um
 * carro real, disponível e clicável — e o dono da loja troca a vitrine sem
 * pedir nada a ninguém, só marcando outro destaque.
 *
 * A BUSCA VIVE AQUI DENTRO, e não numa seção própria logo abaixo.
 *
 * Solta, ela virava um card órfão: sem título, sem seção, e com a mesma moldura
 * dos cards de veículo — o olho a lia como "um card que perdeu o grupo dele".
 * Dentro do hero, ela é a AÇÃO da promessa que acabou de ser feita: leia o que
 * a loja oferece, agora procure. Compartilha o fundo, o brilho e a moldura.
 */
export function Hero({
  featured,
  search,
}: {
  featured: VehicleSummary | null;
  /** A busca, injetada pela home (que é quem sabe buscar os filtros). */
  search?: React.ReactNode;
}) {
  return (
    <section className="border-ink-800 bg-ink-950 relative overflow-hidden border-b">
      {/* Brilho dourado difuso ao fundo — dá profundidade ao preto sem competir
          com o logo. Dois focos, um quente e um frio, para o preto não ficar
          chapado. */}
      <div
        aria-hidden
        className="bg-brand-600/10 absolute -top-32 left-1/2 size-[42rem] -translate-x-1/2 rounded-full blur-[120px]"
      />
      <div
        aria-hidden
        className="bg-brand-700/10 absolute -right-20 -bottom-40 size-[32rem] rounded-full blur-[100px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-12">
          {/* ---------------------------------------------------- ESQUERDA */}
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <p className="border-brand-600/30 bg-brand-600/10 text-brand-300 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <BadgeCheck className="size-3.5" />
              Procedência verificada
            </p>

            <h1 className="text-silver-100 mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              O extraordinário
              <span className="text-gold-gradient mt-1 block">ao seu alcance</span>
            </h1>

            <p className="text-silver-400 mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-pretty lg:mx-0">
              Seleção criteriosa de seminovos premium. Cada veículo com histórico verificado,
              revisão completa e a transparência que a compra de um carro merece.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <ButtonLink href="/veiculos" size="lg">
                Ver coleção
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/contato" size="lg" variant="secondary">
                Falar com consultor
              </ButtonLink>
            </div>
          </div>

          {/* ------------------------------------------------------- CENTRO */}
          <div className="order-1 flex justify-center lg:order-2">
            <Image
              src="/aureon-logo.png"
              alt="ÂUREON — conecta você ao extraordinário"
              width={420}
              height={420}
              // É o maior elemento acima da dobra: quase certamente o LCP.
              // No Next 16 `priority` está depreciado; a forma atual é esta.
              loading="eager"
              fetchPriority="high"
              // O PNG já tem transparência real (o fundo do arquivo original era
              // rgb(2,2,2), quase preto — e desenhava um retângulo visível sobre
              // o brilho dourado do hero). Com o alfa embutido, o logo funciona
              // em qualquer fundo, inclusive no preview de link do WhatsApp.
              className="w-56 max-w-full sm:w-72 lg:w-[19rem] xl:w-[21rem]"
            />
          </div>

          {/* ----------------------------------------------------- DIREITA */}
          <div className="order-3 lg:order-3">
            {featured ? <FeaturedCar vehicle={featured} /> : <CarPlaceholder />}
          </div>
        </div>

        {/* ------------------------------------------------------- BUSCA */}
        {search && (
          <div className="border-ink-800/70 mt-12 border-t pt-8 lg:mt-16">
            <p className="text-silver-500 mb-4 flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <Search className="text-brand-500 size-3.5" />
              Busque no estoque
              {/* O filete dourado é o mesmo elemento que fecha os títulos das
                  seções abaixo. Repeti-lo aqui é o que costura a busca ao
                  resto da página em vez de deixá-la boiando. */}
              <span
                aria-hidden
                className="from-brand-500/50 h-px flex-1 bg-gradient-to-r to-transparent"
              />
            </p>
            {search}
          </div>
        )}
      </div>
    </section>
  );
}

/** O carro em destaque, com a foto em alta e os dados essenciais. */
function FeaturedCar({ vehicle }: { vehicle: VehicleSummary }) {
  const cover = vehicle.cover_image;

  return (
    <Link
      href={`/veiculos/${vehicle.slug}`}
      className="group rounded-card border-ink-800 bg-ink-900 hover:border-brand-600/50 hover:shadow-gold relative block overflow-hidden border transition-all duration-500"
    >
      <div className="bg-ink-900 relative aspect-[4/3] overflow-hidden">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt_text ?? vehicle.title}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            loading="eager"
            fetchPriority="high"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.05] motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="text-silver-500 flex h-full items-center justify-center text-sm">
            Sem foto
          </div>
        )}

        {/* Degradê na base: garante que o texto por cima seja legível
            independentemente de a foto ser clara ou escura ali embaixo. */}
        <div
          aria-hidden
          className="from-ink-950 via-ink-950/70 absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent"
        />

        <span className="border-brand-500/40 bg-ink-950/80 text-brand-300 absolute top-4 left-4 rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur">
          Destaque
        </span>

        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-silver-100 text-sm font-medium">{vehicle.title}</p>
          <p className="text-silver-400 mt-0.5 text-xs">
            {formatYears(vehicle.year_manufacture, vehicle.year_model)} ·{' '}
            {formatMileage(vehicle.mileage)}
          </p>
          <p className="text-gold-gradient mt-2.5 text-2xl font-semibold tracking-tight">
            {formatPrice(vehicle.price)}
          </p>
        </div>
      </div>
    </Link>
  );
}

/** Sem destaque cadastrado: um cartão sóbrio, nunca um buraco na página. */
function CarPlaceholder() {
  return (
    <div className="rounded-card border-ink-700 bg-ink-900/60 flex aspect-[4/3] flex-col items-center justify-center border border-dashed p-8 text-center">
      <ShieldCheck className="text-brand-600/60 size-8" />
      <p className="text-silver-300 mt-4 text-sm font-medium">Vitrine em preparação</p>
      <p className="text-silver-500 mt-1 text-xs">
        Marque um veículo como destaque no painel para exibi-lo aqui.
      </p>
    </div>
  );
}
