import Image from 'next/image';
import Link from 'next/link';
import { CalendarCheck, MessageCircle } from 'lucide-react';

import { WHATSAPP, WHATSAPP_FORMATADO, WHATSAPP_MENSAGEM } from '@/lib/contato';
import { whatsappLink } from '@/lib/format';

export function Footer() {
  return (
    <footer className="bg-inverse mt-16">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          {/* Versão de traço CLARO: o rodapé é preto. A escura sumiria. */}
          <Image
            src="/giro-auto-logo-clara.png"
            alt=""
            width={497}
            height={512}
            className="mb-4 h-16 w-auto"
          />
          <span className="text-brand-gradient text-lg font-semibold tracking-[0.2em]">
            Giro Auto
          </span>
          <p className="mt-1 text-[10px] text-white/40 font-medium tracking-[0.22em] uppercase">
            Conecta você ao extraordinário
          </p>
          <p className="mt-5 max-w-xs text-sm text-white/55 leading-relaxed">
            Seminovos premium com procedência verificada, revisão completa e histórico
            transparente.
          </p>
        </div>

        <div>
          <h2 className="text-brand-400 text-xs font-semibold tracking-[0.18em] uppercase">
            Navegação
          </h2>
          <ul className="mt-5 space-y-3 text-sm">
            {/* `as const` preserva os literais das rotas — sem ele o typedRoutes
                recusa, que é a proteção contra link quebrado funcionando. */}
            {(
              [
                { href: '/veiculos', label: 'Veículos' },
                { href: '/sobre', label: 'Sobre nós' },
                { href: '/contato', label: 'Contato' },
              ] as const
            ).map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-white/70 transition-colors hover:text-brand-400"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-brand-400 text-xs font-semibold tracking-[0.18em] uppercase">
            Contato
          </h2>
          {/* WhatsApp em primeiro, e no rodapé de TODAS as páginas.
              É o canal que a loja realmente atende, e no Brasil é por onde a
              negociação de carro acontece. Deixá-lo só na página de Contato
              obrigaria o visitante a procurar — e quem está com dúvida na página
              de um veículo desiste antes de procurar.
              Continua sem telefone fixo, e-mail e endereço: não existem. O que
              havia aqui era placeholder do seed. */}
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <a
                href={whatsappLink(WHATSAPP, WHATSAPP_MENSAGEM)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-success-500 hover:text-success-400 inline-flex items-center gap-2.5 transition-colors"
              >
                <MessageCircle className="size-4 shrink-0" />
                {WHATSAPP_FORMATADO}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-white/35" />
              <span className="text-white/70">
                Ou agende uma visita pelo site e entramos em contato para confirmar.
              </span>
            </li>
            <li>
              <Link
                href="/contato"
                className="text-brand-400 transition-colors hover:text-brand-300"
              >
                Falar com a gente
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Filete azul separando o rodapé do crédito. */}
      <div aria-hidden className="rule-brand mx-auto h-px max-w-7xl" />

      <div className="px-4 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Giro Auto. Todos os direitos reservados.
      </div>
    </footer>
  );
}
