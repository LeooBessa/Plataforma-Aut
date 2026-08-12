import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';

/**
 * Hero da home.
 *
 *   ESQUERDA: a promessa da marca, com o monograma como marca d'água atrás
 *   DIREITA:  uma foto GRANDE do carro, dissolvida na página
 *
 * ----------------------------------------------------------------------------
 * A FOTO É USADA INTEIRA, NÃO RECORTADA
 * ----------------------------------------------------------------------------
 *
 * As versões anteriores recortavam o carro do fundo e o deixavam flutuando.
 * Recorte sempre deixa borda — e, por mais limpo que fosse, o carro pousado
 * sobre a página engolia a marca d'água e parecia adesivo colado.
 *
 * Aqui a foto entra INTEIRA. O fundo azul dela é o próprio visual — e é a
 * cor da Giro Auto, então a imagem já pertence à página. O que a integra não é um
 * recorte, é uma MÁSCARA: a borda esquerda da foto desvanece para transparente
 * (`mask-image`), revelando o branco da página por baixo. Sem linha dura, sem
 * serrilhado — a foto "derrete" na página em vez de ser uma caixa colada.
 *
 * O carro é ESTÁTICO (é uma foto de vitrine, não um veículo do estoque). Os
 * destaques do banco continuam logo abaixo, na "Seleção da casa".
 *
 * ----------------------------------------------------------------------------
 * A DOBRA: só o hero na primeira tela
 * ----------------------------------------------------------------------------
 *
 * O hero ocupa a tela inteira (`100svh` menos a navbar), sem nada embaixo. Ao
 * abrir o site, o visitante vê apenas o carro e a promessa. O convite para o
 * estoque vem logo abaixo da dobra, como um bloco de destaque próprio (na home).
 */
export function Hero() {
  return (
    <section className="bg-canvas relative overflow-hidden">
      {/* ------ HERO — ocupa a tela inteira (menos a navbar) ------ */}
      <div className="relative flex lg:min-h-[calc(100svh-4rem)]">
        {/* FOTO — painel à direita, sangrando até a borda da tela.
            A transição branco→azul é um CORTE DIAGONAL reto (clip-path), não
            mais um desvanecer largo — era essa faixa borrada que incomodava. Um
            fio azul fino corre na diagonal, para o corte parecer proposital.
            Só no desktop; no celular a foto vira um bloco normal, mais abaixo.

            Como funciona o fio: dois planos com a MESMA diagonal, o da foto
            deslocado 2,5px à direita do plano azul de trás. O que sobra do
            azul nesses 2,5px, ao longo da diagonal, é a linha. Fica preso à
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
              alt="Porsche 911 — vitrine Giro Auto"
              fill
              sizes="58vw"
              // Maior elemento acima da dobra: quase certamente o LCP. No Next 16
              // `priority` está depreciado; a forma atual é esta.
              loading="eager"
              fetchPriority="high"
              className="object-cover object-[center_62%]"
            />
            {/* Fade curto na base: a foto encontra o branco da página sem uma
                linha dura embaixo. */}
            <div className="from-canvas absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t to-transparent" />
          </div>
        </div>

        {/* `items-center` centra o texto na vertical agora que a área é alta. */}
        <div className="relative mx-auto flex w-full max-w-7xl items-center px-4 py-20 sm:px-6 lg:px-8">
          {/* Bloco de texto: no desktop ocupa a metade esquerda; a foto cuida
              da direita. */}
          <div className="relative w-full text-center lg:w-[50%] lg:text-left">
            {/* MARCA D'ÁGUA — o monograma atrás do texto, INTEIRO e visível.
                Fica na esquerda, onde a foto não alcança: era isso que faltava,
                o carro cobria o logo. Só o símbolo, não o logo com texto —
                texto apagado continua sendo lido como texto e disputa com o
                título; um símbolo vira textura. */}
            {/* CENTRADA NA FRASE, não na caixa que a contém.
                Esta distinção é o que estava errado. A caixa do h1 ocupa os 608px
                da coluna, mas o texto só chega a ~404px — centrar na caixa jogava
                o símbolo ~109px à direita da frase, e era visível.
                A solução não é um deslocamento chutado: este contêiner recebe a
                largura MEDIDA do título (404px no navegador, arredondado para
                `max-w-100` = 400px) e centra a imagem dentro dela. Assim a marca
                acompanha a coluna de texto, e não a largura sobrando ao lado.
                `inset-y-0` + `items-center` cuidam do eixo vertical.

                Por que não `max-w-md` (448px), que é a medida do parágrafo:
                sobravam 22px à direita, e dava para ver. O título é a âncora
                visual aqui, não o parágrafo.

                O `-translate-x-6` (24px) é AJUSTE ÓPTICO, e está separado de
                propósito. Centrado pela geometria a marca ainda lia como
                deslocada à direita — o texto é alinhado à esquerda e as linhas
                abaixo do título são mais curtas, então o peso visual do bloco
                fica à esquerda do centro que a matemática indica. Deixar o
                ajuste numa classe só, apartada da regra de centralização, é o
                que permite mexer nele sem tocar na lógica. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 -z-0 hidden w-full max-w-100 -translate-x-6 items-center justify-center lg:flex"
            >
              {/* 18rem (288px). A marca anterior era horizontal e ocupava 34rem;
                  esta é quase quadrada, então a mesma largura viraria uma mancha
                  muito maior e competiria com o título em vez de servir de
                  textura. Marca d'água que se faz notar deixou de ser marca
                  d'água. */}
              <Image
                src="/giro-auto-logo.png"
                alt=""
                width={497}
                height={512}
                loading="eager"
                className="w-72 max-w-none opacity-[0.08]"
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
                alt="Porsche 911 — vitrine Giro Auto"
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
    </section>
  );
}
