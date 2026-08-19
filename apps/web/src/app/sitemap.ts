import type { MetadataRoute } from 'next';

import { listArticles, listVehicles, safely } from '@/lib/api';

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

//: Teto que a API aceita em `page_size`. Pedir mais é recusado, e o `safely`
//: transformaria a recusa numa lista vazia sem erro visível.
const POR_PAGINA = 48;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/veiculos`, changeFrequency: 'hourly', priority: 0.9 },
    // Prioridade alta para a listagem de artigos: é a porta de entrada de quem
    // chega pela busca sem estar procurando carro ainda, e cada artigo dela é
    // uma URL que pode ranquear sozinha.
    { url: `${SITE_URL}/artigos`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/sobre`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/contato`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  // ARTIGOS antes dos veículos, e sem `return` antecipado no meio.
  //
  // A ordem importa por causa da guarda logo abaixo: se a chamada dos veículos
  // falhar, a função devolve o que tem e sai. Buscar os artigos depois disso
  // faria o sitemap perder os artigos toda vez que a listagem de carros
  // engasgasse — dois assuntos independentes derrubando um ao outro.
  const articleRoutes: MetadataRoute.Sitemap = [];
  const primeira = await safely(listArticles(POR_PAGINA));

  if (primeira) {
    const paginas = Math.ceil((primeira.meta.total ?? 0) / POR_PAGINA);
    const acumular = (items: typeof primeira.items) => {
      for (const a of items) {
        articleRoutes.push({
          url: `${SITE_URL}/artigos/${a.slug}`,
          // `lastModified` real: é o que faz o Google revisitar o artigo quando
          // o texto muda, em vez de re-rastrear na cega.
          lastModified: new Date(a.updated_at),
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    };

    acumular(primeira.items);
    for (let p = 2; p <= paginas; p++) {
      const proxima = await safely(listArticles(POR_PAGINA, p));
      if (proxima) acumular(proxima.items);
    }
  }

  // `safely`: se a API estiver fora, o sitemap ainda é gerado com as rotas
  // estáticas — em vez de quebrar e deixar o Google sem mapa nenhum.
  const page = await safely(listVehicles({ page_size: 48, sort: 'newest' }));

  if (!page) return [...staticRoutes, ...articleRoutes];

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

  return [...staticRoutes, ...articleRoutes, ...vehicleRoutes];
}
