'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { AlertCircle, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { Image as VehicleImage } from '@/lib/api';
import { errorMessage, http } from '@/lib/http';
import { cn } from '@/lib/utils';

/**
 * Upload de fotos.
 *
 * ============================================================================
 * A FOTO NUNCA PASSA PELO BACKEND.
 * ============================================================================
 *
 * O fluxo tem quatro passos:
 *
 *   1. O browser COMPRIME a imagem (uma foto de celular tem 5–12 MB).
 *   2. Pede ao backend uma URL assinada de escrita.
 *   3. Envia o arquivo DIRETO ao Supabase Storage.
 *   4. Avisa o backend para registrar a foto no banco.
 *
 * Por que não simplesmente mandar o arquivo para a API: a função serverless da
 * Vercel tem limite de tamanho de corpo de requisição, e uma foto de celular o
 * estoura. O upload falharia em produção — e funcionaria perfeitamente no meu
 * teste local, onde não há esse limite. É o tipo de bug que só aparece depois
 * do deploy.
 *
 * De quebra: economiza banda (o byte não trafega duas vezes) e é mais rápido
 * para o admin, que é quem espera na frente da tela.
 */

// O ARQUIVO GUARDADO É O TETO DE TUDO. O otimizador do site nunca amplia:
// se o mestre tem 1920px, nenhuma tela recebe mais que isso, por melhor que
// seja o monitor. E como o Next recomprime na entrega, todo byte economizado
// aqui é detalhe que morre antes de o site sequer ver a foto.
//
// 2560 porque a galeria numa tela Full HD 2x pede 2304px — com 1920 ela já
// nasceria curta. Medido: notebook comum pede 1728, Full HD pede 2304, iPhone
// 3x pede 1170.
//
// `MAX_SIZE_MB` é TETO, não alvo: com `alwaysKeepResolution` a biblioteca não
// pode encolher a foto para caber, então ela chega perto disso baixando
// qualidade e para. Folga aqui é o que garante que 2560px sobrevivam.
//: Abaixo disto a foto já entra no site sem pixel suficiente para a galeria,
//: e nada mais adiante recupera — o otimizador nunca amplia.
const LARGURA_MINIMA = 1600;

const MAX_SIZE_MB = 2.5;
const MAX_DIMENSION = 2560;

