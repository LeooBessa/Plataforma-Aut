import { cn } from '@/lib/utils';

/**
 * Fundo de brilho radial: base no alto, azul da marca escapando pelas quinas de
 * baixo. Vem em duas versões — fundo preto e fundo branco.
 *
 * ----------------------------------------------------------------------------
 * POR QUE É UMA CAMADA, E NÃO UM "HERO"
 * ----------------------------------------------------------------------------
 * O trecho de onde isto veio era um componente de tela cheia (`h-screen`) que
 * não renderizava conteúdo nenhum — só o fundo. Copiado como estava, seria código
 * morto: a home já tem hero, e o que se queria aqui era o FUNDO de uma seção que
 * já existe. Então o que ficou foi só a camada, que qualquer seção pode vestir.
 *
 * ----------------------------------------------------------------------------
 * COMO USAR
 * ----------------------------------------------------------------------------
 * A seção que recebe precisa de `relative isolate`:
 *
 *   <section className="bg-inverse relative isolate">   ← ou bg-canvas, no claro
 *     <GradientBackdrop />                              ← ou tone="light"
 *     …conteúdo…
 *   </section>
 *
 * O `isolate` não é enfeite. Sem ele, um filho com z-index negativo pinta ATRÁS
 * do fundo do próprio pai e o degradê simplesmente não aparece — o `bg-*` o
 * cobre. Criando um contexto de empilhamento no pai, o `-z-10` passa a ficar
 * acima do fundo dele e abaixo do conteúdo, que é onde ele deve estar.
 *
 * O `bg-*` da seção continua embaixo de propósito: é o piso que garante texto
 * legível mesmo no instante antes de o degradê pintar.
 *
 * ----------------------------------------------------------------------------
 * AS CORES — E POR QUE OS DOIS AZUIS SÃO DIFERENTES
 * ----------------------------------------------------------------------------
 * O original ia de preto a `#63e`, um violeta. Aqui as pontas saem da paleta, em
 * variáveis e não em hex, para que um ajuste de marca chegue sozinho.
 *
 * Mesmo MATIZ nas duas versões (262, o azul da logo), luminosidades opostas — e
 * isso é obrigatório, não gosto. O degradê fica exatamente atrás do texto:
 *
 *   • no ESCURO o texto é branco, então o azul tem de ser fundo (`brand-800`).
 *     Com o `brand-600` do texto, o branco esmaecido sobre ele perderia
 *     contraste.
 *   • no CLARO o texto é escuro, então o azul tem de ser PÁLIDO (`brand-100`).
 *     O mesmo `brand-800` do escuro apagaria o texto preto por cima.
 *
 * Trocar um pelo outro não deixa "mais bonito": deixa ilegível na metade de
 * baixo da seção.
 */
const TONS = {
  dark: '[background:radial-gradient(125%_125%_at_50%_10%,var(--color-ink-950)_40%,var(--color-brand-800)_100%)]',
  light:
    '[background:radial-gradient(125%_125%_at_50%_10%,var(--color-ink-0)_40%,var(--color-brand-100)_100%)]',
} as const;

export function GradientBackdrop({
  tone = 'dark',
  className,
}: {
  tone?: keyof typeof TONS;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 -z-10', TONS[tone], className)}
    />
  );
}
