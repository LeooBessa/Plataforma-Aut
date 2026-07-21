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

const MAX_SIZE_MB = 1.5;
const MAX_DIMENSION = 1920;

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
        useWebWorker: true, // não trava a interface durante a compressão
        fileType: 'image/webp',
      });

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
      const response = await fetch(signed.upload_url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${signed.token}`,
          'Content-Type': 'image/webp',
        },
        body: compressed,
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar a imagem para o servidor de arquivos.');
      }

      // 4. Só agora o banco sabe que a foto existe. Nesta ordem: se o passo 3
      //    falhar, não fica um registro apontando para uma imagem inexistente —
      //    que apareceria quebrada na galeria do site.
      const dimensions = await readDimensions(compressed);

      await http.post(`/admin/vehicles/${vehicleId}/images`, {
        storage_path: signed.storage_path,
        url: signed.public_url,
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
      {error && (
        <div
          role="alert"
          className="rounded-btn bg-danger-500/10 text-danger-400 ring-danger-500/20 flex items-start gap-2.5 p-3.5 text-sm ring-1 ring-inset"
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
          dragging ? 'border-brand-600 bg-brand-600/10' : 'border-ink-800 bg-ink-950',
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
          <div className="text-silver-400 flex flex-col items-center gap-2 text-sm">
            <Loader2 className="text-brand-400 size-6 animate-spin" />
            Enviando {uploading} {uploading === 1 ? 'foto' : 'fotos'}...
          </div>
        ) : (
          <label htmlFor="upload-fotos" className="cursor-pointer">
            <ImagePlus className="text-silver-600 mx-auto size-8" />
            <p className="text-silver-100 mt-3 text-sm font-medium">
              Arraste as fotos aqui ou{' '}
              <span className="text-brand-400 underline">escolha os arquivos</span>
            </p>
            <p className="text-silver-500 mt-1 text-xs">
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
                className="group rounded-btn bg-ink-850 ring-ink-800 relative aspect-[4/3] overflow-hidden ring-1"
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
                      className="rounded-btn text-silver-100 flex size-9 items-center justify-center bg-ink-900/90 transition-colors hover:bg-ink-800"
                      aria-label="Definir como capa"
                      title="Definir como capa"
                    >
                      <Star className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(image.id)}
                    className="rounded-btn text-danger-400 flex size-9 items-center justify-center bg-ink-900/90 transition-colors hover:bg-ink-800"
                    aria-label="Remover foto"
                    title="Remover foto"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-silver-500 text-xs">
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
