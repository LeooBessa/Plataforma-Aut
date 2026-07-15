import type { MetadataRoute } from 'next';

import { listVehicles, safely } from '@/lib/api';

/**
 * Sitemap — o mapa que o Google usa para descobrir todas as páginas.
 *
 * Sem ele, o rastreador depende de achar cada anúncio seguindo links. Com ele,
 * entregamos a lista pronta: todo veículo publicado é apontado explicitamente,
 * com a data da última alteração — o que faz o Google revisitar só o que mudou,
 * em vez de re-rastrear o site inteiro.
 *
 * É gerado sob demanda e cacheado (revalidate abaixo): num catálogo de milhares
 * de carros, montá-lo a cada requisição do Googlebot seria caro à toa.
 */

// O sitemap muda quando entra ou sai um anúncio. Uma hora de cache é o suficiente
// — o Google não rastreia de minuto em minuto.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/veiculos`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/sobre`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/contato`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  // `safely`: se a API estiver fora, o sitemap ainda é gerado com as rotas
  // estáticas — em vez de quebrar e deixar o Google sem mapa nenhum.
  const page = await safely(listVehicles({ page_size: 48, sort: 'newest' }));

  if (!page) return staticRoutes;

  // Traz o total; se houver mais de uma página de resultados, busca o resto.
  // Num catálogo grande isso importa: sem paginar, só os 48 primeiros carros
  // entrariam no sitemap e o resto ficaria invisível para a busca.
  const vehicleRoutes: MetadataRoute.Sitemap = [];
  const totalPages = page.meta.total_pages;

  const collect = (items: typeof page.items) => {
    for (const vehicle of items) {
      vehicleRoutes.push({
        url: `${SITE_URL}/veiculos/${vehicle.slug}`,
        changeFrequency: 'weekly',
        priority: vehicle.is_featured ? 0.8 : 0.7,
      });
    }
  };

  collect(page.items);

  for (let p = 2; p <= totalPages; p++) {
    const next = await safely(listVehicles({ page_size: 48, sort: 'newest', page: p }));
    if (next) collect(next.items);
  }

  return [...staticRoutes, ...vehicleRoutes];
}
