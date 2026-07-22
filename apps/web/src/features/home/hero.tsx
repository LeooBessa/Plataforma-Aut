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
    <section className="border-line bg-canvas relative overflow-hidden border-b">
      {/* Um véu dourado bem diluído no topo — tira o branco chapado sem virar
          "fundo colorido". Percebe-se como luz, não como cor. */}
      <div
        aria-hidden
        className="from-brand-50 absolute inset-x-0 top-0 h-80 bg-gradient-to-b to-transparent"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-12">
          {/* ---------------------------------------------------- ESQUERDA */}
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <p className="border-accent/30 bg-accent-soft text-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <BadgeCheck className="size-3.5" />
              Procedência verificada
            </p>

            <h1 className="text-content mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              O extraordinário
              {/* `text-accent` (dourado escuro), e não o degradê metálico: o
                  brilho quase branco do meio do degradê some no fundo claro.
                  Este tom passa em contraste e continua sendo ouro. */}
              <span className="text-accent mt-1 block">ao seu alcance</span>
            </h1>

            <p className="text-muted mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-pretty lg:mx-0">
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
          {/* Sem painel: o logo agora é a versão para fundo claro, com a
              palavra em preto. Ele fica solto no branco, que é o acabamento
              limpo — o painel preto existia só para salvar a versão anterior,
              cuja palavra era branca e sumia no papel. */}
          <div className="order-1 flex justify-center lg:order-2">
            <Image
              src="/aureon-logo.png"
              alt="ÂUREON — conecta você ao extraordinário"
              // As medidas reais do arquivo, já aparado. Declarar a proporção
              // certa é o que reserva o espaço exato antes de a imagem chegar —
              // sem isso a página salta quando ela carrega.
              width={900}
              height={581}
              // É o maior elemento acima da dobra: quase certamente o LCP.
              // No Next 16 `priority` está depreciado; a forma atual é esta.
              loading="eager"
              fetchPriority="high"
              className="w-60 max-w-full sm:w-72 lg:w-[17.5rem] xl:w-[20rem]"
            />
          </div>

          {/* ----------------------------------------------------- DIREITA */}
          <div className="order-3 lg:order-3">
            {featured ? <FeaturedCar vehicle={featured} /> : <CarPlaceholder />}
          </div>
        </div>

        {/* ------------------------------------------------------- BUSCA */}
        {search && (
          <div className="border-line/70 mt-12 border-t pt-8 lg:mt-16">
            <p className="text-faint mb-4 flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase">
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
      className="group rounded-card border-line bg-surface shadow-card hover:shadow-card-hover relative block overflow-hidden border transition-all duration-500"
    >
      <div className="bg-sunken relative aspect-[4/3] overflow-hidden">
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
          <div className="text-faint flex h-full items-center justify-center text-sm">
            Sem foto
          </div>
        )}

        {/* Degradê na base: garante que o texto por cima seja legível
            independentemente de a foto ser clara ou escura ali embaixo. */}
        <div
          aria-hidden
          className="from-ink-950 via-ink-950/70 absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent"
        />

        <span className="border-brand-500/40 bg-canvas/80 text-accent absolute top-4 left-4 rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur">
          Destaque
        </span>

        {/* Texto CLARO, e não os papéis do tema: aqui o fundo não é a página,
            é o degradê escuro sobre a foto. `text-content` (preto) sumiria. */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-sm font-medium text-white">{vehicle.title}</p>
          <p className="mt-0.5 text-xs text-white/65">
            {formatYears(vehicle.year_manufacture, vehicle.year_model)} ·{' '}
            {formatMileage(vehicle.mileage)}
          </p>
          {/* O degradê metálico volta a funcionar: estamos sobre o escuro. */}
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
    <div className="rounded-card border-line-strong bg-surface/60 flex aspect-[4/3] flex-col items-center justify-center border border-dashed p-8 text-center">
      <ShieldCheck className="text-brand-600/60 size-8" />
      <p className="text-muted mt-4 text-sm font-medium">Vitrine em preparação</p>
      <p className="text-faint mt-1 text-xs">
        Marque um veículo como destaque no painel para exibi-lo aqui.
      </p>
    </div>
  );
}
