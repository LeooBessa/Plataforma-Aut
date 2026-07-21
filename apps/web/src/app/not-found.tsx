import { SearchX } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="bg-ink-850 text-silver-600 flex size-14 items-center justify-center rounded-full">
        <SearchX className="size-7" />
      </span>

      <h1 className="text-silver-100 mt-6 text-2xl font-bold tracking-tight">
        Página não encontrada
      </h1>
      <p className="text-silver-400 mt-2 text-sm leading-relaxed">
        O endereço não existe ou o anúncio saiu do ar. Veja os veículos disponíveis.
      </p>

      {/* Um 404 sem saída é onde o visitante fecha a aba. Sempre há uma porta. */}
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/veiculos">Ver veículos</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Voltar ao início
        </ButtonLink>
      </div>
    </div>
  );
}
