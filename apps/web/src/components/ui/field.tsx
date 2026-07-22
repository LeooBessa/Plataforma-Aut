import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const CONTROL = cn(
  'w-full rounded-btn border border-line-strong bg-surface',
  'px-3.5 py-2.5 text-sm text-content',
  'placeholder:text-faint',
  'transition-colors',
  'hover:border-ink-600',
  'focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none',
  'disabled:cursor-not-allowed disabled:bg-surface/50 disabled:text-faint',
  // Estado de erro via `aria-invalid`: o atributo serve ao leitor de tela E ao
  // estilo. Uma classe CSS de erro sozinha comunicaria só a quem enxerga.
  'aria-invalid:border-danger-500 aria-invalid:focus:ring-danger-500/20',
);

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(CONTROL, 'cursor-pointer pr-9', className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-24 resize-y', className)} {...props} />;
}

/**
 * Rótulo + campo + mensagem de erro.
 *
 * O `<label htmlFor>` não é formalidade: sem ele, clicar no texto não foca o
 * campo, e o leitor de tela anuncia "campo de edição" sem dizer de quê.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-muted block text-sm font-medium">
        {label}
        {required && (
          <span className="text-danger-500 ml-0.5" aria-hidden>
            *
          </span>
        )}
      </label>

      {children}

      {hint && !error && <p className="text-faint text-xs">{hint}</p>}

      {error && (
        // `role="alert"` faz o leitor de tela anunciar o erro assim que ele
        // aparece, sem o usuário precisar navegar até lá.
        <p id={`${htmlFor}-error`} role="alert" className="text-danger-500 text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
