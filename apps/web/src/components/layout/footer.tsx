import Link from 'next/link';
import { Car, Mail, MapPin, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-ink-800 bg-ink-950 text-ink-300 mt-24 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-btn text-ink-950 flex size-9 items-center justify-center bg-white">
              <Car className="size-5" />
            </span>
            <span className="text-lg font-bold text-white">
              Auto<span className="text-brand-400">Premium</span>
            </span>
          </div>
          <p className="text-ink-400 mt-4 max-w-xs text-sm leading-relaxed">
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
              <Phone className="text-ink-500 size-4 shrink-0" />
              <a href="tel:+551133334444" className="transition-colors hover:text-white">
                (11) 3333-4444
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="text-ink-500 size-4 shrink-0" />
              <a
                href="mailto:contato@autopremium.com.br"
                className="transition-colors hover:text-white"
              >
                contato@autopremium.com.br
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="text-ink-500 mt-0.5 size-4 shrink-0" />
              <span>São Paulo, SP</span>
            </li>
          </ul>
        </div>
      </div>

      {/* text-ink-400, não ink-500: sobre fundo escuro, texto mais CLARO tem
          mais contraste. Com ink-500 o Lighthouse acusava 4.12 (o mínimo é 4.5). */}
      <div className="border-ink-800 text-ink-400 border-t px-4 py-6 text-center text-xs">
        © {new Date().getFullYear()} AutoPremium. Todos os direitos reservados.
      </div>
    </footer>
  );
}
