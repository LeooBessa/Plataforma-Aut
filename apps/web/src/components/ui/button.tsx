import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Dourado com texto PRETO. O ouro é claro; texto branco em cima dele
  // reprovaria em contraste. Preto sobre ouro é o par legível — e é também o
  // que dá a leitura de "peça metálica", não de "botão colorido".
  primary:
    'bg-gradient-to-b from-brand-400 to-brand-600 text-ink-950 font-semibold hover:from-brand-300 hover:to-brand-500',
  // Verde: reservado ao que converte — "Agendar visita".
  success: 'bg-success-700 text-white hover:bg-success-800',
  // Contorno prata sobre o preto: presente sem competir com o dourado.
  secondary:
    'border border-ink-700 bg-ink-900/60 text-silver-200 hover:border-ink-600 hover:bg-ink-800 hover:text-silver-100',
  ghost: 'text-silver-400 hover:bg-ink-800 hover:text-silver-100',
  danger: 'bg-danger-600 text-white hover:bg-danger-700',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-[15px] gap-2.5',
};

const BASE = cn(
  'inline-flex items-center justify-center rounded-btn font-medium',
  'transition-all duration-200',
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
