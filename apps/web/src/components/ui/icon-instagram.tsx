/**
 * Glifo do Instagram.
 *
 * Existe porque o `lucide-react` REMOVEU os ícones de marca nas versões novas —
 * `Instagram`, `Facebook`, `Youtube` e companhia saíram do pacote por questão de
 * marca registrada. Importá-los quebra o build com "has no exported member".
 *
 * Desenhado no mesmo padrão dos demais ícones do site (24×24, traço 2,
 * `currentColor`, pontas arredondadas) para não destoar ao lado deles. Recebe
 * `className` como qualquer ícone do lucide, então `size-4` e `size-5`
 * funcionam igual.
 */
export function IconInstagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
