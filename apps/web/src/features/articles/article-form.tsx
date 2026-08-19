'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import {
  AlertCircle,
  ArrowRight,
  Bold,
  Eye,
  Heading2,
  ImagePlus,
  List,
  Loader2,
  Plus,
  Quote,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import type { Article } from '@/lib/api';
import { errorMessage, http } from '@/lib/http';
import { Markdown } from '@/features/articles/markdown';

/**
 * O editor de artigo do painel.
 *
 * ============================================================================
 * ESCREVE SOLTO. OS BOTÕES FAZEM A MARCAÇÃO.
 * ============================================================================
 * A pessoa digita como falaria com um cliente. Quando quiser um subtítulo, uma
 * lista ou um negrito, seleciona o trecho e clica no botão.
 *
 * Antes desta versão havia um parágrafo ensinando `## `, `- ` e `**negrito**`.
 * Funcionava, mas empurrava para quem vende carro a tarefa de decorar sinal de
 * marcação — e quem não lê o aviso publica um bloco de texto sem estrutura
 * nenhuma, que é ruim de ler e ruim para a busca.
 *
 * ----------------------------------------------------------------------------
 * POR QUE NÃO UM EDITOR RICO DE VERDADE
 * ----------------------------------------------------------------------------
 * Um editor rico traria ~150KB de dependência e, pior, guardaria HTML — que
 * depois teria de ser renderizado, abrindo XSS armazenado justamente pela conta
 * com mais poder no sistema.
 *
 * Aqui os botões só inserem marcação num campo de texto comum. O que vai para o
 * banco continua sendo TEXTO, e vira componente React na hora de exibir. A
 * experiência é a de um editor; o risco, o de um bloco de notas.
 *
 * Texto colado de qualquer lugar continua virando parágrafo sem marcação
 * nenhuma, e o botão de pré-visualizar mostra o resultado antes de publicar.
 */

const TAMANHO_MAXIMO_MB = 1;
const DIMENSAO_MAXIMA = 1920;

type Faq = { question: string; answer: string };

type Marca = 'subtitulo' | 'lista' | 'negrito' | 'citacao';

//: O que cada botão põe no começo da linha. `negrito` não está aqui porque ele
//: envolve o trecho selecionado em vez de prefixar a linha.
const PREFIXOS: Record<Exclude<Marca, 'negrito'>, string> = {
  subtitulo: '## ',
  lista: '- ',
  citacao: '> ',
};

