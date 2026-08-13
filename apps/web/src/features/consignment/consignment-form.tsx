'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, Loader2, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { WHATSAPP } from '@/lib/contato';
import { whatsappLink } from '@/lib/format';
import { errorMessage, http } from '@/lib/http';

/**
 * "Anuncie seu carro" — o formulário que traz ESTOQUE.
 *
 * O agendamento traz comprador; este traz carro para vender. São os dois lados
 * do negócio, e por isso os dois entram sem login: exigir cadastro para dizer
 * "tenho um carro" derruba a conversão a quase zero, e o carro vai para a loja
 * concorrente.
 *
 * ----------------------------------------------------------------------------
 * CURTO DE PROPÓSITO — e por que não pede foto
 * ----------------------------------------------------------------------------
 * Cada campo a mais derruba o número de envios, e foto é o maior motivo de
 * abandono num formulário de celular: a pessoa precisa parar, ir até o carro e
 * fotografar. Além disso, upload público significaria deixar qualquer um
 * escrever no Storage da loja — hoje isso exige login de admin, e com razão.
 *
 * As fotos vêm na conversa do WhatsApp, que é onde são mais úteis: a loja pede
 * os ângulos que quiser e a pessoa manda na hora.
 *
 * ----------------------------------------------------------------------------
 * DEPOIS DE ENVIAR, ABRE O WHATSAPP
 * ----------------------------------------------------------------------------
 * O pedido é gravado no banco (o painel tem o histórico e nada se perde), mas
 * quem acabou de enviar recebe um botão que abre a conversa com tudo já escrito.
 * Sem isso, o lead ficaria parado esperando alguém abrir o painel. Com isso, a
 * conversa começa no canal onde ela ia acontecer de qualquer jeito.
 */

const schema = z.object({
  owner_name: z.string().min(2, 'Informe seu nome.').max(120, 'Nome muito longo.'),
  phone: z
    .string()
    // Validamos os DÍGITOS, não a máscara — o usuário escreve como preferir.
    .refine((v) => /^\d{10,11}$/.test(v.replace(/\D/g, '')), {
      message: 'Telefone inválido. Use DDD + número.',
    }),
  vehicle: z
    .string()
    .min(2, 'Diga qual é o carro.')
    .max(160, 'Descrição muito longa.'),
  year: z.coerce
    .number({ message: 'Informe o ano.' })
    .int()
    .min(1950, 'Ano inválido.')
    .max(new Date().getFullYear() + 1, 'Ano inválido.'),
  mileage: z.coerce
    .number({ message: 'Informe a quilometragem.' })
    .int()
    .min(0, 'Quilometragem inválida.')
    .max(2_000_000, 'Quilometragem inválida.'),
  asking_price: z.coerce
    .number({ message: 'Informe quanto quer pelo carro.' })
    .positive('Informe um valor válido.'),
  city: z.string().max(80).optional(),
  notes: z.string().max(1000).optional(),
  // Campo-armadilha: escondido por CSS, humano nenhum o preenche.
  website: z.string().optional(),
});

type FormValues = z.input<typeof schema>;

export function ConsignmentForm() {
  const [enviado, setEnviado] = useState<FormValues | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setErro(null);
    try {
      await http.post('/consignments', {
        owner_name: values.owner_name,
        phone: values.phone,
        vehicle: values.vehicle,
        year: Number(values.year),
        mileage: Number(values.mileage),
        asking_price: Number(values.asking_price),
        city: values.city || undefined,
        notes: values.notes || undefined,
        website: values.website || undefined,
      });
      setEnviado(values);
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  if (enviado) {
    const mensagem = [
      `Olá! Acabei de enviar meu carro no site da Giro Auto.`,
      ``,
      `Carro: ${enviado.vehicle}`,
      `Ano: ${enviado.year}`,
      `KM: ${enviado.mileage}`,
      `Valor pretendido: R$ ${enviado.asking_price}`,
      enviado.city ? `Cidade: ${enviado.city}` : '',
      ``,
      `Meu nome é ${enviado.owner_name}.`,
    ]
      .filter(Boolean)
      .join('\n');

    return (
      <div className="rounded-card bg-surface ring-line p-8 text-center ring-1">
        <CheckCircle2 className="text-success-500 mx-auto size-10" />
        <h3 className="text-content mt-4 text-xl font-bold">Recebemos seu carro!</h3>
        <p className="text-muted mx-auto mt-2 max-w-sm text-sm">
          Já está com a nossa equipe. Se quiser adiantar, chame no WhatsApp e mande as fotos —
          é o que mais acelera a avaliação.
        </p>
        <a
          href={whatsappLink(WHATSAPP, mensagem)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-btn bg-success-700 mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-success-800"
        >
          <MessageCircle className="size-4" />
          Continuar no WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {erro && (
        <div
          role="alert"
          className="rounded-btn bg-danger-500/10 text-danger-400 ring-danger-500/20 flex items-start gap-2.5 p-3.5 text-sm ring-1 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </div>
      )}

      <Field label="Qual é o carro?" htmlFor="vehicle" error={errors.vehicle?.message} required>
        <Input
          id="vehicle"
          placeholder="Ex: Fiat Toro Freedom 1.8 2021"
          autoComplete="off"
          aria-invalid={!!errors.vehicle}
          {...register('vehicle')}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ano" htmlFor="year" error={errors.year?.message} required>
          <Input
            id="year"
            type="number"
            inputMode="numeric"
            placeholder="2021"
            aria-invalid={!!errors.year}
            {...register('year')}
          />
        </Field>

        <Field label="Quilometragem" htmlFor="mileage" error={errors.mileage?.message} required>
          <Input
            id="mileage"
            type="number"
            inputMode="numeric"
            placeholder="48000"
            aria-invalid={!!errors.mileage}
            {...register('mileage')}
          />
        </Field>

        <Field
          label="Quanto quer?"
          htmlFor="asking_price"
          error={errors.asking_price?.message}
          required
        >
          <Input
            id="asking_price"
            type="number"
            inputMode="numeric"
            placeholder="92000"
            aria-invalid={!!errors.asking_price}
            {...register('asking_price')}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seu nome" htmlFor="owner_name" error={errors.owner_name?.message} required>
          <Input
            id="owner_name"
            autoComplete="name"
            aria-invalid={!!errors.owner_name}
            {...register('owner_name')}
          />
        </Field>

        <Field label="WhatsApp" htmlFor="phone" error={errors.phone?.message} required>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(84) 99999-9999"
            aria-invalid={!!errors.phone}
            {...register('phone')}
          />
        </Field>
      </div>

      <Field label="Cidade" htmlFor="city" error={errors.city?.message}>
        <Input id="city" placeholder="Natal" autoComplete="address-level2" {...register('city')} />
      </Field>

      <Field label="Algo mais sobre o carro?" htmlFor="notes" error={errors.notes?.message}>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Único dono, revisões em dia, algum detalhe na lataria…"
          {...register('notes')}
        />
      </Field>

      {/* Campo-armadilha. `aria-hidden` e `tabIndex={-1}` para que leitor de tela
          e navegação por teclado nunca cheguem nele — a armadilha é para robô,
          não para quem usa tecnologia assistiva. */}
      <div aria-hidden className="hidden">
        <input tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Enviando...
          </>
        ) : (
          'Quero anunciar meu carro'
        )}
      </Button>
    </form>
  );
}
