'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { BannerForm } from '@/features/banners/banner-form';
import type { HeroBanner } from '@/lib/api';
import { errorMessage, http } from '@/lib/http';

export default function AdminBannerPage() {
  const [banner, setBanner] = useState<HeroBanner | null>();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    http
      // A rota do painel devolve o banner LIGADO OU NÃO. A pública só devolve o
      // ligado — usá-la aqui faria a imagem sumir da tela ao desligar, e
      // religar exigiria subir tudo de novo.
      .get<HeroBanner | null>('/admin/banner')
      .then(({ data }) => { if (!cancelado) setBanner(data); })
      .catch((e) => { if (!cancelado) setErro(errorMessage(e)); });
    return () => { cancelado = true; };
  }, []);

  return (
    <div>
      <h1 className="text-content text-2xl font-bold tracking-tight">Banner da home</h1>
      <p className="text-muted mt-1 mb-6 max-w-2xl text-sm leading-relaxed">
        A imagem grande do topo do site. Serve para promoção, feirão ou campanha. Sem banner, o
        topo mostra a foto de vitrine padrão.
      </p>

      {erro && (
        <div role="alert" className="rounded-btn bg-danger-500/10 text-danger-700 flex items-start gap-2.5 p-3.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </div>
      )}

      {banner === undefined && !erro ? (
        <div className="rounded-card bg-sunken h-96 animate-pulse" />
      ) : (
        <BannerForm banner={banner ?? null} />
      )}
    </div>
  );
}
