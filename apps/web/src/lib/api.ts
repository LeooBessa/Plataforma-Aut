import 'server-only';

import type { components } from '@/types/api';

/**
 * Cliente da API, para uso em SERVER COMPONENTS.
 *
 * `import 'server-only'` no topo não é decoração: se alguém importar este módulo
 * num Client Component por engano, o build QUEBRA. Sem isso, o erro seria
 * silencioso — variáveis de ambiente sem o prefixo NEXT_PUBLIC_ viram string
 * vazia no browser, e o fetch iria para `undefined/api/v1/...`.
 *
 * Aqui falamos DIRETO com o FastAPI, sem passar pelo rewrite do Next: o rewrite
 * existe para o navegador (cookie same-origin), e usá-lo no servidor só
 * adicionaria um salto de rede inútil.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:8000';

type Schemas = components['schemas'];

export type VehicleSummary = Schemas['VehicleSummaryOut'];
export type VehicleDetail = Schemas['VehicleDetailOut'];
export type VehiclePage = Schemas['VehiclePageOut'];
export type FilterOptions = Schemas['FilterOptionsOut'];
export type Appointment = Schemas['AppointmentOut'];
export type DashboardStats = Schemas['DashboardStatsOut'];
export type Image = Schemas['ImageOut'];
export type Feature = Schemas['FeatureOut'];
export type FuelType = Schemas['FuelType'];
export type TransmissionType = Schemas['TransmissionType'];
export type BodyType = Schemas['BodyType'];
export type VehicleStatus = Schemas['VehicleStatus'];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type FetchOptions = {
  /** Segundos de cache. `0` = sempre fresco. */
  revalidate?: number;
  /** Tags para invalidação sob demanda quando o admin editar um anúncio. */
  tags?: string[];
};

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { revalidate = 60, tags = [] } = options;

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    // No Next 16, `fetch` NÃO é cacheado por padrão e BLOQUEIA o render até
    // responder. Sem estas opções, cada visita à home iria ao banco de novo — e
    // a página ficaria refém da latência da API.
    next: { revalidate, tags },
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    let message = `Erro ${response.status} ao consultar a API.`;
    let code: string | undefined;

    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
      code = body?.error?.code;
    } catch {
      // Resposta sem corpo JSON (502 do proxy, timeout). Fica a mensagem padrão.
    }

    throw new ApiError(message, response.status, code);
  }

  return response.json() as Promise<T>;
}

// --------------------------------------------------------------------- veículos

export type VehicleSearchParams = {
  q?: string;
  brand?: string;
  model?: string;
  year_min?: number;
  year_max?: number;
  price_min?: number;
  price_max?: number;
  city?: string;
  fuel?: FuelType[];
  transmission?: TransmissionType[];
  body?: BodyType[];
  features?: string[];
  featured?: boolean;
  sort?: string;
  page?: number;
  page_size?: number;
};

function toQueryString(params: VehicleSearchParams): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;

    // Listas viram parâmetros repetidos (`?fuel=flex&fuel=diesel`), que é o
    // formato que o FastAPI espera. Um join por vírgula chegaria como um único
    // valor "flex,diesel" e não casaria com enum nenhum.
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else {
      query.append(key, String(value));
    }
  }

  return query.toString();
}

export function listVehicles(params: VehicleSearchParams = {}): Promise<VehiclePage> {
  const qs = toQueryString(params);
  return request<VehiclePage>(`/vehicles${qs ? `?${qs}` : ''}`, {
    revalidate: 60,
    tags: ['vehicles'],
  });
}

export function listFeaturedVehicles(limit = 6): Promise<VehicleSummary[]> {
  return request<VehicleSummary[]>(`/vehicles/featured?limit=${limit}`, {
    revalidate: 300,
    tags: ['vehicles', 'featured'],
  });
}

export function getFilterOptions(): Promise<FilterOptions> {
  // Muda pouco (só quando entra uma marca ou cidade nova no catálogo), então
  // pode ficar em cache por bastante tempo.
  return request<FilterOptions>('/vehicles/filters', {
    revalidate: 900,
    tags: ['filters'],
  });
}

export function getVehicle(slug: string): Promise<VehicleDetail> {
  return request<VehicleDetail>(`/vehicles/${encodeURIComponent(slug)}`, {
    revalidate: 300,
    // Tag por veículo: quando o admin editar ESTE anúncio, invalidamos só a
    // página dele — e não o site inteiro.
    tags: ['vehicles', `vehicle:${slug}`],
  });
}

/**
 * Executa uma chamada à API sem derrubar a página se ela falhar.
 *
 * ============================================================================
 * POR QUE ISTO EXISTE
 * ============================================================================
 * A home e a listagem são geradas ESTATICAMENTE no build. Se a API estiver fora
 * naquele instante — um deploy em andamento, um cold start, um blip de rede — o
 * build inteiro do site falha. Descobri isso na prática: o `next build` abortou
 * com `ECONNREFUSED` porque a API não estava rodando.
 *
 * Em produção, isso significa que uma instabilidade momentânea da API impediria
 * o deploy do SITE. Pior: numa Vercel onde web e API são projetos separados, o
 * site poderia nunca conseguir buildar antes da API existir — um impasse.
 *
 * Com este wrapper, a página é publicada mesmo assim, mostrando um aviso honesto
 * em vez de conteúdo. O ISR a regenera assim que a API voltar.
 *
 * O que NÃO fazemos: fingir que "não há veículos". Isso esconderia uma queda da
 * API atrás de uma tela plausível — e ninguém iria investigar.
 */
export async function safely<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    console.error('[api] falha ao carregar dados:', error);
    return null;
  }
}
