'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CalendarCheck, CheckCircle2, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { errorMessage, http } from '@/lib/http';

/**
 * Modal de agendamento — o formulário que gera dinheiro.
 *
 * Cada envio bem-sucedido é um cliente querendo ver um carro. Por isso o
 * princípio aqui é REMOVER FRICÇÃO: pedimos o mínimo, validamos na hora e nunca
 * deixamos o usuário adivinhar o que deu errado.
 */

const schema = z.object({
  customer_name: z.string().min(2, 'Informe seu nome.').max(120, 'Nome muito longo.'),
  phone: z
    .string()
    // Validamos os DÍGITOS, não a máscara. O usuário digita "(11) 99999-8888";
    // exigir um formato exato aqui só criaria erro onde não há.
    .refine((value) => /^\d{10,11}$/.test(value.replace(/\D/g, '')), {
      message: 'Telefone inválido. Use DDD + número.',
    }),
  email: z.string().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
  scheduled_date: z.string().min(1, 'Escolha uma data.'),
  scheduled_time: z.string().min(1, 'Escolha um horário.'),
  notes: z.string().max(1000).optional(),
  // Campo-armadilha: escondido por CSS, humano nenhum o preenche. Robôs
  // preenchem tudo que encontram no HTML — e se preencherem, o backend descarta.
  website: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const HOURS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxDateISO(): string {
  const date = new Date();
  date.setDate(date.getDate() + 60); // mesma janela que a API aceita
  return date.toISOString().slice(0, 10);
}

/**
 * O modal é MONTADO apenas quando aberto (ver `VehicleActions`), e não escondido
 * com `display: none`.
 *
 * Isso não é detalhe de estilo: montar do zero faz o estado nascer limpo a cada
 * abertura. A alternativa — manter montado e limpar o estado num `useEffect` —
 * dispara renders em cascata e é justamente o antipadrão que o lint do React
 * aponta. Aqui, não há o que resetar, porque não há estado anterior.
 */
export function AppointmentModal({
  vehicleSlug,
  vehicleTitle,
  onClose,
}: {
  vehicleSlug: string;
  vehicleTitle: string;
  onClose: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customer_name: '', phone: '', email: '', notes: '' },
  });

  // Esc fecha, e a rolagem do fundo trava. Sem a trava, rolar dentro do modal
  // move a página atrás — e ao fechar, o usuário está noutro ponto da tela.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    try {
      await http.post('/appointments', {
        vehicle_slug: vehicleSlug,
        customer_name: values.customer_name,
        phone: values.phone.replace(/\D/g, ''),
        whatsapp: values.phone.replace(/\D/g, ''),
        email: values.email,
        scheduled_date: values.scheduled_date,
        scheduled_time: `${values.scheduled_time}:00`,
        notes: values.notes || undefined,
        website: values.website,
      });

      setSuccess(true);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agendamento-titulo"
        // No celular o modal sobe da base e ocupa a largura toda — é onde o
        // polegar alcança. Um card centralizado obrigaria a esticar o dedo.
        className="rounded-t-card sm:rounded-card max-h-[92dvh] w-full overflow-y-auto bg-white p-6 shadow-2xl sm:max-w-lg"
      >
        {success ? (
          <div className="py-6 text-center">
            <span className="bg-success-50 text-success-600 mx-auto flex size-14 items-center justify-center rounded-full">
              <CheckCircle2 className="size-7" />
            </span>
            <h2 className="text-ink-950 mt-5 text-xl font-bold">Visita agendada!</h2>
            <p className="text-ink-600 mt-2 text-sm leading-relaxed">
              Recebemos seu pedido. Entraremos em contato em breve para confirmar o horário.
            </p>
            <Button onClick={onClose} size="lg" className="mt-7 w-full">
              Fechar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="agendamento-titulo" className="text-ink-950 text-lg font-bold">
                  Agendar visita
                </h2>
                <p className="text-ink-500 mt-0.5 text-sm">{vehicleTitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-btn text-ink-400 hover:bg-ink-100 hover:text-ink-700 -mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center transition-colors"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              {serverError && (
                <div
                  role="alert"
                  className="rounded-btn bg-danger-50 text-danger-700 ring-danger-500/20 flex items-start gap-2.5 p-3.5 text-sm ring-1 ring-inset"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{serverError}</p>
                </div>
              )}

              <Field
                label="Seu nome"
                htmlFor="customer_name"
                error={errors.customer_name?.message}
                required
              >
                <Input
                  id="customer_name"
                  autoComplete="name"
                  placeholder="João da Silva"
                  aria-invalid={!!errors.customer_name}
                  {...register('customer_name')}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Telefone / WhatsApp"
                  htmlFor="phone"
                  error={errors.phone?.message}
                  required
                >
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    // `inputMode="numeric"` abre o teclado numérico no celular.
                    // Fazer o usuário procurar os números num teclado alfabético
                    // é fricção pura.
                    inputMode="numeric"
                    placeholder="(11) 99999-8888"
                    aria-invalid={!!errors.phone}
                    {...register('phone')}
                  />
                </Field>

                <Field label="E-mail" htmlFor="email" error={errors.email?.message} required>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@email.com"
                    aria-invalid={!!errors.email}
                    {...register('email')}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Data da visita"
                  htmlFor="scheduled_date"
                  error={errors.scheduled_date?.message}
                  required
                >
                  <Input
                    id="scheduled_date"
                    type="date"
                    // `min` e `max` no próprio campo: o calendário do navegador
                    // já não deixa escolher ontem nem o ano que vem. É a mesma
                    // regra do backend, aplicada antes de o usuário errar.
                    min={todayISO()}
                    max={maxDateISO()}
                    aria-invalid={!!errors.scheduled_date}
                    {...register('scheduled_date')}
                  />
                </Field>

                <Field
                  label="Horário"
                  htmlFor="scheduled_time"
                  error={errors.scheduled_time?.message}
                  required
                >
                  <select
                    id="scheduled_time"
                    className="rounded-btn border-ink-200 text-ink-900 hover:border-ink-300 focus:border-brand-600 focus:ring-brand-600/15 w-full cursor-pointer border bg-white px-3.5 py-2.5 pr-9 text-sm focus:ring-2 focus:outline-none"
                    aria-invalid={!!errors.scheduled_time}
                    {...register('scheduled_time')}
                  >
                    <option value="">Escolha</option>
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field
                label="Observações"
                htmlFor="notes"
                hint="Opcional — conte o que você quer saber ou avaliar."
              >
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Gostaria de fazer test drive e avaliar meu carro na troca."
                  {...register('notes')}
                />
              </Field>

              {/* Honeypot. Invisível para humanos (inclusive leitores de tela,
                  graças ao aria-hidden + tabIndex -1), irresistível para robôs. */}
              <div className="absolute left-[-9999px]" aria-hidden="true">
                <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
              </div>

              <Button
                type="submit"
                variant="success"
                size="lg"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  <>
                    <CalendarCheck className="size-4" />
                    Confirmar agendamento
                  </>
                )}
              </Button>

              <p className="text-ink-400 text-center text-xs">
                Sem compromisso. Entraremos em contato para confirmar.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
