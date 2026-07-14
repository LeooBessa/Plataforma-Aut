import axios, { AxiosError, type AxiosInstance } from 'axios';

/**
 * Cliente HTTP do BROWSER.
 *
 * `baseURL: '/api/v1'` — relativo, de propósito. O browser fala com a própria
 * origem do site, e o Next repassa ao FastAPI (ver o `rewrites` em
 * next.config.ts). Assim o cookie httpOnly do refresh token é primário, e não
 * de terceiros — que os navegadores bloqueiam.
 *
 * O access token vive em MEMÓRIA, nunca em localStorage. localStorage é legível
 * por qualquer script injetado na página: um XSS levaria o token embora. Em
 * memória, ele morre com a aba — e a sessão é reconstruída pelo cookie httpOnly,
 * que o JavaScript não alcança.
 */

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

/** Mensagem legível a partir de qualquer erro do axios. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const apiMessage = error.response?.data?.error?.message;
    if (apiMessage) return apiMessage;

    if (error.code === 'ERR_NETWORK') {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    }
  }
  return 'Algo deu errado. Tente novamente.';
}

export const http: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  // Sem isto o cookie de refresh simplesmente não é enviado, e a sessão morre
  // em 15 minutos sem possibilidade de renovação.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/**
 * Renovação silenciosa da sessão.
 *
 * O access token dura 15 minutos. Quando expira, este interceptor troca o cookie
 * de refresh por um token novo e REFAZ a requisição original — o usuário não
 * percebe nada. Sem isso, ele seria deslogado no meio do cadastro de um anúncio
 * e perderia o trabalho.
 */

// Uma promise compartilhada por todas as requisições que falharem ao mesmo tempo.
//
// Sem ela, se três chamadas expirarem juntas (o que é comum numa tela que carrega
// vários dados), seriam três refreshes simultâneos. E como o refresh ROTACIONA o
// token, o segundo apresentaria um token já queimado — o backend interpretaria
// como roubo e revogaria TODAS as sessões do usuário. Ou seja: a falta desta
// trava deslogaria o admin do nada, sem explicação.
let refreshing: Promise<string> | null = null;

async function refreshSession(): Promise<string> {
  refreshing ??= axios
    .post<{ access_token: string }>('/api/v1/auth/refresh', null, { withCredentials: true })
    .then((response) => {
      const token = response.data.access_token;
      setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

type RetriableConfig = AxiosError['config'] & { _retried?: boolean };

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;

    const shouldRefresh =
      error.response?.status === 401 &&
      config &&
      // `_retried` impede o laço infinito: se a requisição JÁ foi repetida e
      // falhou de novo com 401, a sessão realmente acabou.
      !config._retried &&
      // Um 401 vindo do próprio /auth/refresh ou do /auth/login significa que
      // não há sessão para renovar. Tentar renovar aqui seria recursão.
      !config.url?.includes('/auth/refresh') &&
      !config.url?.includes('/auth/login');

    if (shouldRefresh) {
      config._retried = true;

      try {
        const token = await refreshSession();
        config.headers.Authorization = `Bearer ${token}`;
        return http.request(config);
      } catch {
        setAccessToken(null);
        // Deixa o erro subir: quem chamou decide o que fazer (o layout do admin
        // redireciona para o login).
      }
    }

    return Promise.reject(error);
  },
);
