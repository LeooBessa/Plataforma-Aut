import type { NextConfig } from 'next';

/** No servidor falamos DIRETO com o FastAPI; no browser, tudo passa pelo rewrite abaixo. */
const API_URL = process.env.API_URL ?? 'http://localhost:8000';

const SUPABASE_HOSTNAME = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname
  : 'lwsbrnrlawqiiahlhvqj.supabase.co';

const nextConfig: NextConfig = {
  // Rotas tipadas: um <Link href="/veiculo/x"> com typo vira erro de compilação,
  // em vez de um 404 que só aparece em produção.
  typedRoutes: true,

  /**
   * O REWRITE QUE FAZ O LOGIN FUNCIONAR.
   *
   * O browser fala apenas com a origem do site (`/api/...`), e o Next repassa
   * internamente para o FastAPI. Da ótica do navegador, é tudo mesma origem.
   *
   * Por que é essencial: sem domínio próprio, web e API ficam em domínios
   * diferentes (`x.vercel.app` e `y.vercel.app`). O cookie httpOnly do refresh
   * token viraria cookie de TERCEIROS — que os navegadores estão bloqueando. O
   * login funcionaria no meu teste e falharia no usuário, de forma intermitente
   * e dependente de navegador. É um bug caríssimo de diagnosticar.
   *
   * Com o rewrite, o cookie é primário (SameSite=Lax) e sempre funciona. Quando
   * o domínio próprio chegar, muda-se uma variável de ambiente.
   *
   * As chamadas do SERVIDOR não passam por aqui: vão direto ao FastAPI, sem o
   * salto extra.
   */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },

  images: {
    // Apenas o bucket público do Supabase. Um `remotePatterns` sem restrição de
    // caminho permitiria que terceiros usassem o nosso otimizador de imagens
    // como proxy — e a conta da banda seria nossa.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: SUPABASE_HOSTNAME,
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Placeholders do seed. Sai quando houver fotos reais.
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
