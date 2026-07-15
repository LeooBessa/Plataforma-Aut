import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // O painel e a API não devem ser indexados: são áreas internas, sem valor
      // de busca, e listá-las no Google só as expõe a curiosos. O bloqueio aqui
      // é orientação ao rastreador, não segurança — a proteção real é o JWT.
      disallow: ['/admin/', '/api/'],
    },
    // Aponta o Google direto para o mapa. Sem esta linha, ele precisaria
    // adivinhar que o sitemap existe.
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
