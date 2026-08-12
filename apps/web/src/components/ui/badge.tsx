import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'highlight' | 'brand' | 'success' | 'neutral' | 'warning' | 'danger' | 'dark';

const TONES: Record<Tone, string> = {
  // O selo de destaque, usado SOBRE FOTO. Contorno e véu translúcido, não
  // preenchimento: um bloco sólido de cor brigaria com a imagem embaixo.
  //
  // O nome diz o PAPEL, não a cor. Este tom já se chamou `gold`; quando a
  // paleta virou azul, o nome passou a mentir — e um `tone="gold"` que pinta de
  // azul é o tipo de coisa que sobrevive anos no código.
  highlight: 'border-brand-500/40 bg-canvas/80 text-accent backdrop-blur',
  brand: 'border-brand-500/40 bg-brand-500/10 text-accent',
  success: 'border-success-500/30 bg-success-500/10 text-success-500',
  neutral: 'border-line-strong bg-canvas/80 text-muted backdrop-blur',
  warning: 'border-warning-600/40 bg-warning-600/10 text-warning-600',
  danger: 'border-danger-500/40 bg-danger-500/10 text-danger-500',
  dark: 'border-line-strong bg-canvas/90 text-content backdrop-blur',
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
