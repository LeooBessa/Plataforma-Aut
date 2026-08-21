import type { NextConfig } from 'next';

/** No servidor falamos DIRETO com o FastAPI; no browser, tudo passa pelo rewrite abaixo. */
const API_URL = process.env.API_URL ?? 'http://localhost:8000';

// O hostname do Storage vem de SUPABASE_URL. Sem fallback hardcoded: baixar o
// project ref no código-fonte revela qual projeto Supabase é o nosso — sem
// motivo, ainda mais num repositório público. Sem a env var, o `next/image`
// simplesmente não libera domínio externo nenhum (mais seguro que um default).
const SUPABASE_HOSTNAME = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname
  : undefined;

const isDev = process.env.NODE_ENV === 'development';

/**
 * Content-Security-Policy.
 *
 * A última classe de header que faltava, e a que mais importa: os outros mitigam
 * ataques, este limita o ESTRAGO de um XSS. Sem CSP, um script injetado faz o que
 * quiser — inclusive chamar a nossa API com a sessão do admin e mandar os dados
 * para fora. Com CSP, ele não consegue carregar código de outro domínio, não
 * consegue exfiltrar para um host arbitrário, e não consegue sequestrar um form.
 *
 * ------------------------------------------------------------------------------
 * O COMPROMISSO DO 'unsafe-inline' EM script-src — leia antes de "melhorar"
 * ------------------------------------------------------------------------------
 * O App Router injeta scripts INLINE em toda página (o payload de hidratação,
 * `self.__next_f.push(...)`). Para bloqueá-los seria preciso um nonce por
 * requisição, e nonce exige gerar HTML a cada visita — ou seja, DESLIGAR o
 * cache/ISR que este projeto construiu de propósito (ver lib/api.ts). Trocar a
 * performance de todas as páginas por uma defesa parcial contra um XSS que ainda
 * não existe é um mau negócio para um site cujo conteúdo é 100% texto escapado
 * pelo React e sem nenhum `dangerouslySetInnerHTML` que aceite entrada de usuário.
 *
 * O que continua valendo, mesmo com 'unsafe-inline': `script-src` sem host
 * externo barra `<script src="evil.com">`; `connect-src` barra a exfiltração;
 * `form-action` barra o roubo de credencial por form reescrito; `object-src` e
 * `base-uri` fecham vetores antigos. O CSP não é só sobre inline.
 */
function contentSecurityPolicy(): string {
  // O browser do admin faz PUT DIRETO no Storage (ver image-uploader.tsx). Sem o
  // host do Supabase aqui, o upload de fotos quebra — e o erro no console não
  // explica o motivo.
  const supabase = SUPABASE_HOSTNAME ? `https://${SUPABASE_HOSTNAME}` : '';

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'unsafe-eval' só em dev: o HMR do Next compila módulos com eval.
    'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // O Next e o Tailwind injetam <style> inline; sem 'unsafe-inline' a página
    // renderiza sem estilo nenhum.
    'style-src': ["'self'", "'unsafe-inline'"],
    // `data:`/`blob:` para as prévias locais do uploader antes de subir a foto.
    // As fotos publicadas passam pelo otimizador do Next (mesma origem), mas o
    // host do Supabase entra para o caso de uma URL direta.
    'img-src': ["'self'", 'data:', 'blob:', supabase, 'https://picsum.photos'],
    // next/font/google baixa a fonte no BUILD e a serve de /_next/static — não há
    // requisição a fonts.gstatic.com em runtime, então 'self' basta.
    'font-src': ["'self'", 'data:'],
    // `blob:` é obrigatório aqui, e a ausência dele quebrou o upload de fotos em
    // produção. A `browser-image-compression` comprime a imagem num Web Worker
    // que ela mesma monta em tempo de execução: `URL.createObjectURL(new Blob(…))`
    // seguido de `new Worker(url)`. Sem `worker-src`, o navegador cai na cadeia
    // `child-src` → `script-src` → `default-src`, e nenhum deles libera `blob:`.
    //
    // O Worker morria antes de qualquer requisição de rede, então o sintoma era
    // "não consigo adicionar foto" sem nada aparecer no servidor — o upload
    // falhava no passo 1 de 4, antes de sequer pedir a URL assinada.
    //
    // Não afrouxa nada na prática: com `'unsafe-inline'` já em `script-src`, quem
    // conseguisse executar script na página não ganha capacidade nova por poder
    // criar um worker.
    'worker-src': ["'self'", 'blob:'],
    'connect-src': ["'self'", supabase, ...(isDev ? ['ws:'] : [])],
    // Complementa o X-Frame-Options: DENY (que navegadores novos ignoram em favor
    // deste).
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.filter(Boolean).join(' ')}`)
    .join('; ');

  // Em dev o site roda em http://localhost, e este diretivo tentaria promover
  // tudo para https — quebrando o ambiente local.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

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

  /**
   * Headers de segurança em todas as páginas.
   *
   * Estes fecham classes inteiras de ataque no navegador. Um verificador de
   * segurança cobra cada um deles, e adicioná-los depois de um incidente custa
   * muito mais do que adicioná-los agora.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Força HTTPS por 2 anos, inclusive subdomínios. Depois da primeira
          // visita, o navegador nunca mais tenta HTTP — fechando o ataque de
          // downgrade em que alguém intercepta a conexão insegura inicial.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Limita o que a página pode carregar e para onde pode falar. Ver
          // `contentSecurityPolicy()` acima — inclusive o porquê do 'unsafe-inline'.
          { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
          // O navegador não "adivinha" o tipo do conteúdo (vetor de XSS).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Ninguém embute o site num iframe: fecha clickjacking.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
        ],
      },
    ];
  },

  images: {
    // Apenas o bucket público do Supabase. Um `remotePatterns` sem restrição de
    // caminho permitiria que terceiros usassem o nosso otimizador de imagens
    // como proxy — e a conta da banda seria nossa.
    //
    // O padrão do Supabase só entra se SUPABASE_URL existir. Em produção ela
    // sempre existe; sem ela (ex: build de CI sem env), o site ainda builda,
    // apenas não libera imagens externas.
    remotePatterns: [
      ...(SUPABASE_HOSTNAME
        ? [
            {
              protocol: 'https' as const,
              hostname: SUPABASE_HOSTNAME,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
      {
        // Placeholders do seed. Sai quando houver fotos reais.
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],

    // O NEXT 16 TRAVA A QUALIDADE EM 75 se esta lista não existir: qualquer
    // `quality` diferente do padrão devolve 400. Foi o que segurava as fotos
    // dos carros num patamar de blog quando elas são o produto da loja.
    //
    // 75 continua sendo o padrão, usado por logo e imagens acessórias. 90 é
    // para a foto do veículo e a capa do artigo — em AVIF a diferença de peso é
    // pequena, e é justamente em pintura de carro e céu que o 75 aparece,
    // porque degradê suave é onde artefato de compressão fica visível.
    qualities: [75, 90, 95],
  },
};

export default nextConfig;
