import type { Metadata } from 'next';

import { ButtonLink } from '@/components/ui/button';
import { ArticleCard } from '@/features/articles/article-card';
import { listArticles, safely } from '@/lib/api';
import { ShinyButtonLink } from '@/components/ui/shiny-button';

export const metadata: Metadata = {
  title: 'Sobre nós',
  description:
    'Conheça a Giro Auto: seminovos selecionados, com procedência verificada, revisão completa e histórico transparente.',
};

export default async function SobrePage() {
  // `safely` porque a seção é acessória: se a API falhar, o institucional não
  // pode cair junto — ele existe mesmo sem artigo nenhum.
  const artigos = (await safely(listArticles(3)))?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-content text-3xl font-bold tracking-tight sm:text-4xl">
        Sobre a Giro Auto
      </h1>

      <p className="text-muted mt-6 text-lg leading-relaxed text-pretty">
        Comprar um seminovo costuma vir com uma dose de insegurança: o que aconteceu com esse
        carro antes de chegar aqui? Nós existimos para tirar essa dúvida da equação.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {[
          {
            title: 'Procedência verificada',
            text: 'Consultamos o histórico e emitimos laudo cautelar de todos os veículos antes de anunciá-los.',
          },
          {
            title: 'Revisão completa',
            text: 'Cada carro passa por um checklist técnico. O que precisa de reparo, é reparado antes da venda.',
          },
          {
            title: 'Transparência no anúncio',
            text: 'Quilometragem real, número de proprietários e histórico de manutenção. Tudo publicado.',
          },
          {
            title: 'Sem pressão',
            text: 'Agende uma visita, faça o test drive e leve o tempo que precisar. A decisão é sua.',
          },
        ].map(({ title, text }) => (
          // SEM ÍCONE E SEM CARTÃO.
          //
          // Os quatro itens são promessas independentes, não etapas — numerar
          // inventaria uma ordem que não existe. E ícone dentro de quadradinho,
          // quatro vezes numa grade, é o bloco que faz qualquer página parecer
          // gerada por ferramenta.
          //
          // Também não entra filete colorido no topo do cartão: é outro enfeite
          // do mesmo repertório. O que separa um item do outro é uma linha fina
          // e o que dá hierarquia é o peso do texto — com a tipografia certa,
          // isso basta.
          <div key={title} className="border-line border-t pt-5">
            <h2 className="text-content font-semibold">{title}</h2>
            <p className="text-muted mt-1.5 text-sm leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      {artigos.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-content text-xl font-bold tracking-tight">
                O que escrevemos
              </h2>
              <p className="text-faint mt-1 text-sm">Dicas de quem lida com carro todo dia.</p>
            </div>
            {/* `h-11` no celular pelo mesmo motivo do botão do topo: `sm` dá
                36px e o dedo erra. */}
            <ButtonLink
              href="/artigos"
              variant="secondary"
              size="sm"
              className="h-11 px-5 sm:h-9 sm:px-4"
            >
              Ver todos
            </ButtonLink>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {artigos.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 flex flex-wrap gap-3">
        <ShinyButtonLink href="/veiculos">Ver veículos disponíveis</ShinyButtonLink>
        <ButtonLink href="/contato" size="lg" variant="secondary">
          Falar com a gente
        </ButtonLink>
      </div>
    </div>
  );
}
