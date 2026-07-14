import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const CONTROL = cn(
  'w-full rounded-btn border border-ink-200 bg-white',
  'px-3.5 py-2.5 text-sm text-ink-900',
  'placeholder:text-ink-400',
  'transition-colors',
  'hover:border-ink-300',
  'focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 focus:outline-none',
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
  // Estado de erro via `aria-invalid`: o atributo serve ao leitor de tela E ao
  // estilo. Uma classe CSS de erro sozinha comunicaria só a quem enxerga.
  'aria-invalid:border-danger-500 aria-invalid:focus:ring-danger-500/15',
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
 * campo, e o leitor de tela anuncia "campo de edição" sem dizer de quê. O erro
 * é ligado por `aria-describedby` para ser lido junto.
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
      <label htmlFor={htmlFor} className="text-ink-800 block text-sm font-medium">
        {label}
        {required && (
          <span className="text-danger-600 ml-0.5" aria-hidden>
            *
          </span>
        )}
      </label>

      {children}

      {hint && !error && <p className="text-ink-500 text-xs">{hint}</p>}

      {error && (
        // `role="alert"` faz o leitor de tela anunciar o erro assim que ele
        // aparece, sem o usuário precisar navegar até lá.
        <p id={`${htmlFor}-error`} role="alert" className="text-danger-600 text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
