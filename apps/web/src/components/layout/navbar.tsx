'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, LogIn, Menu, Search, X } from 'lucide-react';

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
    // `sticky top-0` em vez de `fixed`: a navbar acompanha a rolagem sem tirar o
    // conteúdo do fluxo. Com `fixed`, seria preciso um padding compensatório no
    // topo de todas as páginas — e alguém sempre esquece numa delas.
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/85 shadow-nav backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Página inicial">
          <span className="flex size-9 items-center justify-center rounded-btn bg-ink-950 text-white">
            <Car className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-ink-950">
            Auto<span className="text-brand-600">Premium</span>
          </span>
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
                    'rounded-btn px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-ink-100 text-ink-950'
                      : 'text-ink-600 hover:bg-ink-50 hover:text-ink-950',
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
            className="flex size-10 items-center justify-center rounded-btn text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950"
            aria-label="Pesquisar veículos"
          >
            <Search className="size-5" />
          </Link>

          <Link
            href="/admin/login"
            className="hidden items-center gap-2 rounded-btn border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50 sm:flex"
          >
            <LogIn className="size-4" />
            Admin
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-btn text-ink-700 transition-colors hover:bg-ink-100 md:hidden"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-ink-100 bg-white md:hidden">
          <ul className="space-y-1 px-4 py-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'block rounded-btn px-3 py-2.5 text-sm font-medium',
                    pathname === link.href
                      ? 'bg-ink-100 text-ink-950'
                      : 'text-ink-700 hover:bg-ink-50',
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
                className="flex items-center gap-2 rounded-btn px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
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
