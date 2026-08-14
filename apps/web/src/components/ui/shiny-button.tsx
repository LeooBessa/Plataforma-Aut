'use client';

import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Botão "shiny" — preto com borda azul girando, brilho interno e um padrão de
 * pontos que aparece no hover.
 *
 * ----------------------------------------------------------------------------
 * A CSS É GLOBAL, NÃO `<style jsx>`
 * ----------------------------------------------------------------------------
 * O original traz um `<style jsx>` dentro do componente. Aqui a CSS mora em
 * globals.css (classe `.shiny-cta`) porque o styled-jsx RENOMEIA os `@keyframes`
 * para escopá-los, mas a referência a eles fica dentro de uma variável
 * (`--animation: gradient-angle ...`), que ele não reescreve. O nome renomeado
 * deixa de bater com a referência e a animação simplesmente não roda.
 *
 * ----------------------------------------------------------------------------
 * DOIS COMPONENTES, COMO O RESTO DO SITE
 * ----------------------------------------------------------------------------
 * Mesma divisão de `Button` e `ButtonLink`, e pelo mesmo motivo: metade dos
 * lugares onde este botão entra são NAVEGAÇÃO ("Ver Estoque" leva a /veiculos).
 * Um `<button>` com `router.push` até muda de página, mas perde abrir em nova
 * aba, ctrl+clique, "copiar endereço" — e some do rastreamento de links do
 * Google, que é o canal por onde a loja é encontrada.
 */

/** Ação: envia formulário ou dispara `onClick`. */
export function ShinyButton({
  className,
  children,
  ...props
}: ComponentProps<'button'> & { children: ReactNode }) {
  return (
    <button type="button" className={cn('shiny-cta', className)} {...props}>
      <span>{children}</span>
    </button>
  );
}

/** Navegação: é um link de verdade. */
export function ShinyButtonLink({
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link className={cn('shiny-cta', className)} {...props}>
      <span>{children}</span>
    </Link>
  );
}
