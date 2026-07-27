'use client';

import type { HTMLAttributes } from 'react';

/**
 * Botão com BORDA DE GRADIENTE ROTATIVO.
 *
 * O visual vem de duas camadas: o próprio elemento é um gradiente cônico que
 * gira (classe `.rotatingGradient`, definida em globals.css), e o pseudo
 * `::after` é um preenchimento sólido 5px para dentro — sobra só um anel de
 * gradiente na borda. As cores e o miolo saem das variáveis CSS
 * `--color-background` (miolo) e `--color-text` (texto), também em globals.css.
 */
interface GradientButtonProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  width?: string;
  height?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const GradientButton = ({
  children,
  width = '600px',
  height = '100px',
  className = '',
  onClick,
  disabled = false,
  ...props
}: GradientButtonProps) => {
  const commonGradientStyles = `
    relative rounded-[50px] cursor-pointer
    after:content-[""] after:block after:absolute after:bg-[var(--color-background)]
    after:inset-[5px] after:rounded-[45px] after:z-[1]
    after:transition-opacity after:duration-300 after:ease-linear
    flex items-center justify-center
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div className="text-center text-[#eee]">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={`
          ${commonGradientStyles}
          rotatingGradient
          ${className}
        `}
        style={
          {
            '--r': '0deg',
            minWidth: width,
            height: height,
          } as React.CSSProperties
        }
        onClick={disabled ? undefined : onClick}
        onKeyDown={handleKeyDown}
        aria-disabled={disabled}
        {...props}
      >
        <span className="label relative z-10 flex items-center justify-center text-[var(--color-text)]">
          {children}
        </span>
      </div>
    </div>
  );
};

export default GradientButton;
