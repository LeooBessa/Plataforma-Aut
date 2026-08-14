import Image from 'next/image';
import Link from 'next/link';
import { CalendarCheck, MessageCircle } from 'lucide-react';

import { IconInstagram } from '@/components/ui/icon-instagram';

import {
  INSTAGRAM_ARROBA,
  INSTAGRAM_URL,
  WHATSAPP,
  WHATSAPP_FORMATADO,
  WHATSAPP_MENSAGEM,
} from '@/lib/contato';
import { whatsappLink } from '@/lib/format';

/**
 * Rodapé CLARO, colado na seção anterior.
 *
 * Era escuro e tinha `mt-16`. As duas coisas juntas produziam uma faixa branca
 * atravessada no meio de dois blocos pretos na home — o "anuncie seu carro"
 * termina em preto e o rodapé começava em preto, com o fundo da página
 * aparecendo no vão. Lia como erro de montagem, não como respiro.
 *
 * Tirar só a margem resolveria o vão, mas emendaria dois pretos num bloco só, e
 * o rodapé sumiria dentro da seção de cima. Claro, ele fecha a alternância da
 * página: vitrine clara → anúncio escuro → rodapé claro.
 *
 * O `border-t` é para as OUTRAS páginas. Na home o contraste com o preto de
 * cima já separa, mas em /veiculos, /sobre e /contato o conteúdo acima também é
 * claro, e sem a linha o rodapé encostaria no texto sem fronteira.
 */
export function Footer() {
  return (
    <footer className="bg-canvas border-line border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          {/* Versão de traço ESCURO: o rodapé é claro. A clara sumiria. */}
          <Image
            src="/giro-auto-logo.png"
            alt=""
            width={497}
            height={512}
            className="mb-4 h-16 w-auto"
          />
          {/* `text-accent`, não `text-brand-gradient`: o degradê tem quase-branco
              no meio e desaparece no papel — está escrito no próprio utilitário,
              em globals.css. */}
          <span className="text-accent text-lg font-semibold tracking-[0.2em]">Giro Auto</span>
          <p className="text-faint mt-1 text-[10px] font-medium tracking-[0.22em] uppercase">
            Bons carros, preço justo
          </p>
          <p className="text-muted mt-5 max-w-xs text-sm leading-relaxed">
            Carros selecionados e preços que cabem no seu bolso. Escolha o seu e agende uma
            visita.
          </p>
        </div>

        <div>
          <h2 className="text-accent text-xs font-semibold tracking-[0.18em] uppercase">
            Navegação
          </h2>
          <ul className="mt-5 space-y-3 text-sm">
            {/* `as const` preserva os literais das rotas — sem ele o typedRoutes
                recusa, que é a proteção contra link quebrado funcionando. */}
            {(
              [
                { href: '/veiculos', label: 'Veículos' },
                { href: '/sobre', label: 'Sobre nós' },
                { href: '/contato', label: 'Contato' },
              ] as const
            ).map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted hover:text-accent transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-accent text-xs font-semibold tracking-[0.18em] uppercase">
            Contato
          </h2>
          {/* WhatsApp em primeiro, e no rodapé de TODAS as páginas.
              É o canal que a loja realmente atende, e no Brasil é por onde a
              negociação de carro acontece. Deixá-lo só na página de Contato
              obrigaria o visitante a procurar — e quem está com dúvida na página
              de um veículo desiste antes de procurar.
              Continua sem telefone fixo, e-mail e endereço: não existem. O que
              havia aqui era placeholder do seed. */}
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              {/* O verde escurece de 500 para 700: sobre preto o 500 brilhava,
                  sobre papel ele fica lavado e ilegível. */}
              <a
                href={whatsappLink(WHATSAPP, WHATSAPP_MENSAGEM)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-success-700 hover:text-success-800 inline-flex items-center gap-2.5 font-medium transition-colors"
              >
                <MessageCircle className="size-4 shrink-0" />
                {WHATSAPP_FORMATADO}
              </a>
            </li>
            <li>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-content inline-flex items-center gap-2.5 transition-colors"
              >
                <IconInstagram className="text-faint size-4 shrink-0" />
                {INSTAGRAM_ARROBA}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <CalendarCheck className="text-faint mt-0.5 size-4 shrink-0" />
              <span className="text-muted">
                Ou agende uma visita pelo site e entramos em contato para confirmar.
              </span>
            </li>
            <li>
              <Link href="/contato" className="text-accent transition-colors hover:underline">
                Falar com a gente
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Filete azul separando o rodapé do crédito. */}
      <div aria-hidden className="rule-brand mx-auto h-px max-w-7xl" />

      <div className="text-faint px-4 py-6 text-center text-xs">
        © {new Date().getFullYear()} Giro Auto. Todos os direitos reservados.
      </div>
    </footer>
  );
}
