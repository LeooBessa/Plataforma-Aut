import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CalendarCheck, Mail, MessageCircle } from 'lucide-react';

import { IconInstagram } from '@/components/ui/icon-instagram';

import { ShinyButtonLink } from '@/components/ui/shiny-button';
import {
  EMAIL,
  EMAIL_LINK,
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
 * Telefone fixo segue de fora porque não existe. Endereço também não entra: não
 * há loja física.
 *
 * A ORDEM é por uso real, não por formalidade. WhatsApp primeiro porque é o
 * canal que a loja atende e onde a negociação de carro acontece no Brasil;
 * Instagram depois, que é onde o estoque aparece; e-mail por último, que é o que
 * quase ninguém usa para comprar carro — mas precisa existir para quem prefere
 * escrever, e para o que é documento.
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
  {
    icon: <Mail className="size-5" />,
    title: 'E-mail',
    value: EMAIL,
    href: EMAIL_LINK,
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
        financiamento? Escolha o carro no estoque e agende uma visita. A gente entra em
        contato para confirmar.
      </p>

      {/* UMA COLUNA em qualquer largura.
          Eram duas, e com três canais sobrava um cartão solto na última linha —
          resolvido antes centrando o que sobrava, mas empilhado o problema
          simplesmente não existe. De quebra, a lista passa a ler na ordem de uso
          (WhatsApp, Instagram, e-mail) em vez de em Z, e cada cartão ganha
          largura para o endereço de e-mail respirar. */}
      {CANAIS.length > 0 && (
        <div className="mt-10 grid gap-4">
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
        <ShinyButtonLink href="/veiculos" className="mt-6">
          Ver veículos e agendar visita
        </ShinyButtonLink>
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
