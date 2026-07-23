import Image from 'next/image';
import { ArrowRight, BadgeCheck, Search } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';

/**
 * Hero da home.
 *
 *   FUNDO:     o monograma do logo, grande e apagado, como marca d'água
 *   ESQUERDA:  a promessa da marca, em texto curto
 *   DIREITA:   um carro RECORTADO do fundo, pousado sobre a página
 *   RODAPÉ:    a busca no estoque
 *
 * ----------------------------------------------------------------------------
 * O CARRO É UM PNG RECORTADO, NÃO A FOTO CRUA
 * ----------------------------------------------------------------------------
 *
 * Uma foto retangular traz sempre o fundo dela junto — o pátio, a parede, o céu.
 * Solta numa página clara, essa moldura brigaria com a marca d'água atrás e o
 * hero viraria uma colagem. Recortado, o carro pousa sobre a página; uma sombra
 * elíptica embaixo dá o chão.
 *
 * O recorte é feito por `scripts/recortar-carro.swift` (Vision do macOS, offline).
 * A NITIDEZ DA BORDA depende do contraste da foto original: carro claro sobre
 * fundo escuro de estúdio recorta com borda limpa; carro no meio de um pátio
 * cheio recorta com a borda serrilhada. Por isso a foto do hero é de estúdio.
 *
 * O carro do topo é ESTÁTICO (o Vision só roda no macOS, a API roda em Linux na
 * Vercel — não dá para recortar no upload). Trocar a vitrine exige rodar o
 * script com outra foto; o passo a passo está em `scripts/README.md`. Os
 * destaques do banco continuam logo abaixo, na "Seleção da casa".
 */
export function Hero({ search }: { search?: React.ReactNode }) {
  return (
    <section className="border-line bg-canvas relative overflow-hidden border-b">
      {/* Véu dourado no topo: tira o branco chapado sem virar fundo colorido. */}
      <div
        aria-hidden
        className="from-brand-50 absolute inset-x-0 top-0 h-[30rem] bg-gradient-to-b to-transparent"
      />

      {/* MARCA D'ÁGUA — o monograma atrás de tudo.
          Fica no bloco ESQUERDO/CENTRAL (inset-right deixa livre a faixa da
          direita, onde entra o carro). Assim ela aparece INTEIRA: o carro não a
          cobre, que era a reclamação da versão anterior. Só o símbolo, não o
          logo com texto — texto apagado continua sendo lido como texto e
          disputaria com o título; um símbolo vira textura. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 right-[34%] hidden items-center justify-center lg:flex"
      >
        <Image
          src="/aureon-marca.png"
          alt=""
          width={779}
          height={337}
          loading="eager"
          className="w-[min(80%,40rem)] max-w-none opacity-[0.09]"
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-6">
          {/* ---------------------------------------------------- ESQUERDA */}
          <div className="text-center lg:text-left">
            <p className="border-accent/30 bg-accent-soft text-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <BadgeCheck className="size-3.5" />
              Procedência verificada
            </p>

            <h1 className="text-content mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
              O extraordinário
              <span className="text-accent mt-1 block">ao seu alcance</span>
            </h1>

            <p className="text-muted mx-auto mt-6 max-w-md text-base leading-relaxed text-pretty lg:mx-0">
              Seleção criteriosa de seminovos premium. Cada veículo com histórico verificado,
              revisão completa e a transparência que a compra de um carro merece.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
              <ButtonLink href="/veiculos" size="lg">
                Ver coleção
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/contato" size="lg" variant="secondary">
                Falar com consultor
              </ButtonLink>
            </div>
          </div>

          {/* ----------------------------------------------------- DIREITA */}
          <div className="relative">
            {/* A sombra dá CHÃO ao carro. Sem ela, um recorte pousado numa
                página clara parece adesivo colado — o olho não acha onde ele se
                apoia. Elíptica e difusa, imita o que a carroceria projetaria. */}
            <div
              aria-hidden
              className="absolute inset-x-[10%] bottom-[8%] h-8 rounded-[50%] bg-black/20 blur-2xl sm:h-10"
            />
            <Image
              src="/carro-hero.png"
              alt="Genesis GV60 — um dos seminovos premium do nosso estoque"
              width={1500}
              height={639}
              // Maior elemento acima da dobra: quase certamente o LCP. No Next 16
              // `priority` está depreciado; a forma atual é esta.
              loading="eager"
              fetchPriority="high"
              className="relative w-full drop-shadow-xl"
            />
          </div>
        </div>

        {/* ------------------------------------------------------- BUSCA */}
        {search && (
          <div className="border-line/70 relative mt-16 border-t pt-8 lg:mt-24">
            <p className="text-faint mb-4 flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <Search className="text-brand-500 size-3.5" />
              Busque no estoque
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
