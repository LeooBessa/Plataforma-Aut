'use client';

import type React from 'react';

/**
 * Botão "shiny" — preto com borda azul girando, brilho interno e um padrão
 * de pontos que aparece no hover.
 *
 * A CSS mora em globals.css (classe `.shiny-cta`), e NÃO num `<style jsx>` como
 * no original. Motivo: o styled-jsx renomeia os `@keyframes` para escopá-los,
 * mas a referência a eles fica dentro de uma variável (`--animation: gradient-
 * angle ...`), que ele não reescreve — então o nome renomeado não bate com a
 * referência e a animação não roda. Global resolve, e é o mesmo padrão do
 * `@property --r` que o resto do site já usa.
 */
interface ShinyButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ShinyButton({ children, onClick, className = '' }: ShinyButtonProps) {
  return (
    <button type="button" className={`shiny-cta ${className}`} onClick={onClick}>
      <span>{children}</span>
    </button>
  );
}
