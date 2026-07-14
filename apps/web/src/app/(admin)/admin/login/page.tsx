'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, ArrowLeft, Car, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useAuth } from '@/features/auth/auth-provider';
import { errorMessage } from '@/lib/http';

/**
 * O schema é o MESMO contrato do backend (min 8 caracteres).
 *
 * Validar aqui é UX — o usuário sabe do erro antes de esperar a rede. A
 * validação que protege o sistema é a do servidor, e ela continua lá: nunca
 * confiamos nesta.
 */
const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Quem já está logado não precisa ver a tela de login.
  useEffect(() => {
    if (!loading && user) {
      router.replace('/admin');
    }
  }, [loading, user, router]);

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      router.replace('/admin');
    } catch (error) {
      // A API devolve a MESMA mensagem para e-mail inexistente e senha errada —
      // de propósito, para não revelar quais e-mails têm conta. Repetimos o que
      // ela disser, sem "melhorar" a mensagem.
      setServerError(errorMessage(error));
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-900"
          >
            <ArrowLeft className="size-4" />
            Voltar ao site
          </Link>

          <div className="rounded-card bg-white p-8 shadow-card ring-1 ring-ink-100">
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-btn bg-ink-950 text-white">
                <Car className="size-5" />
              </span>
              <div>
                <h1 className="font-bold text-ink-950">Área do administrador</h1>
                <p className="text-xs text-ink-500">Gerencie anúncios e agendamentos</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
              {serverError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-btn bg-danger-50 p-3.5 text-sm text-danger-700 ring-1 ring-inset ring-danger-500/20"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{serverError}</p>
                </div>
              )}

              <Field label="E-mail" htmlFor="email" error={errors.email?.message} required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  // `autoFocus` no primeiro campo: quem abre esta tela veio para
                  // digitar, não para clicar.
                  autoFocus
                  placeholder="voce@empresa.com.br"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                />
              </Field>

              <Field label="Senha" htmlFor="password" error={errors.password?.message} required>
                <Input
                  id="password"
                  type="password"
                  // `current-password` permite ao gerenciador de senhas preencher
                  // e salvar corretamente. Sem isso, o navegador não oferece ajuda.
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
              </Field>

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-ink-400">
            Acesso restrito. Contas são criadas por um administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
