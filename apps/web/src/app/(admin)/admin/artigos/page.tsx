'use client';

import { useEffect, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { AlertCircle, FileText, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import type { ArticlePage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { errorMessage, http } from '@/lib/http';

export default function AdminArtigosPage() {
  const [page, setPage] = useState<ArticlePage | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [apagando, setApagando] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    http
      .get<ArticlePage>('/admin/articles')
      .then(({ data }) => {
        if (!cancelado) { setPage(data); setErro(null); }
      })
      .catch((e) => { if (!cancelado) setErro(errorMessage(e)); });
    return () => { cancelado = true; };
  }, [versao]);

  const excluir = async (id: string, titulo: string) => {
    // Excluir apaga a capa do Storage junto e não tem volta. Um clique errado
    // aqui custa o texto inteiro.
    if (!window.confirm(`Excluir "${titulo}"? Não dá para desfazer.`)) return;
    setApagando(id);
    try {
      await http.delete(`/admin/articles/${id}`);
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setApagando(null);
    }
  };

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-content text-2xl font-bold tracking-tight">Artigos</h1>
          <p className="text-muted mt-1 text-sm">
            O conteúdo que aparece em /artigos e traz visitante pela busca do Google.
          </p>
        </div>
        <ButtonLink href="/admin/artigos/novo">
          <Plus className="size-4" />
          Novo artigo
        </ButtonLink>
      </header>

      {erro && (
        <div role="alert" className="rounded-btn bg-danger-500/10 text-danger-700 mt-5 flex items-start gap-2.5 p-3.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {page?.items.map((a) => (
          <article key={a.id} className="rounded-card bg-surface ring-line p-5 ring-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-content font-semibold">{a.title}</h2>
                  <Badge tone={a.status === 'published' ? 'success' : 'warning'}>
                    {a.status === 'published' ? 'Publicado' : 'Rascunho'}
                  </Badge>
                </div>
                <p className="text-muted mt-1 line-clamp-2 text-sm">{a.excerpt}</p>
                <p className="text-faint mt-2 text-xs">
                  {a.reading_minutes} min de leitura
                  {a.published_at ? ` · publicado em ${formatDate(a.published_at)}` : ''}
                </p>
              </div>
            </div>

            <div className="border-line mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              {/* O cast é o mesmo que a paginação usa: o `typedRoutes` só
                  verifica caminho estático, e o id só existe em runtime. O que
                  ele protege — o caminho base — continua verificado. */}
              <ButtonLink href={`/admin/artigos/${a.id}` as Route} variant="secondary" size="sm">
                Editar
              </ButtonLink>
              {a.status === 'published' && (
                <Link
                  href={`/artigos/${a.slug}` as Route}
                  target="_blank"
                  className="text-accent rounded-btn px-3 py-1.5 text-sm font-medium transition-colors hover:underline"
                >
                  Ver no site
                </Link>
              )}
              <button
                type="button"
                disabled={apagando === a.id}
                onClick={() => void excluir(a.id, a.title)}
                className="text-muted hover:text-danger-700 rounded-btn ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
              >
                <Trash2 className="size-4" />
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>

      {page?.items.length === 0 && (
        <div className="rounded-card bg-surface ring-line mt-6 flex flex-col items-center p-12 text-center ring-1">
          <span className="bg-sunken text-faint flex size-14 items-center justify-center rounded-full">
            <FileText className="size-6" />
          </span>
          <p className="text-content mt-4 font-semibold">Nenhum artigo ainda</p>
          <p className="text-faint mt-1 max-w-sm text-sm">
            Um artigo bem escrito traz visitante do Google por meses, sem custo de anúncio.
          </p>
          <ButtonLink href="/admin/artigos/novo" className="mt-6">
            <Plus className="size-4" />
            Escrever o primeiro
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
