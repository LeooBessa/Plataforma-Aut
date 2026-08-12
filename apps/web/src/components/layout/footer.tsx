import Image from 'next/image';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';

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
          {/* Sem telefone, e-mail ou endereço.
              Não é loja física, e os dados reais de contato ainda não existem —
              o que estava aqui era o placeholder do seed (um telefone de São
              Paulo inventado). Contato falso é pior que contato ausente: o
              visitante liga, não é atendido, e a conclusão dele é que a loja não
              existe. Enquanto isso, o agendamento pelo site é o canal, e ele
              funciona de verdade. */}
          <ul className="mt-5 space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-white/35" />
              <span className="text-white/70">
                Agende uma visita pelo site e entramos em contato para confirmar.
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
