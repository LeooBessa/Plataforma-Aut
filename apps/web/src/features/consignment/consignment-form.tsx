'use client';

import { useState, type ChangeEvent } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, Loader2, MessageCircle, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ShinyButton } from '@/components/ui/shiny-button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { WHATSAPP } from '@/lib/contato';
import { maskPhone, maskThousands, onlyDigits, whatsappLink } from '@/lib/format';
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
 * TODO CAMPO É TEXTO MASCARADO, NENHUM É `type="number"`
 * ----------------------------------------------------------------------------
 * Parece contraintuitivo em ano, km e preço, mas `type="number"` do HTML aceita
 * `e`, `E`, `+` e `-` — são notação científica e sinal, válidos para ele. Dava
 * para digitar "1e5" na quilometragem ou "-2000" no preço, e o campo mostrava
 * isso sem reclamar até o envio.
 *
 * `type="text"` + `inputMode="numeric"` mantém o teclado numérico no celular e
 * deixa a máscara decidir o que entra — e a máscara só deixa passar dígito.
 * Assim o campo fica impossível de sujar, em vez de sujo-e-recusado-depois.
 *
 * ----------------------------------------------------------------------------
 * DEPOIS DE ENVIAR, ABRE O WHATSAPP
 * ----------------------------------------------------------------------------
 * O pedido é gravado no banco (o painel tem o histórico e nada se perde), mas
 * quem acabou de enviar recebe um botão que abre a conversa com tudo já escrito.
 * Sem isso, o lead ficaria parado esperando alguém abrir o painel. Com isso, a
 * conversa começa no canal onde ela ia acontecer de qualquer jeito.
 */

const ANO_MAXIMO = new Date().getFullYear() + 1;

/** Os limites conferem com os do backend (`_validar`, em application/consignment). */
const KM_MAXIMO = 2_000_000;
const ANO_MINIMO = 1950;

const digitos = (v: string) => v.replace(/\D/g, '');

// Os campos numéricos são STRING no schema, não number: o que chega aqui é o
// texto já mascarado ("48.000"), e `z.coerce.number()` leria isso como 48.
// A conversão para número acontece uma vez só, no envio.
const schema = z.object({
  owner_name: z.string().min(2, 'Informe seu nome.').max(120, 'Nome muito longo.'),
  phone: z
    // Validamos os DÍGITOS, não a máscara — ela é só apresentação.
    .string()
    .refine((v) => /^\d{10,11}$/.test(digitos(v)), {
      message: 'Telefone incompleto. Use DDD + número.',
    }),
  vehicle: z.string().min(2, 'Diga qual é o carro.').max(160, 'Descrição muito longa.'),
  year: z
    .string()
    .refine((v) => digitos(v).length === 4, { message: 'Informe o ano com 4 dígitos.' })
    .refine(
      (v) => {
        const ano = Number(digitos(v));
        return ano >= ANO_MINIMO && ano <= ANO_MAXIMO;
      },
      { message: `Ano entre ${ANO_MINIMO} e ${ANO_MAXIMO}.` },
    ),
  mileage: z
    .string()
    .refine((v) => digitos(v).length > 0, { message: 'Informe a quilometragem.' })
    .refine((v) => Number(digitos(v)) <= KM_MAXIMO, { message: 'Quilometragem alta demais.' }),
  asking_price: z
    .string()
    .refine((v) => Number(digitos(v)) > 0, { message: 'Informe quanto quer pelo carro.' }),
  city: z.string().max(80, 'Nome muito longo.').optional(),
  notes: z.string().max(1000, 'Texto muito longo.').optional(),
  // Campo-armadilha: escondido por CSS, humano nenhum o preenche.
  website: z.string().optional(),
});

type FormValues = z.input<typeof schema>;

// Todos começam em string vazia. Sem isso o campo nasce `undefined` e o zod
// recusa com a mensagem genérica dele ("expected string, received undefined"),
// em inglês — e é também o que faz o `reset()` devolver o formulário limpo.
const VAZIO: FormValues = {
  owner_name: '',
  phone: '',
  vehicle: '',
  year: '',
  mileage: '',
  asking_price: '',
  city: '',
  notes: '',
  website: '',
};