export function ArticleForm({ article }: { article?: Article }) {
  const router = useRouter();

  const [titulo, setTitulo] = useState(article?.title ?? '');
  const [resumo, setResumo] = useState(article?.excerpt ?? '');
  const [corpo, setCorpo] = useState(article?.body ?? '');
  const [capaUrl, setCapaUrl] = useState(article?.cover_url ?? '');
  const [capaPath, setCapaPath] = useState(article?.cover_path ?? '');
  const [faq, setFaq] = useState<Faq[]>(article?.faq ?? []);
  const [destacar, setDestacar] = useState(article?.featured ?? false);

  const [previa, setPrevia] = useState(false);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const [salvando, setSalvando] = useState<'draft' | 'published' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  //: Onde o cursor deve ficar depois que o React repintar o campo.
  //: Sem isto, clicar num botão jogaria o cursor para o fim do texto e a
  //: pessoa perderia o lugar onde estava escrevendo.
  const selecaoPendente = useRef<[number, number] | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    const alvo = selecaoPendente.current;
    if (!el || !alvo) return;
    selecaoPendente.current = null;
    el.focus();
    el.setSelectionRange(alvo[0], alvo[1]);
  }, [corpo]);

  /**
   * Aplica a marcação no trecho selecionado.
   *
   * Alterna: clicar de novo num trecho já marcado TIRA a marcação. Sem isso, a
   * única forma de desfazer seria apagar os caracteres na mão — e a pessoa nem
   * sabe que eles existem, porque a tela não ensina mais a sintaxe.
   */
  const aplicar = (marca: Marca) => {
    const el = areaRef.current;
    if (!el) return;

    const { selectionStart: inicio, selectionEnd: fim } = el;

    if (marca === 'negrito') {
      // SEM SELEÇÃO, MARCA A LINHA INTEIRA.
      //
      // Duas versões anteriores erraram aqui. A primeira inseria o texto
      // "texto em negrito" como exemplo, e ele foi parar publicado no site: quem
      // clicou não percebeu que era um espaço a preencher. A segunda marcava só
      // a palavra sob o cursor, e quem punha o cursor no começo da frase para
      // destacá-la inteira via só a primeira palavra ficar em negrito.
      //
      // A linha inteira é o comportamento certo porque é o dos OUTROS botões:
      // Subtítulo, Lista e Destaque já agem na linha toda. Negrito agindo numa
      // palavra era o único fora do padrão, e nada na tela avisava disso.
      // Quem quiser só uma palavra continua podendo selecionar antes.
      let ini = inicio;
      let fi = fim;
      if (ini === fi) {
        const comecoLinha = corpo.lastIndexOf('\n', ini - 1) + 1;
        const quebra = corpo.indexOf('\n', ini);
        const fimDaLinha = quebra === -1 ? corpo.length : quebra;

        // Encolhe para fora dos espaços das pontas: `** frase **` guardaria o
        // espaço dentro do negrito e deixaria a marcação frouxa no texto.
        const linha = corpo.slice(comecoLinha, fimDaLinha);
        const recuo = linha.length - linha.trimStart().length;
        ini = comecoLinha + recuo;
        fi = comecoLinha + linha.trimEnd().length;

        // Linha vazia: não há o que marcar, e inventar conteúdo foi justamente
        // o defeito da primeira versão.
        if (ini >= fi) return;
      }

      const jaMarcado = corpo.slice(ini - 2, ini) === '**' && corpo.slice(fi, fi + 2) === '**';
      if (jaMarcado) {
        selecaoPendente.current = [ini - 2, fi - 2];
        setCorpo(corpo.slice(0, ini - 2) + corpo.slice(ini, fi) + corpo.slice(fi + 2));
        return;
      }

      const trecho = corpo.slice(ini, fi);
      selecaoPendente.current = [ini + 2, ini + 2 + trecho.length];
      setCorpo(`${corpo.slice(0, ini)}**${trecho}**${corpo.slice(fi)}`);
      return;
    }

    // Marcação de LINHA: cresce a seleção até abraçar as linhas inteiras, senão
    // marcar do meio de uma frase inseriria o "## " no meio dela.
    const prefixo = PREFIXOS[marca];
    const inicioLinha = corpo.lastIndexOf('\n', inicio - 1) + 1;
    const proximaQuebra = corpo.indexOf('\n', fim);
    const fimLinha = proximaQuebra === -1 ? corpo.length : proximaQuebra;

    const marcado = corpo
      .slice(inicioLinha, fimLinha)
      .split('\n')
      .map((linha) => (linha.startsWith(prefixo) ? linha.slice(prefixo.length) : prefixo + linha))
      .join('\n');

    selecaoPendente.current = [inicioLinha, inicioLinha + marcado.length];
    setCorpo(corpo.slice(0, inicioLinha) + marcado + corpo.slice(fimLinha));
  };

  const enviarCapa = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setEnviandoCapa(true);
    setErro(null);
    try {
      // Mesmo caminho das fotos de veículo: comprime antes, pede autorização, e
      // envia DIRETO ao Storage — a função serverless não aguenta o corpo de uma
      // imagem. O token vai na query string; no header o Supabase recusa.
      const comprimida = await imageCompression(arquivo, {
        maxSizeMB: TAMANHO_MAXIMO_MB,
        maxWidthOrHeight: DIMENSAO_MAXIMA,
        useWebWorker: true,
        fileType: 'image/webp',
      });

      const { data: assinado } = await http.post<{
        upload_url: string;
        token: string;
        storage_path: string;
        public_url: string;
      }>('/admin/articles/cover-upload-url', { content_type: 'image/webp' });

      const resposta = await fetch(
        `${assinado.upload_url}?token=${encodeURIComponent(assinado.token)}`,
        { method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: comprimida },
      );

      if (!resposta.ok) {
        const detalhe = await resposta.text().catch(() => '');
        throw new Error(
          `Falha ao enviar a capa. (HTTP ${resposta.status}${detalhe ? `: ${detalhe.slice(0, 200)}` : ''})`,
        );
      }

      setCapaUrl(assinado.public_url);
      setCapaPath(assinado.storage_path);
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviandoCapa(false);
      e.target.value = '';
    }
  };

  const salvar = async (status: 'draft' | 'published') => {
    setSalvando(status);
    setErro(null);
    try {
      const corpoRequisicao = {
        title: titulo.trim(),
        excerpt: resumo.trim(),
        body: corpo.trim(),
        status,
        cover_url: capaUrl || undefined,
        cover_path: capaPath || undefined,
        faq: faq.filter((f) => f.question.trim() && f.answer.trim()),
        // O destaque só existe para artigo publicado: no topo da home, uma capa
        // de rascunho levaria a uma página que ainda não existe. Salvar como
        // rascunho com a caixa marcada guarda o texto e deixa o destaque para a
        // hora de publicar, em vez de recusar a gravação inteira.
        featured: destacar && status === 'published',
      };

      if (article) {
        await http.put(`/admin/articles/${article.id}`, corpoRequisicao);
      } else {
        await http.post('/admin/articles', corpoRequisicao);
      }
      router.push('/admin/artigos');
      router.refresh();
    } catch (err) {
      setErro(errorMessage(err));
      setSalvando(null);
    }
  };

  return (
    <div className="space-y-5">
      {erro && (
        <div
          role="alert"
          className="rounded-btn bg-danger-500/10 text-danger-700 flex items-start gap-2.5 p-3.5 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </div>
      )}

      <div className="rounded-card bg-surface ring-line p-5 ring-1 sm:p-6">
        <Field label="Título" htmlFor="titulo" required>
          <Input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Vale a pena comprar um seminovo?"
          />
        </Field>

        <div className="mt-4">
          <Field label="Resumo" htmlFor="resumo" required>
            <Textarea
              id="resumo"
              rows={2}
              maxLength={300}
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder="Uma ou duas frases. É o que aparece no cartão da listagem."
            />
          </Field>
          <p className="text-faint mt-1 text-xs">{resumo.length}/300</p>
        </div>
      </div>

      {/* CAPA */}
      <div className="rounded-card bg-surface ring-line p-5 ring-1 sm:p-6">
        <p className="text-content text-sm font-semibold">Capa</p>
        {/* PEDE QUADRADA mesmo a capa aparecendo deitada na maior parte dos
            lugares, e o motivo não é óbvio: a mesma imagem é recortada de dois
            jeitos incompatíveis.

              deitada (16:9)   listagem, página do artigo, topo no celular
              quase quadrada   topo da home no computador (medido: 1:1 a 1,13:1)

            Uma arte 16:9 jogada no painel quadrado do computador precisa ampliar
            78% para preencher, e é isso que faz a foto parecer torta e ampliada
            demais. Uma arte quadrada, ao contrário, só perde as faixas de cima e
            de baixo quando aparece deitada — por isso o pedido de deixar o
            assunto no meio. */}
        <p className="text-faint mt-0.5 text-xs leading-relaxed">
          Quadrada, 1600 × 1600, com o assunto no meio. Nas listagens ela aparece
          deitada e as bordas de cima e de baixo somem. Obrigatória para publicar.
        </p>

        {capaUrl ? (
          <div className="mt-3">
            <div className="rounded-btn bg-sunken relative aspect-square max-w-xs overflow-hidden">
              <Image src={capaUrl} alt="" fill sizes="448px" className="object-cover" />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setCapaUrl('');
                setCapaPath('');
              }}
            >
              <Trash2 className="size-4" />
              Remover capa
            </Button>
          </div>
        ) : (
          <label className="rounded-btn border-line-strong text-muted hover:bg-sunken mt-3 flex max-w-md cursor-pointer items-center justify-center gap-2 border border-dashed py-8 text-sm transition-colors">
            {enviandoCapa ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <ImagePlus className="size-4" />
                Escolher imagem
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={enviandoCapa}
              onChange={(e) => void enviarCapa(e)}
            />
          </label>
        )}
      </div>

      {/* CORPO */}
      <div className="rounded-card bg-surface ring-line p-5 ring-1 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-content text-sm font-semibold">Texto do artigo</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => setPrevia((v) => !v)}>
            <Eye className="size-4" />
            {previa ? 'Voltar a escrever' : 'Pré-visualizar'}
          </Button>
        </div>

        {previa ? (
          <div className="border-line mt-4 border-t pt-4">
            {corpo.trim() ? (
              <Markdown>{corpo}</Markdown>
            ) : (
              <p className="text-faint text-sm">Nada escrito ainda.</p>
            )}
          </div>
        ) : (
          <>
            {/* BOTÕES NO LUGAR DAS INSTRUÇÕES.
                Antes havia um parágrafo ensinando `##`, `-` e `**`. Decorar
                sinal de marcação não é trabalho de quem vende carro: agora a
                pessoa escreve solto, seleciona o trecho e clica.
                O texto continua sendo guardado como TEXTO, não HTML — que é o
                que mantém a página imune a XSS pelo conteúdo do painel. Os
                botões só inserem a marcação por baixo. */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(
                [
                  { marca: 'subtitulo', rotulo: 'Subtítulo', Icone: Heading2 },
                  { marca: 'lista', rotulo: 'Lista', Icone: List },
                  { marca: 'negrito', rotulo: 'Negrito', Icone: Bold },
                  { marca: 'citacao', rotulo: 'Destaque', Icone: Quote },
                ] as const
              ).map(({ marca, rotulo, Icone }) => (
                <button
                  key={marca}
                  type="button"
                  onClick={() => aplicar(marca)}
                  className="rounded-btn border-line text-muted hover:bg-sunken hover:text-content flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-colors"
                >
                  <Icone className="size-3.5" />
                  {rotulo}
                </button>
              ))}
            </div>

            <Textarea
              ref={areaRef}
              rows={18}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              className="mt-2"
              placeholder="Escreva aqui, do jeito que você falaria com um cliente. Deixe uma linha em branco entre um parágrafo e outro."
            />
          </>
        )}
      </div>

      {/* FAQ */}
      <div className="rounded-card bg-surface ring-line p-5 ring-1 sm:p-6">
        <p className="text-content text-sm font-semibold">Perguntas frequentes</p>
        <p className="text-faint mt-0.5 text-xs">
          Opcional. Aparecem no fim do artigo, e o Google às vezes as mostra direto no resultado
          da busca.
        </p>

        <div className="mt-4 space-y-3">
          {faq.map((item, i) => (
            <div key={i} className="rounded-btn bg-sunken p-3">
              <Input
                value={item.question}
                onChange={(e) =>
                  setFaq(faq.map((f, k) => (k === i ? { ...f, question: e.target.value } : f)))
                }
                placeholder="Pergunta"
              />
              <Textarea
                rows={2}
                value={item.answer}
                onChange={(e) =>
                  setFaq(faq.map((f, k) => (k === i ? { ...f, answer: e.target.value } : f)))
                }
                placeholder="Resposta"
                className="mt-2"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setFaq(faq.filter((_, k) => k !== i))}
              >
                <Trash2 className="size-4" />
                Remover
              </Button>
            </div>
          ))}
        </div>

        {faq.length < 10 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setFaq([...faq, { question: '', answer: '' }])}
          >
            <Plus className="size-4" />
            Adicionar pergunta
          </Button>
        )}
      </div>

      {/* DESTAQUE NA HOME */}
      <div className="rounded-card bg-surface ring-line p-5 ring-1 sm:p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={destacar}
            onChange={(e) => setDestacar(e.target.checked)}
            className="accent-brand-600 mt-0.5 size-4.5 shrink-0 cursor-pointer"
          />
          <span>
            <span className="text-content block text-sm font-medium">Destacar na home</span>
            {/* Um por vez, e a tela avisa antes: descobrir que o destaque
                anterior saiu do ar só olhando o site seria pior. */}
            <span className="text-faint mt-0.5 block text-xs leading-relaxed">
              A capa deste artigo ocupa o topo do site, com um botão &ldquo;Ler artigo&rdquo;.
              É um artigo por vez: marcar este tira o que estiver em destaque hoje. Só vale
              depois de publicado.
            </span>
          </span>
        </label>

        {destacar && capaUrl && (
          <div className="mt-4">
            <p className="text-muted mb-2 text-xs font-medium">Como vai ficar no topo do site:</p>
            <PreviaDoTopo src={capaUrl} titulo={titulo || 'Título do artigo'} />
          </div>
        )}
      </div>

      {/* AÇÕES — rascunho primeiro, publicar depois.
          A ordem importa: publicar é o irreversível dos dois, e o botão mais à
          direita é o que o dedo alcança sem pensar. */}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={salvando !== null}
          onClick={() => void salvar('draft')}
        >
          {salvando === 'draft' ? <Loader2 className="size-4 animate-spin" /> : null}
          Salvar rascunho
        </Button>
        <Button type="button" disabled={salvando !== null} onClick={() => void salvar('published')}>
          {salvando === 'published' ? <Loader2 className="size-4 animate-spin" /> : null}
          {article?.status === 'published' ? 'Salvar e manter publicado' : 'Publicar'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Como a capa vai aparecer no topo da home.
 *
 * O topo do site recorta a mesma capa de dois jeitos: faixa deitada no celular
 * e painel alto cortado na diagonal no computador. A capa é 16:9, então no
 * computador ela perde as laterais — e quem escolhe a imagem não tem como
 * adivinhar isso.
 *
 * A prévia usa a geometria real do hero (a mesma diagonal, a mesma proporção) e
 * só aparece quando a caixa está marcada, para não pesar a tela de quem está
 * apenas escrevendo.
 */
function PreviaDoTopo({ src, titulo }: { src: string; titulo: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-faint text-xs">No celular</p>
        <div className="rounded-btn bg-sunken relative mt-1.5 aspect-video overflow-hidden">
          <Image src={src} alt="" fill sizes="320px" className="object-cover object-center" />
          <TarjaPrevia titulo={titulo} />
        </div>
      </div>
      <div>
        <p className="text-faint text-xs">No computador</p>
        <div className="rounded-btn relative mt-1.5 aspect-square overflow-hidden">
          {/* O azul por baixo é o mesmo degradê do hero: sem ele a área cortada
              pela diagonal viraria um buraco e a prévia enganaria. */}
          <div className="from-brand-300 to-brand-600 absolute inset-0 bg-linear-to-b" />
          <div className="absolute inset-0" style={{ clipPath: DIAGONAL_DO_HERO }}>
            <Image src={src} alt="" fill sizes="320px" className="object-cover object-center" />
            <TarjaPrevia titulo={titulo} diagonal />
          </div>
        </div>
      </div>
    </div>
  );
}

//: O MESMO polígono do hero. Se mudar lá, muda aqui — senão a prévia mente.
const DIAGONAL_DO_HERO = 'polygon(24% 0, 100% 0, 100% 100%, 5% 100%)';

/**
 * `diagonal` empurra o conteúdo para a direita na prévia do computador.
 *
 * É o mesmo desvio que o hero de verdade faz: lá o `clip-path` come o canto
 * esquerdo, e sem o recuo o começo do título e do botão caem fora da imagem.
 * Se a prévia não repetisse o desvio, ela mostraria um enquadramento que o site
 * não entrega — que é pior do que não ter prévia.
 */
function TarjaPrevia({ titulo, diagonal = false }: { titulo: string; diagonal?: boolean }) {
  return (
    <div className={`absolute inset-x-0 bottom-0 p-3 pt-10 ${diagonal ? 'pl-[15%]' : ''}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/40 to-transparent"
      />
      <div className="relative">
        <p className="text-[7px] font-semibold tracking-[0.18em] text-white/70 uppercase">
          Em destaque
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight font-bold text-white">
          {titulo}
        </p>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-neutral-900">
          Ler artigo
          <ArrowRight className="size-2.5" />
        </span>
      </div>
    </div>
  );
}
