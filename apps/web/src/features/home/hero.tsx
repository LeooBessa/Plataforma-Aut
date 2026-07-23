import Image from 'next/image';
import { ArrowRight, Search } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';

/**
 * Hero da home.
 *
 *   ESQUERDA: a promessa da marca, com o monograma como marca d'água atrás
 *   DIREITA:  uma foto GRANDE do carro, dissolvida na página
 *   RODAPÉ:   a busca no estoque
 *
 * ----------------------------------------------------------------------------
 * A FOTO É USADA INTEIRA, NÃO RECORTADA
 * ----------------------------------------------------------------------------
 *
 * As versões anteriores recortavam o carro do fundo e o deixavam flutuando.
 * Recorte sempre deixa borda — e, por mais limpo que fosse, o carro pousado
 * sobre a página engolia a marca d'água e parecia adesivo colado.
 *
 * Aqui a foto entra INTEIRA. O fundo dourado dela é o próprio visual — e é a
 * cor da ÂUREON, então a imagem já pertence à página. O que a integra não é um
 * recorte, é uma MÁSCARA: a borda esquerda da foto desvanece para transparente
 * (`mask-image`), revelando o branco da página por baixo. Sem linha dura, sem
 * serrilhado — a foto "derrete" na página em vez de ser uma caixa colada.
 *
 * O carro é ESTÁTICO (é uma foto de vitrine, não um veículo do estoque). Os
 * destaques do banco continuam logo abaixo, na "Seleção da casa".
 */
export function Hero({ search }: { search?: React.ReactNode }) {
  return (
    <section className="border-line bg-canvas relative overflow-hidden border-b">
      {/* -------------------------------------------------- ÁREA SUPERIOR */}
      <div className="relative">
        {/* FOTO — painel à direita, sangrando até a borda da tela.
            A transição branco→dourado é um CORTE DIAGONAL reto (clip-path), não
            mais um desvanecer largo — era essa faixa borrada que incomodava. Um
            fio dourado fino corre na diagonal, para o corte parecer proposital.
            Só no desktop; no celular a foto vira um bloco normal, mais abaixo.

            Como funciona o fio: dois planos com a MESMA diagonal, o da foto
            deslocado 2,5px à direita do plano dourado de trás. O que sobra do
            dourado nesses 2,5px, ao longo da diagonal, é a linha. Fica preso à
            geometria, então acompanha qualquer tamanho de tela sozinho. */}
        <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[58%] lg:block">
          <div
            className="from-brand-300 to-brand-600 absolute inset-0 bg-gradient-to-b"
            style={{ clipPath: 'polygon(24% 0, 100% 0, 100% 100%, 5% 100%)' }}
          />
          <div
            className="absolute inset-0"
            style={{ clipPath: 'polygon(calc(24% + 2.5px) 0, 100% 0, 100% 100%, calc(5% + 2.5px) 100%)' }}
          >
            <Image
              src="/hero-car.jpg"
              alt="Porsche 911 — vitrine ÂUREON"
              fill
              sizes="58vw"
              // Maior elemento acima da dobra: quase certamente o LCP. No Next 16
              // `priority` está depreciado; a forma atual é esta.
              loading="eager"
              fetchPriority="high"
              className="object-cover object-[center_62%]"
            />
            {/* Fade curto só na base: suaviza o encontro com a busca, sem a
                faixa larga que incomodava na lateral. */}
            <div className="from-canvas absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t to-transparent" />
          </div>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
          {/* Bloco de texto: no desktop ocupa a metade esquerda; a foto cuida
              da direita. */}
          <div className="relative text-center lg:w-[50%] lg:text-left">
            {/* MARCA D'ÁGUA — o monograma atrás do texto, INTEIRO e visível.
                Fica na esquerda, onde a foto não alcança: era isso que faltava,
                o carro cobria o logo. Só o símbolo, não o logo com texto —
                texto apagado continua sendo lido como texto e disputa com o
                título; um símbolo vira textura. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 left-1/2 -z-0 hidden -translate-x-1/2 lg:left-[42%] lg:block"
            >
              <Image
                src="/aureon-marca.png"
                alt=""
                width={779}
                height={337}
                loading="eager"
                className="w-[34rem] max-w-none opacity-[0.08]"
              />
            </div>

            <div className="relative">
              <h1 className="text-content text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
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

            {/* FOTO no celular — bloco normal, cantos arredondados. */}
            <div className="rounded-card mt-12 overflow-hidden lg:hidden">
              <Image
                src="/hero-car.jpg"
                alt="Porsche 911 — vitrine ÂUREON"
                width={1700}
                height={2125}
                loading="eager"
                fetchPriority="high"
                className="aspect-[4/3] w-full object-cover object-[center_60%]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- BUSCA */}
      {search && (
        <div className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
          <div className="border-line/70 border-t pt-8">
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
        </div>
      )}
    </section>
  );
}
