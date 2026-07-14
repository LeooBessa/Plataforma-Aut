import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

// A fonte é auto-hospedada pelo Next em build time — não há requisição ao Google
// em runtime. Isso tira uma conexão externa do caminho crítico e elimina o
// "flash of unstyled text", em que o texto aparece numa fonte e salta para outra
// quando a definitiva carrega.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  // `metadataBase` é obrigatório para que URLs relativas do Open Graph virem
  // absolutas. Sem ele, o preview do link no WhatsApp e no Facebook sai sem imagem.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AutoPremium — Seminovos selecionados',
    // Cada página preenche o %s. Assim o título nunca fica só "Corolla", sem
    // contexto, na aba do navegador e no resultado do Google.
    template: '%s | AutoPremium',
  },
  description:
    'Seminovos selecionados com procedência verificada e revisão completa. Encontre seu próximo carro e agende uma visita.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'AutoPremium',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang="pt-BR"` não é detalhe: é o que faz o leitor de tela pronunciar o
    // conteúdo em português, e o que diz ao Google em que idioma indexar.
    <html lang="pt-BR" className={inter.variable}>
      <body className="flex min-h-dvh flex-col font-sans">{children}</body>
    </html>
  );
}