export function ConsignmentForm() {
  const [enviado, setEnviado] = useState<FormValues | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: VAZIO });

  /**
   * `register` com máscara aplicada a cada tecla.
   *
   * Reescreve `e.target.value` ANTES de repassar ao react-hook-form. Como ele lê
   * o valor direto do evento, o estado do formulário e o que aparece na tela
   * ficam sempre iguais — não há um "valor real" escondido atrás da máscara.
   */
  const comMascara = (campo: Path<FormValues>, mascara: (v: string) => string) => {
    const reg = register(campo);
    return {
      ...reg,
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        e.target.value = mascara(e.target.value);
        return reg.onChange(e);
      },
    };
  };

  const onSubmit = async (values: FormValues) => {
    setErro(null);
    try {
      await http.post('/consignments', {
        owner_name: values.owner_name,
        phone: values.phone,
        vehicle: values.vehicle,
        year: Number(digitos(values.year)),
        mileage: Number(digitos(values.mileage)),
        asking_price: Number(digitos(values.asking_price)),
        city: values.city || undefined,
        notes: values.notes || undefined,
        website: values.website || undefined,
      });
      setEnviado(values);
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  const novoAnuncio = () => {
    reset(VAZIO);
    setErro(null);
    setEnviado(null);
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
          Já está com a nossa equipe. Se quiser adiantar, chame no WhatsApp e mande as fotos.
          É o que mais acelera a avaliação.
        </p>

        {/* Duas saídas, EMPILHADAS e com pesos bem diferentes.
            O WhatsApp é o que fecha negócio e continua sendo o botão cheio;
            "outro carro" é para quem tem mais de um para vender — acontece, e
            sem ele a pessoa precisaria recarregar a página.

            Lado a lado os dois não cabem na largura do cartão e o rótulo do
            WhatsApp quebra em duas linhas, o que faz o botão principal parecer
            o improvisado dos dois. Empilhado, cada um ocupa a sua linha e a
            ordem já diz qual é o caminho esperado. */}
        <div className="mt-6 flex flex-col items-center gap-1">
          <a
            href={whatsappLink(WHATSAPP, mensagem)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-btn bg-success-700 hover:bg-success-800 inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold whitespace-nowrap text-white transition-colors"
          >
            <MessageCircle className="size-4" />
            Continuar no WhatsApp
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={novoAnuncio}>
            <Plus className="size-4" />
            Anunciar outro carro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {erro && (
        <div
          role="alert"
          className="rounded-btn bg-danger-500/10 text-danger-700 ring-danger-500/20 flex items-start gap-2.5 p-3.5 text-sm ring-1 ring-inset"
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
            inputMode="numeric"
            placeholder="2021"
            aria-invalid={!!errors.year}
            {...comMascara('year', (v) => onlyDigits(v, 4))}
          />
        </Field>

        <Field label="Quilometragem" htmlFor="mileage" error={errors.mileage?.message} required>
          <Input
            id="mileage"
            inputMode="numeric"
            placeholder="48.000"
            aria-invalid={!!errors.mileage}
            {...comMascara('mileage', maskThousands)}
          />
        </Field>

        <Field
          label="Quanto quer?"
          htmlFor="asking_price"
          error={errors.asking_price?.message}
          required
        >
          <div className="relative">
            <span
              aria-hidden
              className="text-faint pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
            >
              R$
            </span>
            <Input
              id="asking_price"
              inputMode="numeric"
              placeholder="92.000"
              className="pl-9"
              aria-invalid={!!errors.asking_price}
              {...comMascara('asking_price', maskThousands)}
            />
          </div>
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

        {/* O DDD fica só no placeholder, nunca preenchido. A loja é de Natal,
            mas quem anuncia pode estar em qualquer lugar — um "(84)" já no
            campo faria alguém de fora enviar o número errado sem perceber. */}
        <Field label="WhatsApp" htmlFor="phone" error={errors.phone?.message} required>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(84) 99999-9999"
            aria-invalid={!!errors.phone}
            {...comMascara('phone', maskPhone)}
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

      <ShinyButton type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Enviando...
          </>
        ) : (
          'Quero anunciar meu carro'
        )}
      </ShinyButton>
    </form>
  );
}
