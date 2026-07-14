import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'brand' | 'success' | 'neutral' | 'warning' | 'danger' | 'dark';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  success: 'bg-success-50 text-success-700 ring-success-500/25',
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  warning: 'bg-warning-50 text-warning-700 ring-warning-600/25',
  danger: 'bg-danger-50 text-danger-700 ring-danger-500/25',
  // Preto sólido: o selo de destaque. Contrasta com tudo e chama o olho no card.
  dark: 'bg-ink-950 text-white ring-ink-950',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1',
        'text-xs font-semibold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
