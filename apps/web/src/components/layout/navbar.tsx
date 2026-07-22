'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn, Menu, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/veiculos', label: 'Veículos' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/contato', label: 'Contato' },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    // `sticky` em vez de `fixed`: acompanha a rolagem sem tirar o conteúdo do
    // fluxo. Com `fixed`, seria preciso um padding compensatório no topo de
    // todas as páginas — e alguém sempre esquece numa delas.
    <header className="border-line/80 bg-canvas/85 sticky top-0 z-50 border-b backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Sem aria-label: o texto visível "ÂUREON" já nomeia o link. Um
            aria-label diferente do texto quebraria o controle por voz. */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* Losango dourado + palavra preta.
              O degradê metálico do rodapé não serve aqui: o brilho no meio dele
              é quase branco e desapareceria no papel. O ouro entra como marca
              pequena, do tamanho de um detalhe — que é o papel dele neste tema. */}
          <span
            aria-hidden
            className="from-brand-400 to-brand-600 size-2 rotate-45 bg-gradient-to-br"
          />
          <span className="text-content text-lg font-semibold tracking-[0.2em]">ÂUREON</span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  // `aria-current` diz ao leitor de tela qual página está aberta.
                  // Sem ele, a indicação seria apenas visual.
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-btn px-3 py-2 text-sm transition-colors',
                    active ? 'text-accent' : 'text-muted hover:text-content',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/veiculos"
            className="rounded-btn text-muted hover:bg-sunken hover:text-content flex size-10 items-center justify-center transition-colors"
            aria-label="Pesquisar veículos"
          >
            <Search className="size-5" />
          </Link>

          <Link
            href="/admin/login"
            className="rounded-btn border-line-strong text-muted hover:border-brand-600/50 hover:text-accent hidden items-center gap-2 border px-4 py-2 text-sm transition-colors sm:flex"
          >
            <LogIn className="size-4" />
            Admin
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-btn text-muted hover:bg-sunken flex size-10 items-center justify-center transition-colors md:hidden"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-line bg-canvas border-t md:hidden">
          <ul className="space-y-1 px-4 py-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'rounded-btn block px-3 py-2.5 text-sm transition-colors',
                    pathname === link.href
                      ? 'bg-surface text-accent'
                      : 'text-muted hover:bg-surface',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <Link
                href="/admin/login"
                onClick={() => setOpen(false)}
                className="rounded-btn text-muted hover:bg-surface flex items-center gap-2 px-3 py-2.5 text-sm"
              >
                <LogIn className="size-4" />
                Área do administrador
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
