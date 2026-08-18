import Image from 'next/image';
import type { Route } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';

import type { ArticleSummary } from '@/lib/api';

/**
 * O cartão da listagem, da seção Sobre e do "leia também".
 *
 * O cartão inteiro é o link, e mesmo assim existe um "Ler artigo" visível no
 * pé. Não é redundância: cartão clicável não anuncia que é clicável, e sem o
 * botão a única pista é o cursor mudar — que no celular não existe. É o mesmo
 * rótulo que aparece na tarja do artigo em destaque, no topo do site, para que
 * "Ler artigo" signifique a mesma coisa em qualquer lugar da página.
 *
 * Ele é um `<span>`, não um segundo link: um link dentro de outro é HTML
 * inválido, e o leitor de tela anunciaria o mesmo destino duas vezes.
 */
export function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <Link
      href={`/artigos/${article.slug}` as Route}
      className="rounded-card ring-line bg-surface shadow-card hover:shadow-card-hover group flex flex-col overflow-hidden ring-1 transition-shadow"
    >
      <div className="bg-sunken relative aspect-video overflow-hidden">
        {article.cover_url ? (
          <Image
            src={article.cover_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 380px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="text-faint absolute inset-0 flex items-center justify-center text-sm">
            Sem capa
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-content font-semibold tracking-tight text-balance">{article.title}</h3>
        <p className="text-muted mt-2 line-clamp-3 text-sm leading-relaxed">{article.excerpt}</p>

        {/* `mt-auto` empurra o pé para baixo: numa grade, cartões com resumos de
            tamanhos diferentes teriam o botão em alturas diferentes, e a fileira
            pareceria desalinhada. */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className="text-faint flex items-center gap-1.5 text-xs">
            <Clock className="size-3.5" />
            {article.reading_minutes} min de leitura
          </p>
          <span className="text-accent group-hover:text-brand-800 flex items-center gap-1.5 text-sm font-semibold transition-colors">
            Ler artigo
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
