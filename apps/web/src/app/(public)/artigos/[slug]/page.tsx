import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock } from 'lucide-react';

import { ShinyButtonLink } from '@/components/ui/shiny-button';
import { ArticleCard } from '@/features/articles/article-card';
import { Markdown } from '@/features/articles/markdown';
import { getArticle, safely, type Article } from '@/lib/api';
import { formatDate } from '@/lib/format';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dados = await safely(getArticle(slug));
  if (!dados) return { title: 'Artigo' };

  const { article } = dados;
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      images: article.cover_url ? [article.cover_url] : undefined,
      publishedTime: article.published_at ?? undefined,
    },
  };
}

/**
 * A página do artigo.
 *
 * ----------------------------------------------------------------------------
 * O CORPO VEM EM MARKDOWN E VIRA COMPONENTE, NUNCA HTML
 * ----------------------------------------------------------------------------
 * Ver `features/articles/markdown.tsx`. Em resumo: renderizar HTML vindo do
 * banco seria XSS armazenado esperando acontecer, e quem escreve é o admin —
 * justamente a conta cujo comprometimento causa mais dano.
 *
 * ----------------------------------------------------------------------------
 * TERMINA CHAMANDO PARA O ESTOQUE
 * ----------------------------------------------------------------------------
 * Quem leu um texto inteiro sobre comprar seminovo está a um passo de olhar
 * carro. Um artigo que acaba sem porta de saída gasta a atenção conquistada.
 */
export default async function ArtigoPage({ params }: Props) {
  const { slug } = await params;
  const dados = await safely(getArticle(slug));
  if (!dados) notFound();

  const { article, related } = dados;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <DadosEstruturados article={article} />

      <nav className="text-faint text-sm">
        <Link href="/artigos" className="hover:text-accent transition-colors">
          Artigos
        </Link>
      </nav>

      <h1 className="text-content mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {article.title}
      </h1>

      <div className="text-faint mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {article.published_at && <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>}
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {article.reading_minutes} min de leitura
        </span>
      </div>

      {article.cover_url && (
        <div className="rounded-card bg-sunken relative mt-8 aspect-video overflow-hidden">
          <Image
            src={article.cover_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 768px, 100vw"
            loading="eager"
            fetchPriority="high"
            className="object-cover"
          />
        </div>
      )}

      <p className="text-content mt-8 text-lg leading-relaxed">{article.excerpt}</p>

      <div className="mt-2">
        <Markdown>{article.body}</Markdown>
      </div>

      {article.faq.length > 0 && (
        <section className="mt-14">
          <h2 className="text-content text-xl font-bold tracking-tight">Perguntas frequentes</h2>
          <dl className="mt-5 space-y-5">
            {article.faq.map((item) => (
              <div key={item.question} className="rounded-card bg-surface ring-line p-5 ring-1">
                <dt className="text-content font-semibold">{item.question}</dt>
                <dd className="text-muted mt-1.5 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="rounded-card border-accent/30 bg-brand-600/6 mt-14 border p-8 text-center">
        <h2 className="text-content text-xl font-bold">Procurando um carro?</h2>
        <p className="text-muted mt-2 text-sm">
          Veja o que está no nosso estoque agora e agende uma visita pelo site.
        </p>
        <ShinyButtonLink href="/veiculos" className="mt-6">
          Ver estoque
        </ShinyButtonLink>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-content text-lg font-bold tracking-tight">Leia também</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

/**
 * Os dados estruturados do artigo.
 *
 * Sem isto o campo de perguntas frequentes do painel seria só um bloco a mais
 * no fim da página. Com ele, o Google pode mostrar as perguntas expandidas
 * direto no resultado da busca — que é a razão inteira de a loja se dar ao
 * trabalho de preenchê-las.
 *
 * São dois esquemas numa lista só: `Article` descreve o texto, `FAQPage`
 * descreve as perguntas. O `FAQPage` só entra se houver pergunta; declarar um
 * `FAQPage` vazio é erro de validação no Search Console.
 */
function DadosEstruturados({ article }: { article: Article }) {
  const artigo = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    image: article.cover_url ?? undefined,
    datePublished: article.published_at ?? undefined,
    dateModified: article.updated_at,
    author: { '@type': 'Organization', name: 'Giro Auto' },
    publisher: { '@type': 'Organization', name: 'Giro Auto' },
  };

  const perguntas = article.faq.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: article.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      }
    : null;

  const dados = perguntas ? [artigo, perguntas] : [artigo];

  return (
    <script
      type="application/ld+json"
      // O escape de `<` impede que um texto contendo "</script>" feche a tag e
      // injete HTML — seria XSS pelo conteúdo que o próprio painel publica.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, '\\u003c') }}
    />
  );
}
