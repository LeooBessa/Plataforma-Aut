import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-inverse mt-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <span className="text-gold-gradient text-lg font-semibold tracking-[0.2em]">
            ÂUREON
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
          <ul className="mt-5 space-y-3 text-sm">
            <li className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-white/35" />
              <a
                href="tel:+551133334444"
                className="text-white/70 transition-colors hover:text-brand-400"
              >
                (11) 3333-4444
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="size-4 shrink-0 text-white/35" />
              <a
                href="mailto:contato@aureon.com.br"
                className="text-white/70 transition-colors hover:text-brand-400"
              >
                contato@aureon.com.br
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-white/35" />
              <span className="text-white/70">São Paulo, SP</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Filete dourado separando o rodapé do crédito. */}
      <div aria-hidden className="rule-gold mx-auto h-px max-w-7xl" />

      <div className="px-4 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} ÂUREON. Todos os direitos reservados.
      </div>
    </footer>
  );
}
