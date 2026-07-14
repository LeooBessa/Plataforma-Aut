import type { Metadata } from 'next';
import { BadgeCheck, ShieldCheck, Users, Wrench } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Sobre nós',
  description:
    'Conheça a AutoPremium: seminovos selecionados, com procedência verificada, revisão completa e histórico transparente.',
};

export default function SobrePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
        Sobre a AutoPremium
      </h1>

      <p className="mt-6 text-lg leading-relaxed text-ink-600 text-pretty">
        Comprar um seminovo costuma vir com uma dose de insegurança: o que aconteceu com esse
        carro antes de chegar aqui? Nós existimos para tirar essa dúvida da equação.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {[
          {
            icon: ShieldCheck,
            title: 'Procedência verificada',
            text: 'Consultamos o histórico e emitimos laudo cautelar de todos os veículos antes de anunciá-los.',
          },
          {
            icon: Wrench,
            title: 'Revisão completa',
            text: 'Cada carro passa por um checklist técnico. O que precisa de reparo, é reparado antes da venda.',
          },
          {
            icon: BadgeCheck,
            title: 'Transparência no anúncio',
            text: 'Quilometragem real, número de proprietários e histórico de manutenção — tudo publicado.',
          },
          {
            icon: Users,
            title: 'Sem pressão',
            text: 'Agende uma visita, faça o test drive e leve o tempo que precisar. A decisão é sua.',
          },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-card bg-ink-50 p-6 ring-1 ring-ink-100">
            <span className="flex size-11 items-center justify-center rounded-btn bg-white text-brand-600 shadow-sm ring-1 ring-ink-100">
              <Icon className="size-5" />
            </span>
            <h2 className="mt-4 font-semibold text-ink-900">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{text}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/veiculos" size="lg">
          Ver veículos disponíveis
        </ButtonLink>
        <ButtonLink href="/contato" size="lg" variant="secondary">
          Falar com a gente
        </ButtonLink>
      </div>
    </div>
  );
}
