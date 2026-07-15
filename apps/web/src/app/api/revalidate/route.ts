import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';

/**
 * Revalidação sob demanda — o que fecha o ciclo do ISR.
 *
 * As páginas do site são estáticas, regeneradas a cada 5 minutos. Sem este
 * endpoint, um anúncio editado só apareceria corrigido depois desses 5 minutos —
 * tempo suficiente para um cliente ver preço errado.
 *
 * Aqui o BACKEND avisa o Next assim que algo muda, e a página se atualiza em
 * segundos. É a diferença entre "o site atualiza sozinho de vez em quando" e "o
 * que o admin salva aparece na hora".
 *
 * ATENÇÃO: este endpoint é chamado pelo FastAPI, não pelo browser. Ele NÃO passa
 * pelo rewrite `/api/*` (que aponta para o FastAPI) porque é um Route Handler
 * real do Next — o rewrite só age em caminhos SEM arquivo correspondente, e este
 * arquivo existe.
 */

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

export async function POST(request: NextRequest) {
  // Segredo compartilhado só entre o FastAPI e o Next.
  //
  // Sem ele, qualquer um poderia disparar revalidações em massa e transformar
  // este endpoint num vetor de negação de serviço — forçando o site a regenerar
  // páginas sem parar. A comparação é direta porque o segredo tem entropia alta
  // (não é senha de humano); o risco de timing attack aqui é irrelevante.
  const provided = request.headers.get('x-revalidate-secret');

  if (!REVALIDATE_SECRET || provided !== REVALIDATE_SECRET) {
    return Response.json({ revalidated: false, error: 'não autorizado' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { tags?: string[] } | null;
  const tags = body?.tags ?? [];

  if (tags.length === 0) {
    return Response.json({ revalidated: false, error: 'nenhuma tag' }, { status: 400 });
  }

  for (const tag of tags) {
    // `{ expire: 0 }` = expira AGORA.
    //
    // O segundo argumento é obrigatório no Next 16 (escrever `revalidateTag(tag)`
    // sozinho nem compila). E o valor importa: o perfil `'max'` mantém o cache
    // fresco por até 30 dias e NÃO marca a página como obsoleta — descobri isso
    // testando: com `'max'`, o preço editado não aparecia nem após várias
    // visitas. `{ expire: 0 }` é a forma documentada para invalidação imediata
    // via webhook, que é exatamente o nosso caso: o backend avisando o Next.
    revalidateTag(tag, { expire: 0 });
  }

  return Response.json({ revalidated: true, tags, now: Date.now() });
}
