import { BellRing, Search, Sparkles } from 'lucide-react';

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
 * Base azul diluída (`accent-soft`), degradê até um azul mais presente, ícones em
 * azul CHEIO com glifo branco.
 *
 * As duas versões anteriores morriam pelo mesmo motivo: tudo ficava entre 93% e
 * 100% de luminosidade. Fundo cinza claro, cartão branco, azul pálido — nada
 * ancorava o olho, e a seção lia como sobra entre a vitrine branca acima e o
 * bloco preto abaixo, que são definidos.
 *
 * Base colorida e ícone sólido dependem UM DO OUTRO. Testei separado: com a base
 * azulada e o chip pálido de antes, os ícones se dissolvem no fundo e a seção
 * fica pior do que era. Quem mexer numa das duas precisa mexer na outra.
 *
 * A seção seguinte é preta, e duas escuras seguidas viram um bloco só. A
 * alternância clara → escura → rodapé claro é o que dá ritmo ao fim da página.
 */

const ARGUMENTOS = [
  {
    icon: Search,
    title: 'Diga o que procura',
    text: 'Marca, modelo e quanto quer gastar. Leva menos de um minuto.',
  },
  {
    icon: Sparkles,
    title: 'Fica na nossa lista',
    // "A gente procura por você" era o título antes, e prometia demais: sugeria
    // que a loja sairia atrás daquele carro. O que o sistema faz é comparar cada
    // carro que ENTRA com os perfis cadastrados — o que já é útil, e é verdade.
    text: 'Cada carro que entra é comparado com o seu perfil. Você não precisa voltar aqui para conferir.',
  },
  {
    icon: BellRing,
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
            {/* MAIOR que "Nosso estoque", e isso é hierarquia, não descuido.
                "Nosso estoque" é placa: nomeia o que vem abaixo e sai de cena.
                Este título é a proposta em si — ele tem de convencer alguém a
                preencher um formulário. Do lado de um cartão branco de 600px,
                a 30px ele perdia a disputa e o bloco lia como legenda.
                O peso vai junto com o tamanho: na condensada, largura estreita
                significa menos massa visual, então subir só o corpo não bastava. */}
            <h2 className="text-content text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Quer saber antes de todo mundo?
            </h2>
            <p className="text-muted mt-3 max-w-md text-base leading-relaxed">
              Diga qual carro você procura. Quando um com esse perfil entrar, você é o
              primeiro a saber.
            </p>

            <ul className="mt-10 space-y-6">
              {ARGUMENTOS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  {/* AZUL CHEIO, não o azul diluído do resto do site.
                      Com a base da seção azulada, o chip pálido que havia antes
                      se dissolvia no fundo — os ícones sumiam. As duas coisas
                      dependem uma da outra: base colorida exige ícone sólido. */}
                  <span className="rounded-btn bg-brand-600 flex size-10 shrink-0 items-center justify-center text-white">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-content text-sm font-semibold">{title}</p>
                    <p className="text-muted mt-1 max-w-xs text-sm leading-relaxed">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
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
