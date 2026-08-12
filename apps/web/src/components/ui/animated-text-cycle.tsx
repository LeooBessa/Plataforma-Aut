'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/**
 * Palavra que troca sozinha, com a largura acompanhando.
 *
 * O truque central: as palavras têm larguras diferentes, então trocar o texto
 * faria o resto da linha pular a cada ciclo. Para evitar isso, todas as palavras
 * são renderizadas num bloco invisível, a largura da atual é medida, e o
 * contêiner anima ATÉ ela. O texto ao redor desliza suave em vez de saltar.
 *
 * ----------------------------------------------------------------------------
 * IMPORT: `motion/react`, não `framer-motion`
 * ----------------------------------------------------------------------------
 * São o mesmo pacote — `motion` é o nome novo do `framer-motion`, mesma API.
 * Este projeto já tinha `motion` instalado; trazer `framer-motion` junto
 * significaria duas bibliotecas de animação no bundle fazendo a mesma coisa.
 */

interface AnimatedTextCycleProps {
  words: string[];
  /** Milissegundos que cada palavra fica na tela. */
  interval?: number;
  /**
   * Classes da palavra visível.
   *
   * São aplicadas TAMBÉM ao bloco de medição — e isso não é detalhe: se o
   * medidor tiver peso ou tamanho de fonte diferente do texto visível, a
   * largura medida não é a largura real, e a animação acerta o valor errado.
   */
  className?: string;
  /**
   * Animar a largura junto com a troca. Padrão: `true`.
   *
   * Serve para quando a palavra fica NO MEIO de uma frase — aí a largura muda a
   * cada ciclo e o texto seguinte saltaria sem esta animação.
   *
   * Passe `false` quando a palavra estiver sozinha na linha: não há texto para
   * empurrar, e a medição deixa de valer o preço. Ela exige renderizar todas as
   * palavras num bloco oculto, e esse bloco entra no texto do elemento que
   * envolve o componente. Dentro de um `h1`, isso significa o título da página
   * carregando todas as variações concatenadas no DOM.
   */
  animateWidth?: boolean;
}

export default function AnimatedTextCycle({
  words,
  interval = 5000,
  className = '',
  animateWidth = true,
}: AnimatedTextCycleProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [width, setWidth] = useState<number | 'auto'>('auto');
  const measureRef = useRef<HTMLSpanElement>(null);
  const reduzirMovimento = useReducedMotion();

  // `useLayoutEffect` e não `useEffect`: a medição precisa acontecer ANTES do
  // navegador pintar. Com `useEffect` o primeiro quadro sai com a largura
  // errada e o usuário vê um salto na abertura da página.
  useLayoutEffect(() => {
    if (!animateWidth) return;

    const medir = () => {
      const filhos = measureRef.current?.children;
      const alvo = filhos?.[currentIndex];
      if (alvo) setWidth(alvo.getBoundingClientRect().width);
    };

    medir();

    // Remedir quando a FONTE terminar de carregar.
    //
    // O site usa `next/font` com `display: swap`: a primeira pintura sai numa
    // fonte de sistema e troca para a Inter quando ela chega. As larguras mudam
    // nessa troca, e sem esta linha a palavra ficaria com a largura da fonte
    // errada até o próximo ciclo.
    void document.fonts?.ready.then(medir);

    // Remedir ao redimensionar: o título é responsivo (text-4xl → sm:text-5xl →
    // lg:[3.4rem]), então a largura da mesma palavra muda com o breakpoint.
    const observer = new ResizeObserver(medir);
    if (measureRef.current) observer.observe(measureRef.current);

    return () => observer.disconnect();
  }, [currentIndex, words, animateWidth]);

  useEffect(() => {
    if (words.length <= 1) return;
    const timer = setInterval(
      () => setCurrentIndex((i) => (i + 1) % words.length),
      interval,
    );
    return () => clearInterval(timer);
  }, [interval, words.length]);

  const variantes = {
    hidden: { y: -20, opacity: 0, filter: 'blur(8px)' },
    visible: {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.4, ease: 'easeOut' as const },
    },
    exit: {
      y: 20,
      opacity: 0,
      filter: 'blur(8px)',
      transition: { duration: 0.3, ease: 'easeIn' as const },
    },
  };

  // Quem pediu menos movimento no sistema recebe a troca sem animação.
  //
  // A regra global de `prefers-reduced-motion` do globals.css NÃO cobre este
  // componente: ela zera `animation-duration` e `transition-duration`, que são
  // CSS, e o motion anima por JavaScript. Sem este atalho, quem tem distúrbio
  // vestibular veria a palavra deslizando e desfocando a cada três segundos.
  if (reduzirMovimento) {
    return <span className={className}>{words[currentIndex]}</span>;
  }

  return (
    <>
      {animateWidth && (
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute opacity-0"
          style={{ visibility: 'hidden' }}
        >
          {words.map((word) => (
            <span key={word} className={className}>
              {word}
            </span>
          ))}
        </span>
      )}

      <motion.span
        className="relative inline-block align-bottom"
        animate={animateWidth ? { width } : undefined}
        transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 1.2 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={currentIndex}
            className={`inline-block ${className}`}
            variants={variantes}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ whiteSpace: 'nowrap' }}
          >
            {words[currentIndex]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  );
}
