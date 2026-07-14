import Link from 'next/link';
import { Car, Mail, MapPin, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-800 bg-ink-950 text-ink-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-btn bg-white text-ink-950">
              <Car className="size-5" />
            </span>
            <span className="text-lg font-bold text-white">
              Auto<span className="text-brand-400">Premium</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-400">
            Seminovos selecionados, com procedência verificada e revisão completa.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white">Navegação</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {/* `as const` preserva os literais das rotas. Sem ele, o TypeScript
                infere `string` e o `typedRoutes` recusa — que é justamente a
                proteção funcionando: ela existe para pegar link quebrado em
                tempo de compilação, não em produção. */}
            {(
              [
                { href: '/veiculos', label: 'Veículos' },
                { href: '/sobre', label: 'Sobre nós' },
                { href: '/contato', label: 'Contato' },
              ] as const
            ).map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white">Contato</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-ink-500" />
              <a href="tel:+551133334444" className="transition-colors hover:text-white">
                (11) 3333-4444
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="size-4 shrink-0 text-ink-500" />
              <a
                href="mailto:contato@autopremium.com.br"
                className="transition-colors hover:text-white"
              >
                contato@autopremium.com.br
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-500" />
              <span>São Paulo, SP</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-800 px-4 py-6 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} AutoPremium. Todos os direitos reservados.
      </div>
    </footer>
  );
}
