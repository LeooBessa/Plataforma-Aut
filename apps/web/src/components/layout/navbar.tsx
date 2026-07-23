'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';

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
    //
    // SEM borda embaixo: a linha separava a navbar do hero. O fundo semiopaco
    // com desfoque (`backdrop-blur`) já destaca a barra do conteúdo que rola por
    // baixo, sem precisar de traço.
    <header className="bg-canvas/85 sticky top-0 z-50 backdrop-blur-xl">
      {/* `relative` para o menu poder ser centralizado em relação à barra
          inteira, e não ao espaço que sobra entre logo e ações. */}
      <nav className="relative mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
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

        {/* CENTRALIZADO na barra: posicionado no meio absoluto, não empurrado
            pelo logo à esquerda. Assim fica centrado de verdade, independente da
            largura do logo ou das ações à direita. */}
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
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

        {/* O acesso ao painel é só pela URL /admin — não há botão de admin na
            barra pública de propósito. */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/veiculos"
            className="rounded-btn text-muted hover:bg-sunken hover:text-content flex size-10 items-center justify-center transition-colors"
            aria-label="Pesquisar veículos"
          >
            <Search className="size-5" />
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
          </ul>
        </div>
      )}
    </header>
  );
}
