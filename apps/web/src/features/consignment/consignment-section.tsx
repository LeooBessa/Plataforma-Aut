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
    title: 'Você define o preço',
    text: 'Diga quanto quer pelo carro. A gente avalia e conversa a partir daí.',
  },
  {
    title: 'Sem burocracia',
    text: 'Nada de cadastro. Preencha os dados do carro e a gente te chama no WhatsApp.',
  },
  {
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
            {/* Mesmo tamanho do título da lista de espera, e pelo mesmo motivo:
                as duas seções são propostas que precisam convencer, não placas
                que nomeiam. Manter as duas iguais entre si é o que faz a
                diferença em relação a "Nosso estoque" ler como decisão. */}
            <h2 className="text-on-inverse text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Quer vender seu carro?
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-white/60">
              Anunciamos ele para você. Preencha os dados abaixo e a nossa equipe entra em
              contato pelo WhatsApp.
            </p>

            {/* SEM MARCADOR NENHUM, e isso é diferente da seção de cima de
                propósito.

                Lá os três itens são uma sequência, e por isso são numerados.
                Aqui são três afirmações independentes — "você define o preço"
                não vem antes nem depois de "sem burocracia". Numerar inventaria
                uma ordem que não existe, e ícone em quadradinho era justamente
                o enfeite que fazia a seção parecer gerada por ferramenta.

                O que separa um item do outro é um filete, e o que dá hierarquia
                é o peso do texto. Com a tipografia certa isso basta. */}
            <ul className="mt-10">
              {ARGUMENTOS.map(({ title, text }) => (
                <li
                  key={title}
                  className="border-t border-white/10 py-5 first:border-t-0 first:pt-0"
                >
                  <p className="text-on-inverse font-semibold">{title}</p>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-white/55">{text}</p>
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
