import Image from 'next/image';
import { ArrowRight, BadgeCheck, Search } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';

/**
 * Hero da home.
 *
 *   FUNDO:     o logo, grande e apagado, centralizado atrás de tudo
 *   ESQUERDA:  a promessa da marca, em texto curto
 *   DIREITA:   um carro RECORTADO, sem moldura, pousado sobre o fundo
 *   RODAPÉ:    a busca no estoque
 *
 * ----------------------------------------------------------------------------
 * POR QUE O CARRO É UM PNG RECORTADO, E NÃO A FOTO DO ANÚNCIO
 * ----------------------------------------------------------------------------
 *
 * Uma foto retangular sempre traz junto o fundo dela — o pátio, a parede, o céu
 * do dia em que foi tirada. Dentro de um card isso funciona; solta no meio de
 * uma página branca, a moldura da foto brigaria com o logo atrás e o hero
 * viraria uma colagem.
 *
 * Recortado, o carro pousa sobre o fundo: uma sombra elíptica embaixo dá o
 * chão, e nada mais separa ele da página.
 *
 * O recorte é feito por `scripts/recortar-carro.swift`, que usa o Vision do
 * próprio macOS — o mesmo motor do "remover fundo" do Preview. Roda offline: a
 * foto do cliente não sai da máquina.
 *
 * O PREÇO DISSO: o carro do topo virou ESTÁTICO. Antes ele seguia o veículo
 * marcado como destaque no painel e mudava sozinho; agora, trocar a vitrine
 * exige rodar o script com outra foto. É deliberado — o Vision só existe no
 * macOS, e a API roda em Linux na Vercel, então não há como recortar no upload.
 * Os destaques continuam aparecendo logo abaixo, na "Seleção da casa".
 */
export function Hero({ search }: { search?: React.ReactNode }) {
  return (
    <section className="border-line bg-canvas relative overflow-hidden border-b">
      {/* Véu dourado no topo: tira o branco chapado sem virar fundo colorido. */}
      <div
        aria-hidden
        className="from-brand-50 absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b to-transparent"
      />

      {/* MARCA D'ÁGUA — o logo atrás de tudo.
          `opacity` bem baixa de propósito: ele é textura, não informação. O nome
          da loja já está na navbar e no rodapé, então apagá-lo aqui não custa
          nada — e deixa o texto por cima continuar legível. */}
      {/* Só o MONOGRAMA, não o logo inteiro. Texto apagado continua sendo lido
          como texto: a palavra "ÂUREON" gigante ao fundo disputava a leitura
          com o título, e a tagline virava uma segunda linha de texto fantasma.
          Um símbolo, não. Vira textura — que é o papel de uma marca d'água.

          Preso ao TOPO e não centralizado na seção: centralizado, ele descia
          até a barra de busca e aparecia por trás dos campos, cujo fundo é
          semitransparente. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 flex h-[62%] items-center justify-center"
      >
        <Image
          src="/aureon-marca.png"
          alt=""
          width={779}
          height={337}
          loading="eager"
          className="w-[min(105%,58rem)] max-w-none opacity-[0.08]"
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
          {/* ---------------------------------------------------- ESQUERDA */}
          <div className="text-center lg:text-left">
            <p className="border-accent/30 bg-accent-soft text-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <BadgeCheck className="size-3.5" />
              Procedência verificada
            </p>

            <h1 className="text-content mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
              O extraordinário
              {/* `text-accent` (dourado escuro), e não o degradê metálico: o
                  brilho quase branco do meio do degradê some no fundo claro. */}
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
            {/* A sombra é o que dá CHÃO ao carro. Sem ela, um recorte pousado
                numa página branca parece adesivo colado — o olho não encontra
                onde o objeto se apoia. Elíptica e bem difusa, imita o que a
                carroceria projetaria no piso. */}
            <div
              aria-hidden
              className="absolute inset-x-[8%] bottom-[6%] h-8 rounded-[50%] bg-black/25 blur-2xl sm:h-12"
            />
            <Image
              src="/carro-hero.png"
              alt="Toyota Corolla XEi 2.0 Flex — um dos seminovos do nosso estoque"
              width={775}
              height={383}
              // Maior elemento acima da dobra: quase certamente o LCP. No Next 16
              // `priority` está depreciado; a forma atual é esta.
              loading="eager"
              fetchPriority="high"
              className="relative w-full drop-shadow-2xl"
            />
          </div>
        </div>

        {/* ------------------------------------------------------- BUSCA */}
        {search && (
          <div className="border-line/70 mt-16 border-t pt-8 lg:mt-24">
            <p className="text-faint mb-4 flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <Search className="text-brand-500 size-3.5" />
              Busque no estoque
              {/* O mesmo filete dourado que fecha os títulos das seções abaixo:
                  é o que costura a busca ao resto da página. */}
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
