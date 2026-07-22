'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';

import { Button, ButtonLink } from '@/components/ui/button';

/**
 * Página de erro.
 *
 * ATENÇÃO ao nome da segunda prop: no Next 16 ela é `unstable_retry`. Nas versões
 * anteriores chamava-se `reset`. Quem escrever `reset` por memória não recebe
 * erro algum — apenas ganha um botão "Tentar novamente" que não faz nada.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="bg-danger-500/10 text-danger-400 flex size-14 items-center justify-center rounded-full">
        <AlertTriangle className="size-7" />
      </span>

      <h1 className="text-content mt-6 text-2xl font-bold tracking-tight">
        Algo deu errado
      </h1>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        Tivemos um problema ao carregar esta página. Tente novamente — se persistir, fale com a
        gente.
      </p>

      {/* O `digest` é o identificador que aparece no log do servidor. Mostrá-lo
          permite ao usuário nos dizer QUAL erro aconteceu, em vez de "deu erro".
          A mensagem em si NÃO é exibida: ela pode conter detalhes internos. */}
      {error.digest && (
        <p className="text-faint mt-3 font-mono text-xs">código: {error.digest}</p>
      )}

      <div className="mt-8 flex gap-3">
        <Button onClick={() => unstable_retry()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
        <ButtonLink href="/" variant="secondary">
          Voltar ao início
        </ButtonLink>
      </div>
    </div>
  );
}
