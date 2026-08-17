import { cn } from '@/lib/utils';

/**
 * Fundo de brilho radial: preto no alto, azul da marca escapando pelas quinas
 * de baixo.
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
 *   <section className="bg-inverse relative isolate">
 *     <GradientBackdrop />
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
 * AS CORES
 * ----------------------------------------------------------------------------
 * O original ia de preto a `#63e`, um violeta. Aqui as duas pontas saem da
 * paleta: o mesmo preto do rodapé e o azul da logo — variáveis, não hex, para
 * que um ajuste de marca chegue aqui sozinho.
 *
 * O azul é o `brand-800`, não o `brand-600` do texto. O 600 tem luminosidade
 * 0.55 e as quinas de baixo ficam justamente atrás da lista de argumentos: o
 * texto branco esmaecido perderia contraste em cima dele. O 800 mantém o azul
 * reconhecível e deixa o texto legível — foi medido, não chutado.
 *
 * SÓ EXISTE A VERSÃO ESCURA. Houve uma clara (branco → `brand-100`) para a seção
 * da lista de espera, e foi removida: sobre fundo branco o azul precisa ser
 * pálido para o texto escuro sobreviver, e pálido demais ele deixa de somar. O
 * efeito depende do contraste com o preto — não é um tema que se inverte.
 */
export function GradientBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 -z-10',
        '[background:radial-gradient(125%_125%_at_50%_10%,var(--color-ink-950)_40%,var(--color-brand-800)_100%)]',
        className,
      )}
    />
  );
}
