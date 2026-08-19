import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

import './globals.css';

// A fonte é auto-hospedada pelo Next em build time — não há requisição ao
// Google em runtime. Isso tira uma conexão externa do caminho crítico e elimina
// o "flash of unstyled text", em que o texto aparece numa fonte e salta para
// outra quando a definitiva carrega.
//
// ----------------------------------------------------------------------------
// UMA FAMÍLIA SÓ, E A HIERARQUIA VEM DO PESO
// ----------------------------------------------------------------------------
// O site já usou Inter (a fonte padrão de toda ferramenta que gera site, que
// fazia tudo parecer template) e depois Barlow com uma condensada nos títulos.
// A condensada dava caráter, mas deixava o texto corrido fino demais.
//
// Plus Jakarta Sans resolve as duas coisas com uma família só: tem desenho
// próprio o bastante para não parecer genérica, corpo com traço mais cheio que
// o da Barlow, e um peso 800 que dá aos títulos a presença que antes vinha da
// largura estreita. Menos peças para manter, e nada de duas personalidades
// disputando na mesma página.
//
// É variável, então um arquivo só cobre do 400 ao 800 — mais leve que os seis
// arquivos estáticos que a combinação anterior exigia.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
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
    <html lang="pt-BR" className={jakarta.variable}>
      <body className="flex min-h-dvh flex-col font-sans">{children}</body>
    </html>
  );
}
