import { ArticleForm } from '@/features/articles/article-form';

export default function NovoArtigoPage() {
  return (
    <div>
      <h1 className="text-content text-2xl font-bold tracking-tight">Novo artigo</h1>
      <p className="text-muted mt-1 mb-6 text-sm">
        Salve como rascunho quantas vezes quiser. Ele só aparece no site quando você publicar.
      </p>
      <ArticleForm />
    </div>
  );
}
