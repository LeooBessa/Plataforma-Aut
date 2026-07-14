import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Azul: a ação principal da tela. Só uma por tela — se tudo é primário,
  // nada é.
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
  // Verde: reservado para o que é positivo e converte — "Agendar visita".
  // Usá-lo em qualquer botão diluiria o sinal.
  success: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-700 shadow-sm',
  secondary: 'bg-white text-ink-900 border border-ink-200 hover:bg-ink-50 active:bg-ink-100',
  ghost: 'text-ink-700 hover:bg-ink-100 active:bg-ink-200',
  danger: 'bg-danger-600 text-white hover:bg-danger-700',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-base gap-2.5',
};

const BASE = cn(
  'inline-flex items-center justify-center rounded-btn font-medium',
  'transition-colors duration-150',
  // `active:scale` dá o retorno tátil do clique sem animação chamativa.
  'active:scale-[0.98] motion-reduce:active:scale-100',
  'disabled:pointer-events-none disabled:opacity-50',
  'whitespace-nowrap',
);

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

/**
 * Botão que navega.
 *
 * É um `<a>` de verdade, não um `<button onClick={router.push}>`. A diferença
 * importa: com `<a>`, o usuário pode abrir em nova aba, copiar o endereço, e o
 * Googlebot enxerga o link. Com o botão, nada disso funciona.
 */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </Link>
  );
}
