'use client';

import { useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { AlertCircle, ImagePlus, Loader2, Monitor, Smartphone, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import type { HeroBanner } from '@/lib/api';
import { errorMessage, http } from '@/lib/http';

/**
 * A tela que troca a imagem do topo da home.
 *
 * ============================================================================
 * O PROBLEMA REAL AQUI É O RECORTE, NÃO O UPLOAD
 * ============================================================================
 * A mesma imagem aparece de dois jeitos muito diferentes no site:
 *
 *   NO CELULAR  uma faixa 16:9 — corta em cima e embaixo
 *   NO DESKTOP  um painel alto cortado na diagonal — corta a esquerda
 *
 * Uma arte pensada só para o celular perde o canto esquerdo no desktop; uma
 * pensada só para o desktop tem o texto cortado no celular. E quem monta o
 * banner não tem como adivinhar isso.
 *
 * Por isso a tela mostra OS DOIS RECORTES, com a geometria real do site — a
 * mesma diagonal, a mesma proporção. É a prévia que impede o banner ruim; a
 * instrução escrita, sozinha, ninguém segue.
 */

//: O recorte diagonal do painel do desktop. É o MESMO polígono do hero — se um
//: dia ele mudar lá, tem de mudar aqui, senão a prévia passa a mentir.
const DIAGONAL = 'polygon(24% 0, 100% 0, 100% 100%, 5% 100%)';

const TAMANHO_MAXIMO_MB = 1;
//: Quadrado de 1600: é o formato que atravessa os dois recortes com folga.
const DIMENSAO = 1600;

export function BannerForm({ banner }: { banner: HeroBanner | null }) {
  const [imagemUrl, setImagemUrl] = useState(banner?.image_url ?? '');
  const [imagemPath, setImagemPath] = useState(banner?.image_path ?? '');
  const [alt, setAlt] = useState(banner?.alt ?? '');
  const [link, setLink] = useState(banner?.link_url ?? '');
  const [ativo, setAtivo] = useState(banner?.active ?? true);

  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const enviarImagem = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      // A imagem NÃO passa pela API: a função serverless tem limite de corpo e
      // uma foto o estoura. O navegador recebe autorização e escreve direto no
      // Storage, com o token na query string (no header o Supabase recusa).
      const comprimida = await imageCompression(arquivo, {
        maxSizeMB: TAMANHO_MAXIMO_MB,
        maxWidthOrHeight: DIMENSAO,
        useWebWorker: true,
        fileType: 'image/webp',
      });

      const { data: assinado } = await http.post<{
        upload_url: string;
        token: string;
        storage_path: string;
        public_url: string;
      }>('/admin/banner/upload-url', { content_type: 'image/webp' });

      const resposta = await fetch(
        `${assinado.upload_url}?token=${encodeURIComponent(assinado.token)}`,
        { method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: comprimida },
      );

      if (!resposta.ok) {
        const detalhe = await resposta.text().catch(() => '');
        throw new Error(
          `Falha ao enviar a imagem. (HTTP ${resposta.status}${detalhe ? `: ${detalhe.slice(0, 200)}` : ''})`,
        );
      }

      setImagemUrl(assinado.public_url);
      setImagemPath(assinado.storage_path);

      // Aviso, não bloqueio: uma arte muito fora do quadrado ainda funciona,
      // só perde mais nas bordas. Recusar o envio obrigaria a loja a abrir um
      // editor de imagem para conseguir usar o painel.
      const proporcao = await medirProporcao(comprimida);
      if (proporcao && (proporcao < 0.8 || proporcao > 1.25)) {
        setAviso(
          'Essa imagem não é quadrada. Confira nas duas prévias abaixo se nada importante ficou cortado.',
        );
      }
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviando(false);
      e.target.value = '';
    }
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await http.put('/admin/banner', {
        image_url: imagemUrl,
        image_path: imagemPath,
        alt: alt.trim(),
        link_url: link.trim() || null,
        active: ativo,
      });
      setAviso('Salvo. A home já está mostrando o banner.');
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!window.confirm('Remover o banner? O topo do site volta à foto padrão.')) return;
    setRemovendo(true);
    setErro(null);
    try {
      await http.delete('/admin/banner');
      setImagemUrl('');
      setImagemPath('');
      setAlt('');
      setLink('');
      setAtivo(true);
      setAviso('Banner removido. O topo do site voltou à foto padrão.');
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setRemovendo(false);
    }
  };

  const podeSalvar = Boolean(imagemUrl && alt.trim()) && !salvando && !enviando;

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
      {aviso && (
        <div className="rounded-btn bg-warning-500/10 text-warning-700 flex items-start gap-2.5 p-3.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {aviso}
        </div>
      )}

      {/* IMAGEM */}
      <div className="rounded-card bg-surface ring-line p-5 ring-1 sm:p-6">
        <p className="text-content text-sm font-semibold">Imagem</p>
        <p className="text-faint mt-0.5 text-xs leading-relaxed">
          Quadrada, 1600 × 1600. Deixe o texto e a logo no meio da arte: as bordas são cortadas
          de formas diferentes no celular e no computador, como as prévias mostram.
        </p>

        {imagemUrl ? (
          <div className="mt-4">
            <Previas src={imagemUrl} />
            <label className="rounded-btn border-line-strong text-muted hover:bg-sunken mt-4 inline-flex cursor-pointer items-center gap-2 border border-dashed px-4 py-2 text-sm transition-colors">
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              Trocar imagem
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={enviando}
                onChange={(e) => void enviarImagem(e)}
              />
            </label>
          </div>
        ) : (
          <label className="rounded-btn border-line-strong text-muted hover:bg-sunken mt-4 flex max-w-md cursor-pointer items-center justify-center gap-2 border border-dashed py-10 text-sm transition-colors">
            {enviando ? (
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
              disabled={enviando}
              onChange={(e) => void enviarImagem(e)}
            />
          </label>
        )}
      </div>

      {/* TEXTO E LINK */}
      <div className="rounded-card bg-surface ring-line p-5 ring-1 sm:p-6">
        <Field label="Descrição da imagem" htmlFor="alt" required>
          <Input
            id="alt"
            value={alt}
            maxLength={200}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Feirão de agosto: entrada facilitada em toda a loja"
          />
        </Field>
        {/* Não é legenda: não aparece na tela. É o que o leitor de tela lê e o
            que o Google entende da imagem — e a promoção quase sempre está
            escrita DENTRO da arte, onde nenhum dos dois consegue ler. */}
        <p className="text-faint mt-1 text-xs leading-relaxed">
          Escreva o que está escrito na arte. Não aparece na tela: serve para quem usa leitor de
          tela e para o Google entenderem a imagem.
        </p>

        <div className="mt-5">
          <Field label="Link ao clicar" htmlFor="link">
            <Input
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/veiculos"
            />
          </Field>
          <p className="text-faint mt-1 text-xs leading-relaxed">
            Opcional. Deixe em branco e o banner fica só de enfeite. Endereços do próprio site
            começam com barra, como <code className="bg-sunken rounded px-1">/veiculos</code>.
          </p>
        </div>
      </div>

      {/* NO AR OU NÃO */}
      <div className="rounded-card bg-surface ring-line p-5 ring-1 sm:p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="accent-brand-600 mt-0.5 size-4.5 shrink-0 cursor-pointer"
          />
          <span>
            <span className="text-content block text-sm font-medium">Mostrar no site</span>
            {/* Desligar é melhor que excluir para tirar do ar por uns dias: a
                imagem fica guardada e religar é um clique. */}
            <span className="text-faint mt-0.5 block text-xs leading-relaxed">
              Desligado, o topo do site volta à foto padrão e a imagem continua guardada aqui
              para você religar quando quiser.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={!podeSalvar} onClick={() => void salvar()}>
          {salvando && <Loader2 className="size-4 animate-spin" />}
          Salvar
        </Button>
        {banner && (
          <Button
            type="button"
            variant="ghost"
            disabled={removendo}
            onClick={() => void remover()}
            className="text-muted hover:text-danger-700"
          >
            <Trash2 className="size-4" />
            Remover banner
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Os dois recortes, lado a lado, com a geometria real do site.
 *
 * O do desktop é quadrado porque é essa a proporção que o painel do hero tem na
 * prática: 58% da largura da tela por quase toda a altura dela. Num monitor
 * comum de 1440 × 900 isso dá ~835 × 836.
 */
function Previas({ src }: { src: string }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <p className="text-muted flex items-center gap-1.5 text-xs font-medium">
          <Smartphone className="size-3.5" />
          No celular
        </p>
        <div className="rounded-btn bg-sunken relative mt-2 aspect-video overflow-hidden">
          <Image src={src} alt="" fill sizes="320px" className="object-cover object-center" />
        </div>
        <p className="text-faint mt-1.5 text-xs">Corta em cima e embaixo.</p>
      </div>

      <div>
        <p className="text-muted flex items-center gap-1.5 text-xs font-medium">
          <Monitor className="size-3.5" />
          No computador
        </p>
        {/* O azul por baixo é o mesmo degradê do hero: sem ele a área cortada
            pela diagonal apareceria como buraco e a prévia enganaria. */}
        <div className="rounded-btn relative mt-2 aspect-square overflow-hidden">
          <div className="from-brand-300 to-brand-600 absolute inset-0 bg-linear-to-b" />
          <div className="absolute inset-0" style={{ clipPath: DIAGONAL }}>
            <Image src={src} alt="" fill sizes="320px" className="object-cover object-center" />
          </div>
        </div>
        <p className="text-faint mt-1.5 text-xs">Corta o canto esquerdo na diagonal.</p>
      </div>
    </div>
  );
}

/** Largura ÷ altura do arquivo, para avisar quando está longe do quadrado. */
async function medirProporcao(arquivo: Blob): Promise<number | null> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const proporcao = bitmap.width / bitmap.height;
    bitmap.close();
    return proporcao;
  } catch {
    // Navegador sem `createImageBitmap` só perde o aviso; as prévias, que são
    // o que de fato protege o resultado, continuam ali.
    return null;
  }
}
