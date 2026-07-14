'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import type { VehicleDetail } from '@/lib/api';
import { errorMessage, http } from '@/lib/http';
import { BODY_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/labels';
import type { components } from '@/types/api';

type AdminCatalog = components['schemas']['AdminCatalogOut'];

/**
 * Formulário de anúncio — serve para CRIAR e para EDITAR.
 *
 * Um componente só, de propósito. Dois formulários separados divergiriam: alguém
 * adicionaria um campo no cadastro e esqueceria da edição, e o admin passaria a
 * perder aquele dado toda vez que editasse um anúncio. É o tipo de bug que
 * ninguém percebe até um cliente reclamar que a informação sumiu.
 */

const CURRENT_YEAR = new Date().getFullYear();

const schema = z
  .object({
    brand_id: z.string().uuid('Escolha a marca.'),
    model_id: z.string().uuid('Escolha o modelo.'),
    version: z.string().max(120).optional(),

    year_manufacture: z.coerce
      .number()
      .int()
      .min(1900, 'Ano inválido.')
      .max(CURRENT_YEAR + 1, 'Ano inválido.'),
    year_model: z.coerce
      .number()
      .int()
      .min(1900, 'Ano inválido.')
      .max(CURRENT_YEAR + 2, 'Ano inválido.'),

    price: z.coerce.number().positive('O preço precisa ser maior que zero.'),
    mileage: z.coerce.number().int().min(0, 'Quilometragem inválida.'),

    fuel_type: z.string().min(1, 'Escolha o combustível.'),
    transmission: z.string().min(1, 'Escolha o câmbio.'),
    body_type: z.string().min(1, 'Escolha a categoria.'),

    color: z.string().min(2, 'Informe a cor.').max(40),
    city: z.string().min(2, 'Informe a cidade.').max(80),
    state: z.string().length(2, 'Use a sigla do estado (ex: SP).'),

    doors: z.coerce.number().int().min(1).max(6).optional().or(z.literal('')),
    engine: z.string().max(40).optional(),
    horsepower: z.coerce.number().int().min(1).max(2000).optional().or(z.literal('')),
    owners_count: z.coerce.number().int().min(0).max(50).optional().or(z.literal('')),

    has_manual: z.boolean(),
    has_spare_key: z.boolean(),
    ipva_paid: z.boolean(),
    licensing_paid: z.boolean(),
    service_history: z.string().max(2000).optional(),

    description: z.string().max(5000).optional(),

    accepts_financing: z.boolean(),
    accepts_trade: z.boolean(),
    down_payment: z.coerce.number().min(0).optional().or(z.literal('')),
    installments_count: z.coerce.number().int().min(1).max(120).optional().or(z.literal('')),

    is_featured: z.boolean(),
    feature_ids: z.array(z.string()),
  })
  // As regras que dependem de DOIS campos ficam aqui, e o erro é anexado ao
  // campo certo — senão o usuário vê "erro no formulário" sem saber onde.
  .refine((data) => data.year_model >= data.year_manufacture, {
    message: 'O ano do modelo não pode ser anterior ao de fabricação.',
    path: ['year_model'],
  })
  .refine((data) => !data.down_payment || Number(data.down_payment) < Number(data.price), {
    message: 'A entrada precisa ser menor que o valor do veículo.',
    path: ['down_payment'],
  });

type FormValues = z.input<typeof schema>;

export function VehicleForm({ vehicle }: { vehicle?: VehicleDetail }) {
  const router = useRouter();
  const isEdit = Boolean(vehicle);

  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(vehicle),
  });

  useEffect(() => {
    http
      .get<AdminCatalog>('/admin/catalog')
      .then(({ data }) => setCatalog(data))
      .catch((err) => setServerError(errorMessage(err)));
  }, []);

  const brandId = watch('brand_id');
  const selectedFeatures = watch('feature_ids');

  const models = useMemo(
    () => catalog?.brands.find((b) => b.id === brandId)?.models ?? [],
    [catalog, brandId],
  );

  // Agrupa os opcionais por categoria: 18 checkboxes numa lista corrida são
  // ilegíveis. Em blocos (Segurança, Conforto...), o admin acha o que procura.
  const featureGroups = useMemo(() => {
    const groups = new Map<string, AdminCatalog['features']>();
    const LABELS: Record<string, string> = {
      safety: 'Segurança',
      comfort: 'Conforto',
      technology: 'Tecnologia',
      performance: 'Desempenho',
      exterior: 'Exterior',
      interior: 'Interior',
    };

    for (const feature of catalog?.features ?? []) {
      const key = LABELS[feature.category] ?? 'Outros';
      groups.set(key, [...(groups.get(key) ?? []), feature]);
    }

    return [...groups.entries()];
  }, [catalog]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    // Campos numéricos vazios viram `undefined`, não `""` nem `0`. A API espera
    // ausência; uma string vazia viraria 422, e um zero significaria "zero
    // portas" — que é diferente de "não informado".
    const payload = {
      ...values,
      version: values.version || undefined,
      engine: values.engine || undefined,
      description: values.description || undefined,
      service_history: values.service_history || undefined,
      doors: emptyToUndefined(values.doors),
      horsepower: emptyToUndefined(values.horsepower),
      owners_count: emptyToUndefined(values.owners_count),
      down_payment: emptyToUndefined(values.down_payment),
      installments_count: emptyToUndefined(values.installments_count),
      price: String(values.price),
    };

    try {
      if (isEdit && vehicle) {
        await http.put(`/admin/vehicles/${vehicle.id}`, payload);
        router.refresh();
      } else {
        const { data } = await http.post<VehicleDetail>('/admin/vehicles', payload);
        // Depois de criar, vai direto para a edição — é onde ficam as FOTOS.
        // Sem foto, o anúncio nem pode ser publicado; mandar o admin de volta
        // para a lista o deixaria com um rascunho inútil e sem pista do que
        // fazer em seguida.
        router.push(`/admin/veiculos/${data.id}`);
        return;
      }
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  if (!catalog) {
    return (
      <div className="text-ink-500 flex items-center gap-3 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando marcas e opcionais...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      {serverError && (
        <div
          role="alert"
          className="rounded-card bg-danger-50 text-danger-700 ring-danger-500/20 flex items-start gap-2.5 p-4 text-sm ring-1 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {serverError}
        </div>
      )}

      <Section title="Identificação">
        <Field label="Marca" htmlFor="brand_id" error={errors.brand_id?.message} required>
          <Select
            id="brand_id"
            {...register('brand_id')}
            onChange={(e) => {
              setValue('brand_id', e.target.value);
              // Trocar a marca LIMPA o modelo. Sem isto, sobraria "Toyota +
              // Civic" — e a API rejeitaria com "o modelo não pertence à marca",
              // um erro que o admin não entenderia.
              setValue('model_id', '');
            }}
          >
            <option value="">Selecione</option>
            {catalog.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Modelo" htmlFor="model_id" error={errors.model_id?.message} required>
          <Select id="model_id" disabled={!brandId} {...register('model_id')}>
            <option value="">{brandId ? 'Selecione' : 'Escolha a marca primeiro'}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Versão"
          htmlFor="version"
          hint="Ex: XEi 2.0 Flex"
          error={errors.version?.message}
        >
          <Input id="version" {...register('version')} />
        </Field>
      </Section>

      <Section title="Ano, preço e uso">
        <Field
          label="Ano de fabricação"
          htmlFor="year_manufacture"
          error={errors.year_manufacture?.message}
          required
        >
          <Input id="year_manufacture" type="number" {...register('year_manufacture')} />
        </Field>

        <Field
          label="Ano do modelo"
          htmlFor="year_model"
          error={errors.year_model?.message}
          hint="No Brasil, fabricação e modelo podem ser anos diferentes."
          required
        >
          <Input id="year_model" type="number" {...register('year_model')} />
        </Field>

        <Field label="Preço (R$)" htmlFor="price" error={errors.price?.message} required>
          <Input id="price" type="number" step="0.01" {...register('price')} />
        </Field>

        <Field label="Quilometragem" htmlFor="mileage" error={errors.mileage?.message} required>
          <Input id="mileage" type="number" {...register('mileage')} />
        </Field>
      </Section>

      <Section title="Ficha técnica">
        <Field
          label="Combustível"
          htmlFor="fuel_type"
          error={errors.fuel_type?.message}
          required
        >
          <Select id="fuel_type" {...register('fuel_type')}>
            <option value="">Selecione</option>
            {Object.entries(FUEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Câmbio"
          htmlFor="transmission"
          error={errors.transmission?.message}
          required
        >
          <Select id="transmission" {...register('transmission')}>
            <option value="">Selecione</option>
            {Object.entries(TRANSMISSION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Categoria" htmlFor="body_type" error={errors.body_type?.message} required>
          <Select id="body_type" {...register('body_type')}>
            <option value="">Selecione</option>
            {Object.entries(BODY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Cor" htmlFor="color" error={errors.color?.message} required>
          <Input id="color" {...register('color')} />
        </Field>

        <Field label="Motor" htmlFor="engine" hint="Ex: 2.0 Turbo">
          <Input id="engine" {...register('engine')} />
        </Field>

        <Field label="Potência (cv)" htmlFor="horsepower">
          <Input id="horsepower" type="number" {...register('horsepower')} />
        </Field>

        <Field label="Portas" htmlFor="doors">
          <Input id="doors" type="number" {...register('doors')} />
        </Field>

        <Field label="Nº de proprietários" htmlFor="owners_count">
          <Input id="owners_count" type="number" {...register('owners_count')} />
        </Field>
      </Section>

      <Section title="Localização">
        <Field label="Cidade" htmlFor="city" error={errors.city?.message} required>
          <Input id="city" {...register('city')} />
        </Field>

        <Field label="Estado (UF)" htmlFor="state" error={errors.state?.message} required>
          <Input id="state" maxLength={2} placeholder="SP" {...register('state')} />
        </Field>
      </Section>

      <Section title="Documentação e histórico" columns={1}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox label="IPVA pago" {...register('ipva_paid')} />
          <Checkbox label="Licenciamento em dia" {...register('licensing_paid')} />
          <Checkbox label="Manual do proprietário" {...register('has_manual')} />
          <Checkbox label="Chave reserva" {...register('has_spare_key')} />
        </div>

        <Field
          label="Histórico de revisões"
          htmlFor="service_history"
          hint="Onde foi revisado, o que foi trocado. Transparência aqui converte."
        >
          <Textarea id="service_history" rows={3} {...register('service_history')} />
        </Field>
      </Section>

      <Section title="Descrição" columns={1}>
        <Field
          label="Descrição do anúncio"
          htmlFor="description"
          hint="Texto puro. Conte o que o comprador quer saber antes de perguntar."
        >
          <Textarea id="description" rows={5} {...register('description')} />
        </Field>
      </Section>

      <Section title="Financiamento" columns={1}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox label="Aceita financiamento" {...register('accepts_financing')} />
          <Checkbox label="Aceita carro na troca" {...register('accepts_trade')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Entrada sugerida (R$)"
            htmlFor="down_payment"
            error={errors.down_payment?.message}
          >
            <Input id="down_payment" type="number" step="0.01" {...register('down_payment')} />
          </Field>

          <Field label="Nº de parcelas" htmlFor="installments_count">
            <Input id="installments_count" type="number" {...register('installments_count')} />
          </Field>
        </div>

        <p className="rounded-btn bg-ink-50 text-ink-600 p-3 text-xs">
          A parcela exibida no site é <strong>(preço − entrada) ÷ parcelas</strong>, sem juros,
          e o anúncio deixa isso explícito. Mostrar uma parcela &quot;com juros&quot; inventada
          pela plataforma seria informação financeira enganosa.
        </p>
      </Section>

      <Section title="Opcionais" columns={1}>
        {featureGroups.map(([category, features]) => (
          <div key={category}>
            <h3 className="text-ink-400 text-xs font-semibold tracking-wide uppercase">
              {category}
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {features?.map((feature) => (
                <label
                  key={feature.id}
                  className="rounded-btn text-ink-700 hover:bg-ink-50 flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-sm transition-colors"
                >
                  <input
                    type="checkbox"
                    value={feature.id}
                    checked={selectedFeatures.includes(feature.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selectedFeatures, feature.id]
                        : selectedFeatures.filter((id) => id !== feature.id);
                      setValue('feature_ids', next);
                    }}
                    className="border-ink-300 text-brand-600 focus:ring-brand-600/25 size-4 rounded"
                  />
                  {feature.name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Destaque" columns={1}>
        <Checkbox label="Exibir com selo de destaque na home" {...register('is_featured')} />
      </Section>

      <div className="border-ink-200 sticky bottom-0 flex justify-end gap-3 border-t bg-white/90 py-4 backdrop-blur">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/admin/veiculos')}
        >
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="size-4" />
              {isEdit ? 'Salvar alterações' : 'Criar e adicionar fotos'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  columns = 2,
  children,
}: {
  title: string;
  columns?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card shadow-card ring-ink-100 bg-white p-6 ring-1">
      <h2 className="text-ink-900 text-sm font-semibold">{title}</h2>
      <div
        className={
          columns === 1 ? 'mt-4 space-y-4' : 'mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
        }
      >
        {children}
      </div>
    </section>
  );
}

function Checkbox({ label, ...props }: React.ComponentProps<'input'> & { label: string }) {
  return (
    <label className="rounded-btn text-ink-700 hover:bg-ink-50 flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-sm transition-colors">
      <input
        type="checkbox"
        className="border-ink-300 text-brand-600 focus:ring-brand-600/25 size-4 rounded"
        {...props}
      />
      {label}
    </label>
  );
}

function emptyToUndefined(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  return Number(value);
}

function toDefaults(vehicle?: VehicleDetail): FormValues {
  if (!vehicle) {
    return {
      brand_id: '',
      model_id: '',
      version: '',
      year_manufacture: CURRENT_YEAR,
      year_model: CURRENT_YEAR,
      price: 0,
      mileage: 0,
      fuel_type: '',
      transmission: '',
      body_type: '',
      color: '',
      city: 'São Paulo',
      state: 'SP',
      doors: '',
      engine: '',
      horsepower: '',
      owners_count: '',
      has_manual: false,
      has_spare_key: false,
      ipva_paid: false,
      licensing_paid: false,
      service_history: '',
      description: '',
      accepts_financing: true,
      accepts_trade: true,
      down_payment: '',
      installments_count: '',
      is_featured: false,
      feature_ids: [],
    };
  }

  return {
    // A ficha devolve os IDs junto dos nomes justamente para isto: sem eles, o
    // formulário abriria com marca e modelo em branco, e salvar apagaria os dois.
    brand_id: vehicle.brand_id,
    model_id: vehicle.model_id,
    version: vehicle.version ?? '',
    year_manufacture: vehicle.year_manufacture,
    year_model: vehicle.year_model,
    price: Number(vehicle.price),
    mileage: vehicle.mileage,
    fuel_type: vehicle.fuel_type,
    transmission: vehicle.transmission,
    body_type: vehicle.body_type,
    color: vehicle.color,
    city: vehicle.city,
    state: vehicle.state,
    doors: vehicle.doors ?? '',
    engine: vehicle.engine ?? '',
    horsepower: vehicle.horsepower ?? '',
    owners_count: vehicle.owners_count ?? '',
    has_manual: vehicle.has_manual,
    has_spare_key: vehicle.has_spare_key,
    ipva_paid: vehicle.ipva_paid,
    licensing_paid: vehicle.licensing_paid,
    service_history: vehicle.service_history ?? '',
    description: vehicle.description ?? '',
    accepts_financing: vehicle.accepts_financing,
    accepts_trade: vehicle.accepts_trade,
    down_payment: vehicle.down_payment ? Number(vehicle.down_payment) : '',
    installments_count: vehicle.installments_count ?? '',
    is_featured: vehicle.is_featured,
    feature_ids: vehicle.features.map((f) => f.id),
  };
}
