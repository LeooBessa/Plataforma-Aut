import type { Metadata } from 'next';

import { ArticleCard } from '@/features/articles/article-card';
import { listArticles, safely } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Artigos',
  description:
    'Dicas e comparativos para quem vai comprar ou vender um carro usado, escritos pela equipe da Giro Auto.',
};

/**
 * A listagem de artigos.
 *
 * Renderizada no servidor, com o texto no HTML: o motivo de um artigo existir
 * numa revenda é o Googlebot lê-lo sem executar JavaScript. Se o conteúdo só
 * aparecesse depois do JS, o esforço de escrever não viraria tráfego.
 */
export default async function ArtigosPage() {
  const page = await safely(listArticles(24));
  const artigos = page?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-content text-3xl font-bold tracking-tight sm:text-4xl">Artigos</h1>
        <p className="text-faint mt-2 max-w-2xl">
          Dicas e comparativos para quem vai comprar ou vender um carro usado.
        </p>
      </header>

      {artigos.length > 0 ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {artigos.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      ) : (
        <p className="text-muted rounded-card border-line-strong mt-10 border border-dashed p-12 text-center text-sm">
          Ainda não publicamos nenhum artigo. Em breve.
        </p>
      )}
    </div>
  );
}
