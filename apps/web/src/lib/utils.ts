import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Junta classes do Tailwind resolvendo conflitos.
 *
 * Sem `twMerge`, `cn('px-4', 'px-6')` produziria as duas classes e o resultado
 * dependeria da ordem no CSS final — o que é imprevisível. Com ele, a última
 * vence, que é o que qualquer pessoa espera ao sobrescrever um estilo.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
