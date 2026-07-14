/**
 * Formatação para o usuário brasileiro.
 *
 * Estas funções existem para que ninguém escreva `R$ ${preco}` solto num
 * componente: o preço viria "R$ 129900.00" em vez de "R$ 129.900", e o site
 * pareceria amador na primeira olhada.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  // Carro não tem centavos no anúncio. "R$ 129.900,00" polui; "R$ 129.900" lê melhor.
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat('pt-BR');

/** A API devolve Decimal como string ("129900.00") para não perder precisão. */
export function formatPrice(value: string | number): string {
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(numeric)) return '—';
  return BRL.format(numeric);
}

export function formatMileage(km: number): string {
  if (km === 0) return '0 km';
  return `${NUMBER.format(km)} km`;
}

/** "2022/2023" — no Brasil o comprador olha fabricação E modelo. */
export function formatYears(manufacture: number, model: number): string {
  return manufacture === model ? String(model) : `${manufacture}/${model}`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso));
}

/** "14:30" a partir de "14:30:00". */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** Link de WhatsApp a partir do telefone só com dígitos. */
export function whatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${withCountry}${text}`;
}

/** "(11) 99999-8888" a partir de "11999998888". */
export function formatPhone(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return digits;
}
