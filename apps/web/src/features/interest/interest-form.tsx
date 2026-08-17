'use client';

import { useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, BellRing, CheckCircle2, Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { ShinyButton } from '@/components/ui/shiny-button';
import type { CatalogBrand } from '@/lib/api';
import { maskPhone, maskThousands } from '@/lib/format';
import { errorMessage, http } from '@/lib/http';
import { BODY_LABELS } from '@/lib/labels';

/**
 * "Me avise quando chegar" — o formulário que traz COMPRADOR sem carro.
 *
 * O site já tem duas portas: o agendamento, para quem achou o carro, e o
 * "anuncie seu carro", para quem quer vender. Faltava a terceira, e é a de quem
 * mais some: o visitante que procurou, não achou nada com a cara dele e foi
 * embora. Esse é o lead mais barato que existe — já demonstrou intenção e ainda
 * não comprou em lugar nenhum.
 *
 * ----------------------------------------------------------------------------
 * MARCA VEM DO CATÁLOGO, NÃO DE TEXTO LIVRE
 * ----------------------------------------------------------------------------
 * É o inverso do "anuncie seu carro", e de propósito: lá quem escreve SABE o
 * carro que tem e digitar é mais rápido. Aqui o pedido só vale se cruzar com o
 * estoque, e cruzamento por texto não funciona — "fiat toro", "Toro" e "Fiat
 * TORO" seriam três coisas para o banco.
 *
 * ----------------------------------------------------------------------------
 * SÓ MARCA E ORÇAMENTO SÃO OBRIGATÓRIOS
 * ----------------------------------------------------------------------------
 * Modelo e categoria ficam opcionais porque "qualquer Fiat até 40 mil" é pedido
 * legítimo, e provavelmente o mais comum. O orçamento é obrigatório porque sem
 * ele todo aviso vira tiro no escuro: é o teto que decide se um carro é
 * oportunidade ou incômodo.
 */

const digitos = (v: string) => v.replace(/\D/g, '');

const schema = z.object({
  name: z.string().min(2, 'Informe seu nome.').max(120, 'Nome muito longo.'),
  phone: z.string().refine((v) => /^\d{10,11}$/.test(digitos(v)), {
    message: 'Telefone incompleto. Use DDD + número.',
  }),
  // O e-mail é opcional, mas se vier tem de ser válido: guardar endereço
  // quebrado é pior que não guardar — dá a impressão de que há um canal.
  email: z.union([z.literal(''), z.string().email('E-mail inválido.')]).optional(),
  brand_id: z.string().min(1, 'Escolha a marca.'),
  model_id: z.string().optional(),
  body_type: z.string().optional(),
  max_price: z
    .string()
    .refine((v) => Number(digitos(v)) >= 1000, { message: 'Informe pelo menos R$ 1.000.' }),
  notes: z.string().max(1000, 'Texto muito longo.').optional(),
  website: z.string().optional(),
});

type FormValues = z.input<typeof schema>;

const VAZIO: FormValues = {
  name: '',
  phone: '',
  email: '',
  brand_id: '',
  model_id: '',
  body_type: '',
  max_price: '',
  notes: '',
  website: '',
};

export function InterestForm({ brands }: { brands: CatalogBrand[] }) {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: VAZIO });

  const marcaEscolhida = watch('brand_id');
  const modeloEscolhido = watch('model_id');
  const modelos = brands.find((b) => b.id === marcaEscolhida)?.models ?? [];

  const comMascara = (campo: 'phone' | 'max_price', mascara: (v: string) => string) => {
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
      await http.post('/interests', {
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        brand_id: values.brand_id,
        model_id: values.model_id || undefined,
        body_type: values.body_type || undefined,
        max_price: Number(digitos(values.max_price)),
        notes: values.notes || undefined,
        website: values.website || undefined,
      });
      setEnviado(true);
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  if (enviado) {
    return (
      <div className="rounded-card bg-surface ring-line p-8 text-center ring-1">
        <CheckCircle2 className="text-success-500 mx-auto size-10" />
        <h3 className="text-content mt-4 text-xl font-bold">Estamos de olho!</h3>
        <p className="text-muted mx-auto mt-2 max-w-sm text-sm">
          Assim que entrar um carro com esse perfil, a gente te chama no WhatsApp. Sem
          disparo automático: quem vai te avisar é a nossa equipe.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-6"
          onClick={() => {
            reset(VAZIO);
            setEnviado(false);
          }}
        >
          <Plus className="size-4" />
          Cadastrar outro perfil
        </Button>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marca" htmlFor="brand_id" error={errors.brand_id?.message} required>
          <Select
            id="brand_id"
            aria-invalid={!!errors.brand_id}
            {...register('brand_id')}
            onChange={(e) => {
              setValue('brand_id', e.target.value);
              // Trocar a marca LIMPA o modelo. Sem isto sobraria "Fiat + Corolla",
              // que a API recusa — e o erro apareceria só no envio.
              setValue('model_id', '');
            }}
          >
            <option value="">Escolha a marca</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Modelo" htmlFor="model_id" error={errors.model_id?.message}>
          <Select
            id="model_id"
            disabled={!marcaEscolhida}
            {...register('model_id')}
            onChange={(e) => {
              setValue('model_id', e.target.value);
              // Escolher o modelo LIMPA a categoria — e é o que impede pedidos
              // impossíveis. O catálogo não guarda a categoria de cada modelo,
              // então nada impediria "RAM Rampage + Conversível": a Rampage é
              // picape, o cruzamento nunca acharia nada, e o pedido ficaria
              // parado para sempre sem ninguém entender por quê.
              if (e.target.value) setValue('body_type', '');
            }}
          >
            <option value="">
              {marcaEscolhida ? 'Tanto faz o modelo' : 'Escolha a marca primeiro'}
            </option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* A categoria só existe para quem NÃO sabe o modelo — "qualquer SUV da
            Fiat até 80 mil". Nomeado o modelo, ela não acrescenta informação
            nenhuma e só pode contradizer, então some da tela. */}
        {!modeloEscolhido && (
          <Field label="Categoria" htmlFor="body_type" error={errors.body_type?.message}>
            <Select id="body_type" {...register('body_type')}>
              <option value="">Tanto faz</option>
              {Object.entries(BODY_LABELS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field
          label="Até quanto quer gastar?"
          htmlFor="max_price"
          error={errors.max_price?.message}
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
              id="max_price"
              inputMode="numeric"
              placeholder="60.000"
              className="pl-9"
              aria-invalid={!!errors.max_price}
              {...comMascara('max_price', maskThousands)}
            />
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seu nome" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
        </Field>

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

      <Field label="E-mail (opcional)" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
      </Field>

      <Field label="Mais alguma preferência?" htmlFor="notes" error={errors.notes?.message}>
        <Textarea
          id="notes"
          rows={2}
          placeholder="Automático, baixa quilometragem, cor clara…"
          {...register('notes')}
        />
      </Field>

      {/* Campo-armadilha, para robô. `aria-hidden` e `tabIndex={-1}` para que
          leitor de tela e navegação por teclado nunca cheguem nele. */}
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
          <>
            <BellRing className="size-4" />
            Quero ser avisado
          </>
        )}
      </ShinyButton>
    </form>
  );
}
