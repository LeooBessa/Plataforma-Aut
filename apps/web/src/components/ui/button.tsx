import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // PRETO com texto branco.
  //
  // O botão é o elemento mais repetido do site. Pintá-lo de dourado gastaria a
  // cor da marca justamente onde ela deixa de ser "detalhe" — e o dourado vale
  // pelo que ele NÃO ocupa. Reservado ao preço, aos selos e aos filetes, ele
  // continua chamando atenção; espalhado por toda tela, vira só mais uma cor.
  //
  // O preto ainda ganha em contraste (17:1) e é a leitura clássica de luxo
  // discreto num fundo branco.
  primary: 'bg-inverse text-on-inverse font-semibold hover:bg-ink-800',
  // Verde: reservado ao que confirma — "Confirmar agendamento" no painel.
  success: 'bg-success-700 text-white hover:bg-success-800',
  // Contorno cinza: presente, secundário, sem pedir a vez.
  secondary:
    'border border-line-strong bg-surface text-content hover:border-ink-400 hover:bg-sunken',
  ghost: 'text-muted hover:bg-sunken hover:text-content',
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