export function ImageUploader({
  vehicleId,
  images,
  onChange,
}: {
  vehicleId: string;
  images: VehicleImage[];
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  //: Avisos, não erros: a foto sobe do mesmo jeito. Bloquear obrigaria a loja a
  //: abrir um editor de imagem para conseguir anunciar um carro, o que faria
  //: ela simplesmente não anunciar.
  const [avisos, setAvisos] = useState<string[]>([]);

  const uploadOne = useCallback(
    async (file: File) => {
      // 1. Comprimir ANTES de qualquer coisa.
      //
      // Uma foto de iPhone tem 5–12 MB e 4000px de largura. O site nunca exibe
      // mais que 1920px, então os pixels a mais são desperdício puro: mais tempo
      // de upload, mais armazenamento, e uma página mais pesada para o comprador
      // que está no 4G.
      const compressed = await imageCompression(file, {
        maxSizeMB: MAX_SIZE_MB,
        maxWidthOrHeight: MAX_DIMENSION,
        // ALVO DE QUALIDADE, NÃO DE DIMENSÃO.
        //
        // Sem estas duas linhas a biblioteca persegue o limite de bytes
        // ENCOLHENDO A FOTO. O resultado em produção foram originais de
        // 953x1270 pesando 1,5 MB: resolução de miniatura num arquivo grande,
        // o pior dos dois mundos. Na tela, a foto do carro aparecia com menos
        // da metade dos pixels que a vitrine precisa e saía borrada.
        //
        // `alwaysKeepResolution` impede o encolhimento, e `initialQuality`
        // começa a compressão num ponto que já cabe no orçamento. O corte
        // inicial em MAX_DIMENSIONpx continua valendo — ele acontece antes, e é o que
        // impede uma foto de 4000px do iPhone de subir inteira.
        initialQuality: 0.9,
        alwaysKeepResolution: true,
        useWebWorker: true,
        fileType: 'image/webp',
      });

      // CONFERE A FOTO E AVISA. Sem isto o painel aceita em silêncio uma foto
      // pequena ou em pé, e o defeito só aparece no site depois de publicado —
      // que foi exatamente como as fotos de 953px em pé chegaram lá.
      const medida = await medirImagem(compressed);
      if (medida) {
        const novos: string[] = [];
        if (medida.largura < LARGURA_MINIMA) {
          novos.push(
            `Esta foto tem ${medida.largura}px de largura. O site mostra melhor a partir de ${LARGURA_MINIMA}px — abaixo disso ela aparece macia na tela grande, e não há como recuperar depois.`,
          );
        }
        if (medida.altura > medida.largura) {
          novos.push(
            'Foto em pé. O site mostra as fotos deitadas, então o corte vai tirar a parte de cima e de baixo do carro. Foto na horizontal mostra bem mais carro no mesmo espaço.',
          );
        }
        if (novos.length) setAvisos((a) => [...new Set([...a, ...novos])]);
      }

      // 2. Pedir autorização. O caminho do arquivo é gerado pelo SERVIDOR — um
      //    nome vindo do cliente poderia conter `../` ou sobrescrever a foto de
      //    outro anúncio.
      const { data: signed } = await http.post<{
        upload_url: string;
        token: string;
        storage_path: string;
        public_url: string;
      }>(`/admin/vehicles/${vehicleId}/images/upload-url`, {
        content_type: 'image/webp',
      });

      // 3. Enviar direto ao Storage. Repare: `fetch` puro, não o nosso `http` —
      //    esta requisição vai para o Supabase, não para a nossa API, e não deve
      //    levar o token de autenticação junto.
      //
      //    O token do upload assinado vai na QUERY STRING, não num header
      //    `Authorization`. O endpoint de upload assinado do Supabase lê
      //    `?token=`; mandando no header ele responde
      //    `400 querystring must have required property 'token'` — que é o que
      //    acontecia aqui, e por isso nenhuma foto subia.
      const uploadUrl = `${signed.upload_url}?token=${encodeURIComponent(signed.token)}`;

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: compressed,
      });

      if (!response.ok) {
        // A mensagem do Storage entra no erro: sem ela, qualquer falha aqui vira
        // "Algo deu errado" na tela, que não diz nada a quem precisa consertar.
        const detalhe = await response.text().catch(() => '');
        throw new Error(
          `Falha ao enviar a imagem para o servidor de arquivos. ` +
            `(HTTP ${response.status}${detalhe ? `: ${detalhe.slice(0, 200)}` : ''})`,
        );
      }

      // 4. Só agora o banco sabe que a foto existe. Nesta ordem: se o passo 3
      //    falhar, não fica um registro apontando para uma imagem inexistente —
      //    que apareceria quebrada na galeria do site.
      const dimensions = await readDimensions(compressed);

      // Sem `url`: o backend a deriva do `storage_path` (que ele mesmo gerou no
      // passo 2 e revalida agora). Mandar a URL daqui permitiria apontar a foto
      // do anúncio para um host qualquer.
      await http.post(`/admin/vehicles/${vehicleId}/images`, {
        storage_path: signed.storage_path,
        width: dimensions?.width,
        height: dimensions?.height,
      });
    },
    [vehicleId],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      setError(null);
      const list = Array.from(files);
      setUploading(list.length);

      // Sequencial, não em paralelo. Dez uploads simultâneos de um celular no
      // 4G disputam a mesma banda e todos ficam lentos — além de o contador de
      // progresso virar mentira.
      for (const file of list) {
        try {
          await uploadOne(file);
        } catch (err) {
          setError(errorMessage(err));
          break;
        } finally {
          setUploading((count) => count - 1);
        }
      }

      onChange();
      if (inputRef.current) inputRef.current.value = '';
    },
    [uploadOne, onChange],
  );

  const remove = async (imageId: string) => {
    try {
      await http.delete(`/admin/images/${imageId}`);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const setCover = async (imageId: string) => {
    try {
      await http.patch(`/admin/vehicles/${vehicleId}/images/${imageId}/cover`);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {avisos.length > 0 && (
        <div className="rounded-btn bg-warning-500/10 text-warning-700 mb-3 space-y-1.5 p-3.5 text-sm">
          {avisos.map((a) => (
            <p key={a} className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {a}
            </p>
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-btn bg-danger-500/10 text-danger-700 ring-danger-500/20 flex items-start gap-2.5 p-3.5 text-sm ring-1 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-card border-2 border-dashed p-8 text-center transition-colors',
          dragging ? 'border-brand-600 bg-accent-soft' : 'border-line bg-canvas',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="sr-only"
          id="upload-fotos"
          onChange={(e) => void handleFiles(e.target.files)}
        />

        {uploading > 0 ? (
          <div className="text-muted flex flex-col items-center gap-2 text-sm">
            <Loader2 className="text-accent size-6 animate-spin" />
            Enviando {uploading} {uploading === 1 ? 'foto' : 'fotos'}...
          </div>
        ) : (
          <label htmlFor="upload-fotos" className="cursor-pointer">
            <ImagePlus className="text-faint mx-auto size-8" />
            <p className="text-content mt-3 text-sm font-medium">
              Arraste as fotos aqui ou{' '}
              <span className="text-accent underline">escolha os arquivos</span>
            </p>
            <p className="text-faint mt-1 text-xs">
              JPG, PNG ou WebP. As imagens são comprimidas automaticamente antes do envio.
            </p>
          </label>
        )}
      </div>

      {images.length > 0 && (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <li
                key={image.id}
                className="group rounded-btn bg-sunken ring-line relative aspect-[4/3] overflow-hidden ring-1"
              >
                <Image
                  src={image.url}
                  alt={image.alt_text ?? ''}
                  fill
                  sizes="200px"
                  className="object-cover"
                />

                {image.is_cover && (
                  <span className="absolute top-2 left-2">
                    <Badge tone="dark">Capa</Badge>
                  </span>
                )}

                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {!image.is_cover && (
                    <button
                      type="button"
                      onClick={() => void setCover(image.id)}
                      className="rounded-btn text-content flex size-9 items-center justify-center bg-surface/90 transition-colors hover:bg-sunken"
                      aria-label="Definir como capa"
                      title="Definir como capa"
                    >
                      <Star className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(image.id)}
                    className="rounded-btn text-danger-700 flex size-9 items-center justify-center bg-surface/90 transition-colors hover:bg-sunken"
                    aria-label="Remover foto"
                    title="Remover foto"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-faint text-xs">
            {/* A capa é o que aparece no card da listagem. Se ela for a foto do
                porta-malas, ninguém clica. */}
            A foto de <strong>capa</strong> é a que aparece na busca. Passe o mouse sobre uma
            imagem para trocá-la.
          </p>
        </>
      )}
    </div>
  );
}

/** Lê as dimensões reais da imagem comprimida.
 *
 * Guardá-las permite ao `next/image` reservar o espaço antes de a foto carregar.
 * Sem isso, o layout "pula" quando a imagem chega — e Cumulative Layout Shift é
 * uma das três métricas de Core Web Vitals que o Google usa no ranqueamento.
 */
async function readDimensions(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}


/**
 * Largura e altura do arquivo já comprimido.
 *
 * Mede DEPOIS da compressão de propósito: é esse arquivo que vai para o
 * Storage e vira o teto de tudo. Medir o original diria o que a loja escolheu,
 * não o que o site vai ter.
 *
 * Navegador sem `createImageBitmap` só perde o aviso; o envio segue igual.
 */
async function medirImagem(arquivo: Blob): Promise<{ largura: number; altura: number } | null> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const medida = { largura: bitmap.width, altura: bitmap.height };
    bitmap.close();
    return medida;
  } catch {
    return null;
  }
}
