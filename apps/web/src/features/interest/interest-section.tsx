import { BellRing, Search, Sparkles } from 'lucide-react';

import { GradientBackdrop } from '@/components/ui/gradient-backdrop';
import { InterestForm } from '@/features/interest/interest-form';
import { getCatalog, safely } from '@/lib/api';

/**
 * "Não achou o que procurava?" — a seção entre o estoque e o "anuncie seu carro".
 *
 * A POSIÇÃO É O ARGUMENTO. Ela vem logo depois da vitrine porque é exatamente
 * ali que mora a pessoa a quem ela serve: quem rolou a grade inteira e não achou
 * nada com a cara dele. Antes do estoque seria absurdo (ninguém pede o que ainda
 * não procurou); depois do "anuncie seu carro" chegaria tarde, porque aquela
 * seção fala com quem VENDE e o visitante já teria entendido que a página
 * acabou para ele.
 *
 * Fundo BRANCO com o mesmo brilho azul da seção de baixo, na versão clara. Era
 * cinza (`bg-sunken`), e o cinza fazia o cartão branco do formulário quase
 * desaparecer — a diferença entre os dois é pequena demais para delimitar um do
 * outro. Com o fundo branco, quem delimita o cartão é a borda e a sombra, que é
 * o papel delas.
 *
 * As duas seções passam a compartilhar a mesma linguagem — brilho radial azul,
 * mesmo matiz — e se distinguem pela luminosidade: clara aqui, escura abaixo. A
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
    title: 'A gente procura por você',
    text: 'Seu perfil entra na nossa lista e cruzamos com cada carro que chega.',
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
    <section id="avise-me" className="bg-canvas relative isolate mt-16">
      <GradientBackdrop tone="light" />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-content text-2xl font-semibold tracking-tight sm:text-3xl">
              Não achou o que procurava?
            </h2>
            <p className="text-muted mt-3 max-w-md text-base leading-relaxed">
              O estoque gira toda semana. Diga qual carro você quer e a gente te avisa assim
              que aparecer um com o seu perfil.
            </p>

            <ul className="mt-10 space-y-6">
              {ARGUMENTOS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="rounded-btn bg-accent-soft text-accent flex size-10 shrink-0 items-center justify-center">
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

          {/* `ring-line-strong` e não `ring-line`: sobre o cinza que havia antes
              a borda fraca bastava para separar o cartão do fundo. Sobre o
              branco ela some, e passa a ser a borda que faz o cartão existir. */}
          <div className="rounded-card bg-canvas shadow-card ring-line-strong p-6 ring-1 sm:p-8">
            <InterestForm brands={brands} />
          </div>
        </div>
      </div>
    </section>
  );
}
