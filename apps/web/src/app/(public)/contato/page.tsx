import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CalendarCheck, MessageCircle } from 'lucide-react';

import { IconInstagram } from '@/components/ui/icon-instagram';

import { ButtonLink } from '@/components/ui/button';
import {
  INSTAGRAM_ARROBA,
  INSTAGRAM_URL,
  WHATSAPP,
  WHATSAPP_FORMATADO,
  WHATSAPP_MENSAGEM,
} from '@/lib/contato';
import { whatsappLink } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Contato',
  description: `Fale com a Giro Auto pelo WhatsApp ${WHATSAPP_FORMATADO} ou agende sua visita pelo site.`,
};

/**
 * CANAIS DE ATENDIMENTO.
 *
 * A lista é a fonte da seção: item que existe aqui aparece na tela, e a seção
 * inteira some quando ela está vazia — foi assim que a página ficou enquanto não
 * havia número real. O que havia antes era placeholder do seed (um WhatsApp de
 * São Paulo que não atendia), e contato falso é pior que contato ausente: a
 * pessoa tenta, ninguém responde, e a conclusão é que a empresa não existe.
 *
 * Telefone fixo e e-mail seguem de fora porque ainda não existem. Endereço
 * também não entra: não há loja física.
 */
const CANAIS: {
  icon: ReactNode;
  title: string;
  value: string;
  href?: string;
  tone?: 'brand' | 'success';
}[] = [
  {
    icon: <MessageCircle className="size-5" />,
    title: 'WhatsApp',
    value: WHATSAPP_FORMATADO,
    href: whatsappLink(WHATSAPP, WHATSAPP_MENSAGEM),
    tone: 'success',
  },
  {
    icon: <IconInstagram className="size-5" />,
    title: 'Instagram',
    value: INSTAGRAM_ARROBA,
    href: INSTAGRAM_URL,
  },
];

export default function ContatoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-content text-3xl font-bold tracking-tight sm:text-4xl">
        Fale com a gente
      </h1>
      <p className="text-muted mt-3">
        Tem dúvida sobre um veículo, quer negociar a troca do seu ou precisa de ajuda com
        financiamento? Escolha o carro no estoque e agende uma visita — a gente entra em
        contato para confirmar.
      </p>

      {CANAIS.length > 0 && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {CANAIS.map((canal) => (
            <Card key={canal.title} {...canal} />
          ))}
        </div>
      )}

      <div className="rounded-card bg-surface ring-line mt-8 flex items-start gap-3 p-5 ring-1">
        <CalendarCheck className="text-faint mt-0.5 size-5 shrink-0" />
        <div className="text-sm">
          <p className="text-content font-semibold">Como funciona</p>
          <p className="text-muted mt-1">
            O agendamento é feito na página do veículo. Você escolhe o dia e o horário, e
            confirmamos em seguida.
          </p>
        </div>
      </div>

      {/* Este bloco era um retângulo preto sobre fundo preto — sumia. Ganha
          contorno azul tênue e um brilho ao fundo para se destacar sem
          precisar de uma cor que brigue com a marca. */}
      <div className="rounded-card border-accent/30 bg-brand-600/[0.06] mt-10 border p-8 text-center">
        <h2 className="text-content text-xl font-bold">Prefere ver o carro pessoalmente?</h2>
        <p className="text-muted mt-2 text-sm">
          Escolha um veículo e agende sua visita direto pelo site.
        </p>
        <ButtonLink href="/veiculos" size="lg" className="mt-6">
          Ver veículos e agendar visita
        </ButtonLink>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  value,
  href,
  tone = 'brand',
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  href?: string;
  tone?: 'brand' | 'success';
}) {
  const content = (
    <>
      <span
        className={
          tone === 'success'
            ? 'rounded-btn bg-success-500/10 text-success-500 flex size-11 items-center justify-center'
            : 'rounded-btn bg-accent-soft text-accent flex size-11 items-center justify-center'
        }
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-content text-sm font-semibold">{title}</p>
        <p className="text-muted truncate text-sm">{value}</p>
      </div>
    </>
  );

  const className =
    'flex items-center gap-4 rounded-card bg-surface p-5 shadow-card ring-1 ring-line transition-shadow hover:shadow-card-hover';

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    // Link externo (`wa.me`, `tel:`, `mailto:`) — um `<a>` comum, não o <Link> do
    // Next, que é para navegação interna.
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className={className}
    >
      {content}
    </a>
  );
}
