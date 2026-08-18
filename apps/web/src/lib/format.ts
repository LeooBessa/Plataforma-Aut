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
  // Preço que não converte é dado corrompido, não campo em branco. "Consulte"
  // manda o visitante falar com a loja em vez de exibir um símbolo que não
  // explica nada.
  if (Number.isNaN(numeric)) return 'Consulte';
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

// ============================================================================
// MÁSCARAS DE ENTRADA
// ============================================================================
// Diferentes das funções acima: aquelas formatam para EXIBIR, estas formatam
// enquanto a pessoa DIGITA. Todas descartam o que não é dígito, e é isso que
// resolve o problema do `type="number"` do HTML — ele aceita `e`, `+` e `-`,
// então dá para digitar "1e5" ou "-2000" num campo de quilometragem.
//
// A troca é `type="text"` + `inputMode="numeric"`: o teclado do celular continua
// numérico, mas o campo passa a aceitar só o que a máscara deixar entrar.

/** Só os dígitos, opcionalmente limitados a um máximo. */
export function onlyDigits(value: string, max?: number): string {
  const digits = value.replace(/\D/g, '');
  return max ? digits.slice(0, max) : digits;
}

/**
 * Telefone brasileiro, com a máscara aparecendo conforme se digita.
 *
 * Vai montando: "84" → "(84)", "849998" → "(84) 9998", e o hífen entra quando
 * há dígitos suficientes para saber onde ele cai. Fixo (10 dígitos) quebra em
 * 4+4; celular (11) em 5+4.
 *
 * O DDD NÃO é predefinido de propósito: a loja é de Natal, mas quem anuncia
 * pode estar em qualquer lugar, e um "84" já preenchido faria alguém de outro
 * estado enviar o número errado sem perceber.
 */
export function maskPhone(value: string): string {
  const d = onlyDigits(value, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Separador de milhar enquanto digita: "48000" vira "48.000".
 *
 * Serve a quilometragem e preço. Sem ele, "92000" e "920000" são fáceis de
 * confundir de relance — e a diferença entre os dois é o carro inteiro.
 *
 * Não aceita centavos, de propósito: ninguém vende carro por R$ 92.000,50, e
 * deixar a vírgula entrar traria o problema oposto — quem digitasse "92,000"
 * pedindo noventa e dois mil enviaria noventa e dois.
 */
export function maskThousands(value: string): string {
  const d = onlyDigits(value);
  return d ? Number(d).toLocaleString('pt-BR') : '';
}
