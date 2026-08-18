import Image from 'next/image';
import type { Route } from 'next';
import Link from 'next/link';
import { Clock } from 'lucide-react';

import type { ArticleSummary } from '@/lib/api';

/** O cartão da listagem e da chamada na home. */
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
        <p className="text-faint mt-4 flex items-center gap-1.5 text-xs">
          <Clock className="size-3.5" />
          {article.reading_minutes} min de leitura
        </p>
      </div>
    </Link>
  );
}
