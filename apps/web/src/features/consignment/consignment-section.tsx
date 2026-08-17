import { BadgeCheck, HandCoins, Timer } from 'lucide-react';

import { GradientBackdrop } from '@/components/ui/gradient-backdrop';
import { ConsignmentForm } from '@/features/consignment/consignment-form';

/**
 * "Anuncie seu carro" — a seção entre o estoque e o rodapé.
 *
 * Está DEPOIS do estoque de propósito. Quem chega no site quer comprar; só
 * depois de rolar a grade inteira é que o visitante que tem um carro para
 * vender se reconhece. Colocá-la antes competiria com a vitrine, que é o que
 * traz a maioria.
 *
 * Fundo escuro para separar do estoque sem precisar de linha divisória — e
 * porque o preto é um dos três papéis da paleta, então a seção lê como parte da
 * marca, não como um bloco colado.
 *
 * O preto não é chapado: o `GradientBackdrop` acende um azul da marca nas quinas
 * de baixo. Além de tirar a monotonia do bloco, ele faz a passagem para o rodapé
 * branco acontecer por uma cor da paleta, e não por um corte seco de preto para
 * branco.
 *
 * SEM `mt`, e isso é obrigatório agora. A margem existia quando a seção vinha
 * logo depois do estoque, que é branco — o vão ficava branco sobre branco e
 * ninguém via. Com a lista de espera (cinza) no meio, a mesma margem passou a
 * desenhar uma faixa BRANCA entre o cinza e o preto, exatamente o defeito que o
 * rodapé já teve. O respiro daqui para cima é dado pelo `py` da seção anterior.
 */

const ARGUMENTOS = [
  {
    icon: HandCoins,
    title: 'Você define o preço',
    text: 'Diga quanto quer pelo carro. A gente avalia e conversa a partir daí.',
  },
  {
    icon: Timer,
    title: 'Sem burocracia',
    text: 'Nada de cadastro. Preencha os dados do carro e a gente te chama no WhatsApp.',
  },
  {
    icon: BadgeCheck,
    title: 'Anunciamos por você',
    text: 'Seu carro entra no nosso estoque e aparece para quem já está procurando.',
  },
];

export function ConsignmentSection() {
  return (
    <section id="anuncie" className="bg-inverse relative isolate">
      <GradientBackdrop />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        {/* COLUNAS INVERTIDAS em relação à seção de cima (lista de espera), que
            tem texto à esquerda e formulário à direita. Duas seções seguidas com
            o mesmo esqueleto fazem a segunda parecer repetição da primeira;
            alternando, cada uma volta a ler como bloco próprio.

            A inversão é só do `lg` para cima, e por CSS (`order`), não mexendo na
            ordem do HTML. No celular as colunas empilham, e ali a sequência certa
            é argumento ANTES do formulário — ninguém preenche um formulário antes
            de saber para quê. Manter o HTML nessa ordem também preserva a leitura
            de quem usa leitor de tela, que segue o documento e não o CSS. */}
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="lg:order-2">
            <h2 className="text-on-inverse text-2xl font-semibold tracking-tight sm:text-3xl">
              Quer vender seu carro?
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-white/60">
              Anunciamos ele para você. Preencha os dados abaixo e a nossa equipe entra em
              contato pelo WhatsApp.
            </p>

            <ul className="mt-10 space-y-6">
              {ARGUMENTOS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="rounded-btn bg-brand-600/15 text-brand-400 flex size-10 shrink-0 items-center justify-center">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-on-inverse text-sm font-semibold">{title}</p>
                    <p className="mt-1 max-w-xs text-sm leading-relaxed text-white/55">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* O formulário volta ao fundo CLARO.
              O resto da seção é escuro, mas campo de formulário sobre preto pede
              um tema de input inteiro só para ele — e o site tem um só, feito
              para fundo branco. Um cartão claro aqui resolve sem duplicar
              sistema, e de quebra destaca a ação. */}
          <div className="rounded-card bg-canvas p-6 sm:p-8 lg:order-1">
            <ConsignmentForm />
          </div>
        </div>
      </div>
    </section>
  );
}
