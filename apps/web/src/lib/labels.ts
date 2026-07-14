import type { BodyType, FuelType, TransmissionType, VehicleStatus } from '@/lib/api';

/**
 * Dicionário PT-BR dos enums da API.
 *
 * O banco e a API falam inglês (`flex`, `dual_clutch`, `sold`); a interface fala
 * português. Esta é a fronteira entre os dois — e é o que permite internacionalizar
 * depois sem tocar no backend.
 *
 * `Record<Tipo, string>` é o detalhe importante: se alguém adicionar um valor
 * novo ao enum no Python e regenerar os tipos, o TypeScript passa a EXIGIR a
 * tradução aqui. Sem isso, o valor novo apareceria cru na tela ("dual_clutch")
 * e ninguém perceberia até um cliente reclamar.
 */

export const FUEL_LABELS: Record<FuelType, string> = {
  flex: 'Flex',
  gasoline: 'Gasolina',
  ethanol: 'Etanol',
  diesel: 'Diesel',
  electric: 'Elétrico',
  hybrid: 'Híbrido',
  gnv: 'GNV',
};

export const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  manual: 'Manual',
  automatic: 'Automático',
  cvt: 'CVT',
  automated: 'Automatizado',
  dual_clutch: 'Dupla embreagem',
};

export const BODY_LABELS: Record<BodyType, string> = {
  hatch: 'Hatch',
  sedan: 'Sedã',
  suv: 'SUV',
  pickup: 'Picape',
  coupe: 'Cupê',
  convertible: 'Conversível',
  wagon: 'Perua',
  minivan: 'Minivan',
  van: 'Van',
};

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  draft: 'Rascunho',
  active: 'Disponível',
  reserved: 'Reservado',
  sold: 'Vendido',
  archived: 'Arquivado',
};

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Mais relevantes' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'year_desc', label: 'Mais novos' },
  { value: 'mileage_asc', label: 'Menor quilometragem' },
  { value: 'newest', label: 'Anúncios recentes' },
] as const;
