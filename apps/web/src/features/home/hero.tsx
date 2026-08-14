import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

import AnimatedTextCycle from '@/components/ui/animated-text-cycle';
import { ButtonLink } from '@/components/ui/button';
import { ShinyButtonLink } from '@/components/ui/shiny-button';

/** As palavras que giram no título. A ordem é a que aparece na tela. */
const QUALIDADES = ['Preço acessível.', 'Economia.', 'Qualidade.', 'Conforto.'];

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
 * carros do banco continuam logo abaixo, em "Nosso estoque".
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
              alt="SUV em destaque na vitrine da Giro Auto"
              fill
              sizes="58vw"
              // Maior elemento acima da dobra: quase certamente o LCP. No Next 16
              // `priority` está depreciado; a forma atual é esta.
              loading="eager"
              fetchPriority="high"
              className="object-cover object-center"
            />
            {/* SEM degradê na base, de propósito.
                Havia um branco→transparente aqui para suavizar o encontro da
                foto com a página. Ele fazia sentido quando a foto tinha base
                clara; sobre foto colorida, qualquer degradê para branco vira uma
                faixa leitosa — reduzir a altura só encolhe a névoa, não a
                elimina.
                O corte seco é coerente com a linguagem do bloco: a diagonal ao
                lado também é borda dura, e é ela que faz o hero parecer
                desenhado em vez de montado. */}
          </div>
        </div>

        {/* `items-center` centra o texto na vertical agora que a área é alta. */}
        <div className="relative mx-auto flex w-full max-w-7xl items-center px-4 py-10 sm:px-6 sm:py-20 lg:px-8">
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

                O `-translate-x-4` (16px) é AJUSTE ÓPTICO, e está separado de
                propósito. Centrado pela geometria a marca ainda lia como
                deslocada à direita — o texto é alinhado à esquerda e as linhas
                abaixo do título são mais curtas, então o peso visual do bloco
                fica à esquerda do centro que a matemática indica. Deixar o
                ajuste numa classe só, apartada da regra de centralização, é o
                que permite mexer nele sem tocar na lógica. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 -z-0 hidden w-full max-w-100 -translate-x-4 items-center justify-center lg:flex"
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
              {/* O `aria-label` fixa o nome acessível do título.
                  Sem ele, o h1 — que é o rótulo principal da página — mudaria de
                  texto a cada 3 segundos. Leitor de tela relê, controle por voz
                  perde a referência, e a página passa a não ter um nome estável.
                  Aqui o visitante vê a palavra girar e a tecnologia assistiva
                  ouve a frase inteira, uma vez. */}
              <h1
                aria-label="Carros para quem quer mais: preço acessível, economia, qualidade e conforto."
                className="text-content text-[2rem] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]"
              >
                Carros para quem quer mais
                {/* `animateWidth={false}`: a palavra está sozinha na linha, não
                    há texto depois dela para ser empurrado. Sem isso, o
                    componente renderiza todas as variações num bloco oculto para
                    medi-las — e esse bloco entra no texto do h1, deixando o
                    título da página com as quatro palavras concatenadas no DOM. */}
                <span className="text-accent mt-1 block">
                  <AnimatedTextCycle words={QUALIDADES} interval={3000} animateWidth={false} />
                </span>
              </h1>

              {/* FOTO no celular, LOGO APÓS O TÍTULO — e a ordem é o ponto.
                  Antes ela vinha depois do parágrafo e dos botões, e o conjunto
                  consumia ~500px numa tela de 664px: o carro caía abaixo da
                  dobra e o visitante via título, texto, dois botões e uma faixa
                  de azul vazio. Numa loja de carros, o carro não pode ser a
                  última coisa a aparecer.
                  Aqui a leitura vira promessa → carro → detalhes → ação.
                  16:9 e não 4:3 porque o veículo é de perfil: quadro largo
                  mostra mais carro ocupando menos altura, e altura é o recurso
                  escasso no celular.
                  SANGRA DE PONTA A PONTA: `-mx-4 sm:-mx-6` cancela exatamente o
                  respiro lateral do contêiner (`px-4 sm:px-6`), levando a foto até
                  as bordas da tela. Sem os cantos arredondados, porque cartão com
                  margem lê como "elemento na página" e sangria lê como "a página
                  é a foto" — que é o efeito que se quer num hero.
                  O `overflow-hidden` da <section> impede que isso gere rolagem
                  horizontal.
                  No desktop nada muda — lá a foto é o painel diagonal à direita
                  e este bloco fica oculto (`lg:hidden`). */}
              <div className="mt-8 -mx-4 overflow-hidden sm:-mx-6 lg:hidden">
                <Image
                  src="/hero-car.jpg"
                  alt="SUV em destaque na vitrine da Giro Auto"
                  width={1700}
                  height={2125}
                  loading="eager"
                  fetchPriority="high"
                  className="aspect-video w-full object-cover object-center"
                />
              </div>

              <p className="text-muted mx-auto mt-6 max-w-md text-base leading-relaxed text-pretty lg:mx-0">
                Boas oportunidades, carros selecionados e preços que fazem sentido para você.
                Confira nossos veículos e encontre uma opção que cabe no seu bolso.
              </p>

              <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
                <ShinyButtonLink href="/veiculos">
                  Ver Estoque
                  <ArrowRight className="size-4" />
                </ShinyButtonLink>
                <ButtonLink href="/contato" size="lg" variant="secondary">
                  Falar com a Equipe
                </ButtonLink>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
