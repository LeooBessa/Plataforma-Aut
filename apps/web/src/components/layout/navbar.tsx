'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

// ARTIGOS NÃO ENTRA AQUI, e isso é decisão de produto.
//
// O menu do topo é a lista curta do que a loja vende: carros, quem ela é, como
// falar com ela. Artigo é conteúdo de apoio — quem chega procurando carro não
// veio ler texto, e um item a mais no topo dilui os que importam.
//
// Os artigos entram pela página Sobre, que é o institucional, e cada um tem
// endereço próprio (`/artigos/<slug>`) que o Google indexa e que o destaque do
// topo da home aponta. Sair do menu não os torna invisíveis: as duas portas de
// entrada que realmente trazem visita — busca e destaque — continuam abertas.
const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/veiculos', label: 'Veículos' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/contato', label: 'Contato' },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // BARRA PRETA NA HOME DO CELULAR, para encostar no topo escuro.
  //
  // Abaixo do `lg` a home tem a foto como fundo, com véu escuro. Uma barra
  // branca ali cortava a página em duas e devolvia justamente o branco que a
  // foto de fundo veio resolver.
  //
  // Só na home e só abaixo do `lg`: nas outras páginas o conteúdo começa
  // branco logo abaixo da barra, e escurecê-la seria enfeite sem motivo. No
  // desktop a home é clara à esquerda, onde a barra encosta.
  //
  // Ela continua PRETA depois de rolar, quando o conteúdo já é branco. Fazer a
  // cor mudar na rolagem exigiria escutar o scroll em JavaScript para ganhar
  // pouco — e barra preta sobre página branca lê como moldura, não como erro.
  const topoEscuro = pathname === '/';

  return (
    // `sticky` em vez de `fixed`: acompanha a rolagem sem tirar o conteúdo do
    // fluxo. Com `fixed`, seria preciso um padding compensatório no topo de
    // todas as páginas — e alguém sempre esquece numa delas.
    //
    // SEM borda embaixo: a linha separava a navbar do hero. O fundo semiopaco
    // com desfoque (`backdrop-blur`) já destaca a barra do conteúdo que rola por
    // baixo, sem precisar de traço.
    <header
      className={cn(
        'sticky top-0 z-50 backdrop-blur-xl',
        topoEscuro ? 'bg-inverse lg:bg-canvas/85' : 'bg-canvas/85',
      )}
    >
      {/* `relative` para o menu poder ser centralizado em relação à barra
          inteira, e não ao espaço que sobra entre logo e ações. */}
      <nav className="relative mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        {/* Sem aria-label: o texto visível "Giro Auto" já nomeia o link. Um
            aria-label diferente do texto quebraria o controle por voz. */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* Símbolo + palavra. Duas versões do símbolo existem: a de traço
              PRETO para fundo claro e a CLARA para fundo escuro — a mesma que o
              rodapé já usava. Na home do celular a barra é preta, então entra a
              clara; do `lg` para cima a barra volta a ser branca e a preta
              reaparece.
              A troca é por CSS, não por JavaScript: assim a versão certa já vem
              no primeiro quadro, sem piscar a errada enquanto a página hidrata.
              `alt=""` porque o texto ao lado já nomeia o link — descrever a
              imagem faria o leitor de tela anunciar a marca duas vezes. */}
          {topoEscuro && (
            <Image
              src="/giro-auto-logo-clara.png"
              alt=""
              width={497}
              height={512}
              className="h-9 w-auto lg:hidden"
              priority
            />
          )}
          <Image
            src="/giro-auto-logo.png"
            alt=""
            width={497}
            height={512}
            className={cn('h-9 w-auto', topoEscuro && 'hidden lg:block')}
            priority
          />
          <span
            className={cn(
              'font-logo text-2xl font-[700] tracking-[0.16em]',
              topoEscuro ? 'lg:text-content text-white' : 'text-content',
            )}
          >
            Giro Auto
          </span>
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
            className={cn(
              'rounded-btn flex size-10 items-center justify-center transition-colors',
              topoEscuro
                ? 'lg:text-muted lg:hover:bg-sunken lg:hover:text-content text-white/80 hover:bg-white/10 hover:text-white'
                : 'text-muted hover:bg-sunken hover:text-content',
            )}
            aria-label="Pesquisar veículos"
          >
            <Search className="size-5" />
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'rounded-btn flex size-10 items-center justify-center transition-colors md:hidden',
              topoEscuro
                ? 'text-white/80 hover:bg-white/10 hover:text-white'
                : 'text-muted hover:bg-sunken',
            )}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div
          className={cn(
            'border-t md:hidden',
            topoEscuro ? 'bg-inverse border-white/10' : 'border-line bg-canvas',
          )}
        >
          <ul className="space-y-1 px-4 py-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'rounded-btn block px-3 py-3 text-sm transition-colors',
                    topoEscuro
                      ? pathname === link.href
                        ? 'text-brand-400 bg-white/10'
                        : 'text-white/75 hover:bg-white/10'
                      : pathname === link.href
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
