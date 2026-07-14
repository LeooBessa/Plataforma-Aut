'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { http, setAccessToken } from '@/lib/http';

/**
 * Sessão do administrador.
 *
 * O access token fica em MEMÓRIA (dentro do módulo `http`), nunca em localStorage.
 * Ao recarregar a página ele se perde — e é aí que entra o `bootstrap` abaixo:
 * chamamos `/auth/refresh`, que usa o cookie httpOnly (invisível ao JavaScript)
 * para reconstruir a sessão.
 *
 * Esse desenho é o que torna um XSS incapaz de roubar a sessão: não há token
 * algum ao alcance de um script injetado.
 */

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'seller';
};

type AuthState = {
  user: User | null;
  /** True enquanto tentamos reconstruir a sessão pelo cookie. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Reconstrói a sessão a partir do cookie httpOnly ao carregar a página.
  //
  // Sem isto, dar F5 no painel deslogaria o admin — porque o access token vive
  // só em memória.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await http.post<{ access_token: string; user: User }>('/auth/refresh');
        if (cancelled) return;
        setAccessToken(data.access_token);
        setUser(data.user);
      } catch {
        // Sem cookie válido: é só um visitante não autenticado. Não é erro.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await http.post<{ access_token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    setAccessToken(data.access_token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await http.post('/auth/logout');
    } finally {
      // Limpa o estado local MESMO se a chamada falhar. Um logout que não desloga
      // porque a rede caiu é pior do que não ter logout: o usuário acredita que
      // saiu, e não saiu.
      setAccessToken(null);
      setUser(null);
      router.push('/admin/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  }
  return context;
}
