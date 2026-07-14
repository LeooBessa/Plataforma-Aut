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
      <div className="flex min-h-dvh items-center justify-center bg-ink-50">
        <div className="size-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-ink-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-ink-100 px-5">
          <span className="flex size-9 items-center justify-center rounded-btn bg-ink-950 text-white">
            <Car className="size-5" />
          </span>
          <span className="font-bold tracking-tight text-ink-950">
            Auto<span className="text-brand-600">Premium</span>
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
                  'flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                <Icon className="size-4.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-100 p-3">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-ink-900">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-1 flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-danger-50 hover:text-danger-700"
          >
            <LogOut className="size-4.5" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navegação do topo — some no desktop, onde a lateral assume. */}
        <header className="flex h-16 items-center gap-1 border-b border-ink-200 bg-white px-4 lg:hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  'flex size-10 items-center justify-center rounded-btn transition-colors',
                  active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-50',
                )}
              >
                <Icon className="size-5" />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void logout()}
            className="ml-auto flex size-10 items-center justify-center rounded-btn text-ink-500 transition-colors hover:bg-danger-50 hover:text-danger-700"
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
