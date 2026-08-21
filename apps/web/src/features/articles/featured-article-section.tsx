import { ArticleCard } from '@/features/articles/article-card';
import type { ArticleSummary } from '@/lib/api';

/**
 * O artigo em destaque, no FIM da home e SÓ NO CELULAR.
 *
 * No desktop ele vive no topo, ocupando o painel de imagem ao lado do texto da
 * marca — ali não custa nada, porque não empurra conteúdo nenhum para baixo.
 *
 * No celular tudo empilha, e ele tomava a primeira tela inteira: o estoque só
 * começava a 823px, uma tela abaixo do topo. Numa revenda, a primeira tela do
 * telefone tem de ser carro — é o que a pessoa veio ver, e é o que vende.
 *
 * Aqui embaixo ele encontra quem já passou pela vitrine e pelos dois
 * formulários. Menos gente chega, e é justamente essa a ordem de prioridade:
 * comprar, ser avisado, vender, ler.
 */
export function ArtigoEmDestaque({ artigo }: { artigo: ArticleSummary | null }) {
  if (!artigo) return null;

  return (
    <section className="bg-canvas lg:hidden">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-content text-2xl font-bold tracking-tight">
          Para ler antes de comprar
        </h2>
        <p className="text-muted mt-1.5 text-sm leading-relaxed">
          Dicas de quem lida com carro todo dia.
        </p>

        <div className="mt-6">
          <ArticleCard article={artigo} />
        </div>
      </div>
    </section>
  );
}
