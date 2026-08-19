import { GradientBackdrop } from '@/components/ui/gradient-backdrop';
import { InterestForm } from '@/features/interest/interest-form';
import { getCatalog, safely } from '@/lib/api';

/**
 * "Quer saber antes de todo mundo?" — a seção entre o estoque e o "anuncie seu
 * carro".
 *
 * A POSIÇÃO É O ARGUMENTO. Ela vem logo depois da vitrine porque é exatamente
 * ali que mora a pessoa a quem ela serve: quem rolou a grade inteira e não achou
 * nada com a cara dele. Antes do estoque seria absurdo (ninguém pede o que ainda
 * não procurou); depois do "anuncie seu carro" chegaria tarde, porque aquela
 * seção fala com quem VENDE e o visitante já teria entendido que a página
 * acabou para ele.
 *
 * O TÍTULO NÃO MENCIONA A FALTA, e isso é decisão de produto. O primeiro texto
 * era "Não achou o que procurava?", que parte do princípio de que o estoque
 * falhou — a pessoa lê como "essa loja não tem carro". O enquadramento agora é o
 * benefício que a loja consegue mesmo entregar: ser avisado antes de o carro ir
 * para o site.
 *
 * ----------------------------------------------------------------------------
 * A COR DA SEÇÃO, E POR QUE ELA CHEGOU AQUI
 * ----------------------------------------------------------------------------
 * Base azul diluída (`accent-soft`), com degradê até um azul mais presente.
 *
 * As duas versões anteriores morriam pelo mesmo motivo: tudo ficava entre 93% e
 * 100% de luminosidade. Fundo cinza claro, cartão branco, azul pálido — nada
 * ancorava o olho, e a seção lia como sobra entre a vitrine branca acima e o
 * bloco preto abaixo, que são definidos.
 *
 * A base colorida é o que segura a seção agora que os ícones saíram. Quem quiser
 * clarear esse fundo precisa devolver contraste em outro lugar, senão o bloco
 * volta a sumir entre os vizinhos.
 *
 * A seção seguinte é preta, e duas escuras seguidas viram um bloco só. A
 * alternância clara → escura → rodapé claro é o que dá ritmo ao fim da página.
 */

const ARGUMENTOS = [
  {
    title: 'Diga o que procura',
    text: 'Marca, modelo e quanto quer gastar. Leva menos de um minuto.',
  },
  {
    title: 'Fica na nossa lista',
    // "A gente procura por você" era o título antes, e prometia demais: sugeria
    // que a loja sairia atrás daquele carro. O que o sistema faz é comparar cada
    // carro que ENTRA com os perfis cadastrados — o que já é útil, e é verdade.
    text: 'Cada carro que entra é comparado com o seu perfil. Você não precisa voltar aqui para conferir.',
  },
  {
    title: 'Você é avisado primeiro',
    text: 'Apareceu algo que combina, te chamamos no WhatsApp antes de anunciar.',
  },
];

export async function InterestSection() {
  // `safely` porque esta seção é acessória: se o catálogo falhar, a home inteira
  // não pode cair junto. Sem marcas não há formulário possível, então a seção
  // simplesmente não aparece — e o visitante nem percebe que faltou algo.
  const brands = await safely(getCatalog());
  if (!brands || brands.length === 0) return null;

  return (
    <section id="avise-me" className="bg-accent-soft relative isolate mt-16">
      <GradientBackdrop tone="light" />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            {/* MAIOR que "Nosso estoque" E MAIOR QUE O h1 DO TOPO (60px contra
                54,4px). As duas coisas são decisão, não descuido.

                "Nosso estoque" é placa: nomeia o que vem abaixo e sai de cena.
                Este título é a proposta em si — precisa convencer alguém a
                preencher um formulário, e disputa espaço com um cartão branco
                de 600px ao lado. A 30px ele perdia, e o bloco lia como legenda
                do formulário.

                Passar o h1 não gera conflito visual porque os dois nunca
                aparecem juntos: o topo ocupa a primeira tela inteira e esta
                seção fica lá embaixo. E o h1 tem uma foto sangrada ao lado
                fazendo o trabalho pesado; aqui o título é o peso todo.

                O peso (bold) vai junto com o tamanho: na condensada, largura
                estreita significa menos massa visual, então subir só o corpo
                não recuperava a presença. */}
            <h2 className="text-content text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Quer saber antes de todo mundo?
            </h2>
            <p className="text-muted mt-3 max-w-md text-base leading-relaxed">
              Diga qual carro você procura. Quando um com esse perfil entrar, você é o primeiro
              a saber.
            </p>

            {/* NUMERADO, e o número diz uma coisa verdadeira.
                Aqui os três itens são MESMO uma sequência: a pessoa diz o que
                procura, entra na lista, e é avisada. Numerar comunica que são
                três passos e que acabam — informação que ícone nenhum daria.

                É um `<ol>` de verdade, então a ordem chega a leitor de tela
                pela estrutura. O número visível fica `aria-hidden` para não ser
                anunciado duas vezes.

                O que havia aqui antes eram ícones dentro de quadradinhos azuis,
                três lado a lado. É o bloco padrão de landing page gerada por
                ferramenta — e um dos ícones era literalmente o de "sparkles",
                que virou o símbolo de "isto foi feito por IA". */}
            <ol className="mt-10 list-none">
              {ARGUMENTOS.map(({ title, text }, i) => (
                <li
                  key={title}
                  className="border-line flex gap-4 border-t py-5 first:border-t-0 first:pt-0"
                >
                  <span
                    aria-hidden
                    className="text-accent w-5 shrink-0 text-base font-bold tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-content font-semibold">{title}</p>
                    <p className="text-muted mt-1 max-w-sm text-sm leading-relaxed">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* O cartão branco sobre o cinza da seção: é o que separa o formulário
              do texto sem precisar de moldura. */}
          <div className="rounded-card bg-canvas shadow-card ring-line p-6 ring-1 sm:p-8">
            <InterestForm brands={brands} />
          </div>
        </div>
      </div>
    </section>
  );
}
