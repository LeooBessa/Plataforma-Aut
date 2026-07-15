# Guia de Deploy — Vercel

Este projeto vira **dois projetos Vercel** a partir deste mesmo repositório:

| Projeto | Diretório-raiz na Vercel | Vira |
|---|---|---|
| **web** | `apps/web` | o site (`seu-site.vercel.app`) |
| **api** | `apps/api` | a API (`sua-api.vercel.app`) |

São separados porque um é Next.js e o outro é Python — cada um com seu build.
O site conversa com a API pelo *rewrite* interno (`/api/*`), então o visitante
só enxerga um domínio.

---

## Antes de começar — 3 tarefas de segurança

Faça estas ANTES do primeiro deploy de produção. Nenhuma é opcional.

### 1. Rotacionar a chave secreta e a senha do banco do Supabase
As duas passaram pelo chat durante o desenvolvimento e devem ser trocadas:
- **Chave secreta:** painel do Supabase → Project Settings → API Keys → *Rotate*
- **Senha do banco:** Project Settings → Database → *Reset database password*

Depois de rotacionar, use os valores novos nas env vars da Vercel (abaixo).

### 2. Gerar segredos de produção
Rode localmente e guarde a saída — cada um vai numa env var:
```bash
openssl rand -hex 32   # → JWT_SECRET_KEY
openssl rand -hex 32   # → REVALIDATE_SECRET (o MESMO valor nos dois projetos)
```

### 3. Apagar os 8 carros de demonstração
Eles têm fotos de placeholder e foram criados para desenvolvimento. Em
produção, ou você os apaga pelo painel admin, ou roda no Supabase (SQL Editor):
```sql
DELETE FROM vehicles WHERE dealership_id = (SELECT id FROM dealerships LIMIT 1);
```
As marcas, modelos e opcionais (dados de referência) devem **permanecer**.

---

## Deploy da API (`apps/api`)

1. Na Vercel: **Add New → Project** → importe o repositório.
2. **Root Directory:** `apps/api`
3. **Framework Preset:** Other (a Vercel detecta o Python pelo `vercel.json`).
4. **Environment Variables** (Project Settings → Environment Variables):

   | Variável | Valor |
   |---|---|
   | `ENVIRONMENT` | `production` |
   | `DEBUG` | `false` |
   | `DATABASE_URL` | Supabase **transaction pooler**, porta 6543, prefixo `postgresql+asyncpg://` |
   | `DATABASE_DIRECT_URL` | Supabase **session pooler**, porta 5432, prefixo `postgresql+asyncpg://` |
   | `JWT_SECRET_KEY` | o `openssl rand -hex 32` gerado acima |
   | `CORS_ORIGINS` | a URL do site, ex: `https://seu-site.vercel.app` |
   | `COOKIE_DOMAIN` | **vazio** enquanto usar domínios `.vercel.app` (ver nota) |
   | `SUPABASE_URL` | `https://SEU_REF.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave nova (rotacionada) |
   | `SUPABASE_STORAGE_BUCKET` | `vehicles` |
   | `FRONTEND_URL` | a URL do site (para a revalidação sob demanda) |
   | `REVALIDATE_SECRET` | o 2º `openssl rand -hex 32` |
   | `RESEND_API_KEY` | opcional — sem ela, o e-mail de novo agendamento não é enviado (o lead ainda é salvo) |
   | `EMAIL_FROM` / `ADMIN_NOTIFICATION_EMAIL` | se usar Resend |

   > **Rate limiting (dormente):** o código existe e é seguro deixar como está.
   > Sem `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, ele simplesmente
   > não limita nada. Para ativar depois, crie um Redis grátis no Upstash e
   > adicione as duas variáveis — nenhuma mudança de código.

5. **Deploy.**

### Rodar a migration em produção (uma vez, e a cada mudança de schema)
A migration NÃO roda no deploy — de propósito, para você controlar quando o
schema muda. Rode do seu terminal, apontando para o banco de produção:
```bash
cd apps/api
DATABASE_DIRECT_URL="<session pooler de produção>" uv run alembic upgrade head
```
E o seed dos dados de referência (marcas, modelos, opcionais) + o admin:
```bash
DATABASE_URL="<pooler de produção>" \
DATABASE_DIRECT_URL="<session pooler de produção>" \
SEED_ADMIN_EMAIL="voce@empresa.com.br" \
SEED_ADMIN_PASSWORD="<senha FORTE de produção>" \
  uv run python -m src.infrastructure.database.seed
```
Em `ENVIRONMENT=production`, o seed **não** cria os carros de demonstração.

---

## Deploy do site (`apps/web`)

1. Na Vercel: **Add New → Project** → o mesmo repositório.
2. **Root Directory:** `apps/web`
3. **Framework Preset:** Next.js (detectado sozinho).
4. **Environment Variables:**

   | Variável | Valor |
   |---|---|
   | `API_URL` | a URL da API deployada, ex: `https://sua-api.vercel.app` |
   | `NEXT_PUBLIC_SITE_URL` | a URL do próprio site |
   | `SUPABASE_URL` | `https://SEU_REF.supabase.co` (para o `next/image` liberar as fotos) |
   | `REVALIDATE_SECRET` | **o mesmo** valor usado na API |

5. **Deploy.**

---

## Depois do deploy — verifique

```bash
# 1. A API responde
curl https://sua-api.vercel.app/api/v1/health

# 2. O site carrega e mostra veículos
curl -s https://seu-site.vercel.app | grep -o "AutoPremium"

# 3. O login funciona pelo site (o teste crítico do cookie same-origin)
curl -i -X POST https://seu-site.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"voce@empresa.com.br","password":"<sua senha>"}'
#    → deve vir Set-Cookie: refresh_token=...; HttpOnly

# 4. O sitemap lista os veículos
curl https://seu-site.vercel.app/sitemap.xml
```

Rode o **Rich Results Test** do Google numa página de veículo para confirmar o
JSON-LD: https://search.google.com/test/rich-results

---

## Nota sobre o domínio próprio

Enquanto usar os domínios grátis `.vercel.app`, o site e a API ficam em domínios
**diferentes**. O login continua funcionando porque o site faz *proxy* de
`/api/*` para a API (`next.config.ts` → `rewrites`), então o cookie é
same-origin do ponto de vista do navegador. `COOKIE_DOMAIN` fica **vazio**.

Quando você tiver um domínio próprio (ex: `meucarro.com.br`):
1. Aponte o site para `meucarro.com.br` e a API para `api.meucarro.com.br` (Vercel → Domains).
2. `COOKIE_DOMAIN=.meucarro.com.br` na API.
3. `CORS_ORIGINS=https://meucarro.com.br` na API.
4. `API_URL=https://api.meucarro.com.br` e `NEXT_PUBLIC_SITE_URL=https://meucarro.com.br` no site.

O rewrite continua funcionando; a única diferença é que agora o cookie pode ser
compartilhado explicitamente entre os subdomínios.
