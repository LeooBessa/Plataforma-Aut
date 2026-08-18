import type { ReactNode } from 'react';

/**
 * Renderizador de um SUBCONJUNTO de markdown.
 *
 * ============================================================================
 * POR QUE NÃO UMA BIBLIOTECA
 * ============================================================================
 * As bibliotecas de markdown convertem texto em HTML, e exibir esse HTML exige
 * `dangerouslySetInnerHTML`. Isso é XSS armazenado esperando acontecer: quem
 * escreve é o admin, que é justamente a conta com mais poder de causar dano se
 * for comprometida — e o vazamento de um token levaria a script rodando na
 * sessão de todo visitante.
 *
 * Aqui o markdown vira ELEMENTOS REACT direto, sem passar por HTML. O React
 * escapa todo texto por padrão, então não existe caminho para injeção,
 * independentemente do que houver no banco.
 *
 * O custo é o subconjunto: só o que a loja precisa para escrever um artigo.
 *
 * ============================================================================
 * O QUE É SUPORTADO
 * ============================================================================
 *   ## Subtítulo          → <h2>
 *   ### Subtítulo menor   → <h3>
 *   - item                → lista com marcadores
 *   1. item               → lista numerada
 *   > citação             → destaque
 *   **negrito**           → <strong>
 *   [texto](url)          → link
 *   linha em branco       → separa parágrafos
 *
 * Qualquer outra coisa é tratada como texto comum. Isso é decisão, não
 * limitação: quem escreve não precisa aprender markdown para escrever bem — o
 * texto colado do WhatsApp vira parágrafos e já está publicável.
 */

/** Só `http`, `https` e caminho interno. Bloqueia `javascript:` e `data:`. */
function linkSeguro(url: string): string | null {
  const limpo = url.trim();
  if (limpo.startsWith('/')) return limpo;
  if (/^https?:\/\//i.test(limpo)) return limpo;
  return null;
}

/** Negrito e link dentro de uma linha. Devolve nós React, nunca HTML. */
function inline(texto: string, chave: string): ReactNode[] {
  const partes: ReactNode[] = [];
  // Uma expressão só para os dois casos: se dividisse em duas passagens, um
  // link dentro de negrito perderia uma das marcações.
  const padrao = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = padrao.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));

    if (m[1]) {
      partes.push(<strong key={`${chave}-b${i}`}>{m[1].slice(2, -2)}</strong>);
    } else if (m[2]) {
      const [, rotulo, url] = /\[([^\]]+)\]\(([^)]+)\)/.exec(m[2]) ?? [];
      const href = url ? linkSeguro(url) : null;
      partes.push(
        href ? (
          <a
            key={`${chave}-l${i}`}
            href={href}
            className="text-accent underline underline-offset-2"
            {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {rotulo}
          </a>
        ) : (
          // URL recusada vira texto puro: o leitor ainda lê o rótulo, e nada
          // executável entra na página.
          rotulo
        ),
      );
    }

    ultimo = m.index + m[0].length;
    i += 1;
  }

  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes.length ? partes : [texto];
}

export function Markdown({ children }: { children: string }) {
  const linhas = children.replace(/\r\n/g, '\n').split('\n');
  const blocos: ReactNode[] = [];

  let paragrafo: string[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  let n = 0;

  const fecharParagrafo = () => {
    if (!paragrafo.length) return;
    const texto = paragrafo.join(' ');
    blocos.push(
      <p key={`p${n++}`} className="text-muted mt-4 leading-relaxed">
        {inline(texto, `p${n}`)}
      </p>,
    );
    paragrafo = [];
  };

  const fecharLista = () => {
    if (!lista) return;
    const Tag = lista.ordenada ? 'ol' : 'ul';
    blocos.push(
      <Tag
        key={`l${n++}`}
        className={`text-muted mt-4 space-y-1.5 pl-5 ${lista.ordenada ? 'list-decimal' : 'list-disc'}`}
      >
        {lista.itens.map((item, k) => (
          <li key={k} className="leading-relaxed">
            {inline(item, `l${n}-${k}`)}
          </li>
        ))}
      </Tag>,
    );
    lista = null;
  };

  const fecharTudo = () => {
    fecharParagrafo();
    fecharLista();
  };

  for (const bruta of linhas) {
    const linha = bruta.trim();

    if (!linha) {
      fecharTudo();
      continue;
    }

    if (linha.startsWith('### ')) {
      fecharTudo();
      blocos.push(
        <h3 key={`h${n++}`} className="text-content mt-8 text-lg font-semibold">
          {inline(linha.slice(4), `h${n}`)}
        </h3>,
      );
      continue;
    }

    if (linha.startsWith('## ')) {
      fecharTudo();
      blocos.push(
        <h2 key={`h${n++}`} className="text-content mt-10 text-xl font-bold tracking-tight">
          {inline(linha.slice(3), `h${n}`)}
        </h2>,
      );
      continue;
    }

    if (linha.startsWith('> ')) {
      fecharTudo();
      blocos.push(
        <blockquote
          key={`q${n++}`}
          className="border-accent text-content mt-6 border-l-2 pl-4 text-lg leading-relaxed italic"
        >
          {inline(linha.slice(2), `q${n}`)}
        </blockquote>,
      );
      continue;
    }

    const marcador = /^[-*]\s+(.*)$/.exec(linha);
    const numerada = /^\d+[.)]\s+(.*)$/.exec(linha);

    if (marcador || numerada) {
      fecharParagrafo();
      const ordenada = Boolean(numerada);
      const item = (marcador ?? numerada)![1];
      // Trocar de tipo de lista fecha a anterior: "- a" seguido de "1. b" são
      // duas listas, não uma bagunçada.
      if (lista && lista.ordenada !== ordenada) fecharLista();
      lista ??= { ordenada, itens: [] };
      lista.itens.push(item);
      continue;
    }

    fecharLista();
    paragrafo.push(linha);
  }

  fecharTudo();
  return <>{blocos}</>;
}
