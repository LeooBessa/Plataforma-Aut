import type { Metadata } from 'next';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { whatsappLink } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Contato',
  description:
    'Fale com a AutoPremium: telefone, WhatsApp, e-mail e endereço. Atendimento de segunda a sábado.',
};

const WHATSAPP = '11999998888';

export default function ContatoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">Fale com a gente</h1>
      <p className="mt-3 text-ink-600">
        Tem dúvida sobre um veículo, quer negociar a troca do seu ou precisa de ajuda com
        financiamento? Estamos aqui.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Card
          icon={<MessageCircle className="size-5" />}
          title="WhatsApp"
          value="(11) 99999-8888"
          // O WhatsApp abre com a mensagem já escrita: um campo de texto em
          // branco é uma barreira pequena, mas real — e derruba conversão.
          href={whatsappLink(WHATSAPP, 'Olá! Vi o site da AutoPremium e gostaria de mais informações.')}
          tone="success"
        />
        <Card
          icon={<Phone className="size-5" />}
          title="Telefone"
          value="(11) 3333-4444"
          href="tel:+551133334444"
        />
        <Card
          icon={<Mail className="size-5" />}
          title="E-mail"
          value="contato@autopremium.com.br"
          href="mailto:contato@autopremium.com.br"
        />
        <Card icon={<MapPin className="size-5" />} title="Endereço" value="São Paulo, SP" />
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-card bg-ink-50 p-5 ring-1 ring-ink-100">
        <Clock className="mt-0.5 size-5 shrink-0 text-ink-400" />
        <div className="text-sm">
          <p className="font-semibold text-ink-900">Horário de atendimento</p>
          <p className="mt-1 text-ink-600">Segunda a sexta, 8h às 18h30 · Sábado, 9h às 14h</p>
        </div>
      </div>

      <div className="mt-10 rounded-card bg-ink-950 p-8 text-center">
        <h2 className="text-xl font-bold text-white">Prefere ver o carro pessoalmente?</h2>
        <p className="mt-2 text-sm text-ink-300">
          Escolha um veículo e agende sua visita direto pelo site.
        </p>
        <ButtonLink href="/veiculos" variant="success" size="lg" className="mt-6">
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
            ? 'flex size-11 items-center justify-center rounded-btn bg-success-50 text-success-600'
            : 'flex size-11 items-center justify-center rounded-btn bg-brand-50 text-brand-600'
        }
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="truncate text-sm text-ink-600">{value}</p>
      </div>
    </>
  );

  const className =
    'flex items-center gap-4 rounded-card bg-white p-5 shadow-card ring-1 ring-ink-100 transition-shadow hover:shadow-card-hover';

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
