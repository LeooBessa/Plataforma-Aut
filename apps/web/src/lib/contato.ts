/**
 * Canais de contato da loja — fonte única.
 *
 * Está aqui, e não espalhado pelas telas, porque número de contato muda: a loja
 * troca de linha, abre um segundo WhatsApp, passa a usar um número comercial.
 * Quando isso acontecer, o certo é editar uma linha — não caçar ocorrências em
 * rodapé, página de contato e onde mais tiver aparecido no meio do caminho.
 *
 * O site já pagou esse preço uma vez: o telefone e o e-mail do seed estavam
 * escritos direto no JSX de dois arquivos, e ninguém percebeu que eram falsos
 * até alguém ir conferir.
 */

/** Só dígitos, com DDD. O `whatsappLink` acrescenta o +55. */
export const WHATSAPP = '84999877293';

/** Como o número aparece escrito na tela. */
export const WHATSAPP_FORMATADO = '(84) 99987-7293';

/**
 * Mensagem que já vem escrita ao abrir a conversa.
 *
 * Um campo de texto em branco é uma barreira pequena, mas real: a pessoa
 * precisa pensar no que dizer, e parte delas desiste ali. Com a frase pronta,
 * o clique já vira conversa — e a loja sabe de onde o contato veio.
 */
export const WHATSAPP_MENSAGEM = 'Olá! Vi o site da Giro Auto e gostaria de mais informações.';
