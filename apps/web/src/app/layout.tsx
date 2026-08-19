import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';

import './globals.css';

// As fontes são auto-hospedadas pelo Next em build time — não há requisição ao
// Google em runtime. Isso tira uma conexão externa do caminho crítico e elimina
// o "flash of unstyled text", em que o texto aparece numa fonte e salta para
// outra quando a definitiva carrega.
//
// ----------------------------------------------------------------------------
// POR QUE BARLOW, E NÃO INTER
// ----------------------------------------------------------------------------
// Inter é a fonte padrão de praticamente todo site gerado por ferramenta: ela
// não erra, mas também não diz nada, e um site inteiro nela lê como template.
//
// Barlow nasceu inspirada na sinalização de rodovia da Califórnia. É levemente
// quadrada e de contraste baixo, com jeito de placa e de painel de carro — numa
// revenda, ela pertence ao assunto em vez de ser só "uma fonte limpa".
//
// Nenhuma das duas é variável no Google Fonts, então os pesos vão declarados um
// a um. Pedir o que não se usa engorda o download sem nada em troca.
const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-barlow',
});

// A condensada é só para TÍTULO. Ela ganha presença no tamanho grande e cabe
// mais palavra por linha — o que resolve manchete quebrando feio no celular.
// Em texto corrido ela cansaria: letra estreita em parágrafo longo atrapalha a
// leitura, que é justamente o que um artigo precisa preservar.
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-barlow-condensed',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  // `metadataBase` é obrigatório para que URLs relativas do Open Graph virem
  // absolutas. Sem ele, o preview do link no WhatsApp e no Facebook sai sem imagem.
  metadataBase: new URL(SITE_URL),
  // Canonical em TODA página, resolvido a partir do caminho dela.
  //
  // O site responde em dois endereços: o domínio da loja e o `.vercel.app` que a
  // Vercel cria e não permite redirecionar. Sem canonical, o Google trata os dois
  // como sites distintos com conteúdo idêntico e divide o sinal entre eles — ou
  // indexa o `.vercel.app`, que é o endereço que ninguém deveria ver.
  //
  // `'./'` (e não `SITE_URL`) porque o valor é resolvido contra o caminho da
  // página. Um canonical fixo apontaria TUDO para a home, e aí `/veiculos` e
  // `/contato` se declarariam duplicatas da raiz — pior que não ter canonical
  // nenhum. A página de veículo define o seu próprio, mais específico.
  alternates: { canonical: './' },
  title: {
    default: 'Giro Auto | Seminovos selecionados',
    // Cada página preenche o %s. Assim o título nunca fica só "Corolla", sem
    // contexto, na aba do navegador e no resultado do Google.
    template: '%s | Giro Auto',
  },
  description:
    'Seminovos selecionados com procedência verificada e revisão completa. Encontre seu próximo carro e agende uma visita.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Giro Auto',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang="pt-BR"` não é detalhe: é o que faz o leitor de tela pronunciar o
    // conteúdo em português, e o que diz ao Google em que idioma indexar.
    <html lang="pt-BR" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">{children}</body>
    </html>
  );
}
