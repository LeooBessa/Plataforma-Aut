'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { VehicleForm } from '@/features/vehicles/vehicle-form';

export default function NovoVeiculoPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/admin/veiculos"
          className="text-silver-500 hover:text-silver-100 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Voltar aos anúncios
        </Link>

        <h1 className="text-silver-100 mt-3 text-2xl font-bold tracking-tight">Novo anúncio</h1>
        <p className="text-silver-500 mt-1 text-sm">
          O anúncio nasce como <strong>rascunho</strong>. Depois de salvar, você adiciona as
          fotos e publica — um anúncio sem foto não pode ir ao ar.
        </p>
      </div>

      <VehicleForm />
    </div>
  );
}
