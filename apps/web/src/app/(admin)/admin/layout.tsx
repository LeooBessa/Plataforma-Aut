'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Car, LayoutDashboard, LogOut } from 'lucide-react';

import { useAuth } from '@/features/auth/auth-provider';
import { cn } from '@/lib/utils';

/**
 * Layout do painel — e o portão de entrada dele.
 *
 * A proteção fica AQUI, no layout, e não em cada página. Assim uma tela nova do
 * admin nasce protegida por construção: não há como esquecer de proteger, porque
 * não há nada a lembrar.
 *
 * ATENÇÃO — esta é uma barreira de EXPERIÊNCIA, não de segurança. Ela evita que
 * o usuário veja um painel vazio e piscando. A segurança de verdade está no
 * backend: toda rota /admin da API exige JWT e devolve 401/403. Se alguém burlar
 * esta tela pelo devtools, verá um painel que não carrega dado nenhum.
 *
 * Confiar em verificação de front para segurança é o erro clássico — o cliente
 * está sempre sob controle do atacante.
 */

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/veiculos', label: 'Anúncios', icon: Car },
  { href: '/admin/agendamentos', label: 'Agendamentos', icon: Calendar },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace('/admin/login');
    }
  }, [loading, user, isLoginPage, router]);

  // A tela de login não recebe a moldura do painel.
  if (isLoginPage) return <>{children}</>;

  // Enquanto reconstruímos a sessão pelo cookie, não mostramos nem o painel nem
  // o login. Piscar a tela de login para quem ESTÁ logado é um bug visível e
  // desconcertante.
  if (loading || !user) {
    return (
      <div className="bg-ink-950 flex min-h-dvh items-center justify-center">
        <div className="border-ink-800 border-t-brand-600 size-8 animate-spin rounded-full border-2" />
      </div>
    );
  }

  return (
    <div className="bg-ink-950 flex min-h-dvh">
      <aside className="border-ink-800 hidden w-64 shrink-0 flex-col border-r bg-ink-900 lg:flex">
        <div className="border-ink-800 flex h-16 items-center gap-2.5 border-b px-5">
          <span className="rounded-btn border-brand-600/30 bg-brand-600/10 text-brand-400 flex size-9 items-center justify-center border">
            <Car className="size-5" />
          </span>
          <span className="text-gold-gradient text-sm font-semibold tracking-[0.2em]">
            ÂUREON
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-btn flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-600/10 text-brand-300'
                    : 'text-silver-400 hover:bg-ink-850 hover:text-silver-100',
                )}
              >
                <Icon className="size-4.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-ink-800 border-t p-3">
          <div className="px-3 py-2">
            <p className="text-silver-100 truncate text-sm font-medium">{user.name}</p>
            <p className="text-silver-500 truncate text-xs">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-btn text-silver-400 hover:bg-danger-500/10 hover:text-danger-400 mt-1 flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <LogOut className="size-4.5" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navegação do topo — some no desktop, onde a lateral assume. */}
        <header className="border-ink-800 flex h-16 items-center gap-1 border-b bg-ink-900 px-4 lg:hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  'rounded-btn flex size-10 items-center justify-center transition-colors',
                  active ? 'bg-brand-600/10 text-brand-300' : 'text-silver-500 hover:bg-ink-850',
                )}
              >
                <Icon className="size-5" />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-btn text-silver-500 hover:bg-danger-500/10 hover:text-danger-400 ml-auto flex size-10 items-center justify-center transition-colors"
            aria-label="Sair"
          >
            <LogOut className="size-5" />
          </button>
        </header>

        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
