import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'gold' | 'brand' | 'success' | 'neutral' | 'warning' | 'danger' | 'dark';

const TONES: Record<Tone, string> = {
  // Dourado: o selo de destaque. Contorno e brilho, não preenchimento — sobre
  // foto, um bloco sólido de ouro brigaria com a imagem.
  gold: 'border-brand-500/40 bg-ink-950/80 text-brand-300 backdrop-blur',
  brand: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
  success: 'border-success-500/30 bg-success-500/10 text-success-500',
  neutral: 'border-ink-700 bg-ink-950/80 text-silver-300 backdrop-blur',
  warning: 'border-warning-600/40 bg-warning-600/10 text-warning-600',
  danger: 'border-danger-500/40 bg-danger-500/10 text-danger-500',
  dark: 'border-ink-700 bg-ink-950/90 text-silver-100 backdrop-blur',
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
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1',
        'text-[10px] font-semibold tracking-[0.14em] uppercase',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
