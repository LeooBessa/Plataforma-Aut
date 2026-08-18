'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

import { ArticleForm } from '@/features/articles/article-form';
import type { Article } from '@/lib/api';
import { errorMessage, http } from '@/lib/http';

export default function EditarArtigoPage() {
  const { id } = useParams<{ id: string }>();
  const [artigo, setArtigo] = useState<Article | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    http
      .get<Article>(`/admin/articles/${id}`)
      .then(({ data }) => { if (!cancelado) setArtigo(data); })
      .catch((e) => { if (!cancelado) setErro(errorMessage(e)); });
    return () => { cancelado = true; };
  }, [id]);

  if (erro) {
    return (
      <div role="alert" className="rounded-btn bg-danger-500/10 text-danger-700 flex items-start gap-2.5 p-3.5 text-sm">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {erro}
      </div>
    );
  }

  if (!artigo) return <div className="rounded-card bg-sunken h-96 animate-pulse" />;

  return (
    <div>
      <h1 className="text-content text-2xl font-bold tracking-tight">Editar artigo</h1>
      {/* O endereço não muda ao editar o título: link já compartilhado
          continuaria funcionando, e o Google não perde o que indexou. */}
      <p className="text-muted mt-1 mb-6 text-sm">
        Endereço: <code className="bg-sunken rounded px-1 text-xs">/artigos/{artigo.slug}</code>
      </p>
      <ArticleForm article={artigo} />
    </div>
  );
}
