# Plataforma Auto — Marketplace de Anúncios de Automóveis

Marketplace onde concessionárias anunciam veículos e visitantes consultam a ficha
completa e agendam visitas.

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind 4
- **Backend:** FastAPI + SQLAlchemy 2 (async) + Pydantic 2, em Clean Architecture
- **Banco:** Supabase (PostgreSQL) · **Storage:** Supabase Storage
- **Deploy:** Vercel (dois projetos: `web` e `api`) — ver [DEPLOY.md](DEPLOY.md)

Qualidade: 87 testes (unit + integração contra Postgres real + E2E Playwright),
ruff + mypy strict no backend, ESLint + tsc no frontend, tudo verde no CI.
Lighthouse ≥ 90 nas 4 métricas em todas as páginas.

---

## Como rodar

Pré-requisitos: **Node ≥ 20** e [**uv**](https://docs.astral.sh/uv/) (o uv cuida do
Python 3.12 sozinho — não use o Python do sistema).

```bash
cp .env.example .env      # preencha os valores; .env nunca vai para o git
npm install               # dependências do frontend

npm run dev:api           # API   → http://localhost:8000/docs
npm run dev:web           # Web   → http://localhost:3000
```

### Verificação

```bash
npm run check             # lint + tipos + testes, dos dois lados
```

Individualmente: `lint:api`, `typecheck:api`, `test:api`, `lint`, `typecheck`.

---

## Estrutura

```
apps/
  api/     FastAPI — Clean Architecture (domain / application / infrastructure / presentation)
  web/     Next.js — organizado por feature
packages/
  shared-types/   tipos TS gerados do OpenAPI da API
```

**A regra de dependência (backend):** as setas apontam **para dentro**.
`presentation → application → domain`. A `infrastructure` também aponta para dentro:
ela *implementa* interfaces declaradas no domínio. O domínio não sabe que existe
Postgres, FastAPI ou Supabase — por isso é testável sem banco, e trocar de provedor
mexe num adapter, não numa regra de negócio.

---

## Decisões que não são óbvias

### Duas URLs de banco, de propósito

A API roda **serverless**, onde cada invocação é um processo novo. Isso tem
consequências que estão codificadas em `apps/api/src/core/database.py`:

- **Runtime** fala com o *transaction pooler* do Supabase (**porta 6543**), com
  `NullPool` — quem faz o pooling é o pgbouncer, não o SQLAlchemy. Sem isso, o
  limite de conexões do Postgres estoura sob carga.
- **Alembic** fala pela **conexão direta (5432)**. Migrations precisam de sessão real.
- `statement_cache_size=0` é **obrigatório**: o pgbouncer em transaction mode devolve
  uma conexão diferente a cada transação, e os prepared statements do asyncpg ficam
  amarrados a uma conexão específica. Sem desligar o cache, aparecem erros
  intermitentes de "prepared statement does not exist" só sob concorrência.

### Fotos não passam pelo backend

A função serverless tem limite de tamanho de request body. O browser comprime a
imagem, pede uma *signed upload URL* à API e envia o arquivo **direto** ao Supabase
Storage. Além de contornar o limite, corta banda e é mais rápido.

### Rate limit vive no Redis, não em memória

Cada instância serverless teria o seu próprio contador em memória — o que torna o
rate limit decorativo. O contador é compartilhado via Upstash Redis.

### O `override` de postcss não é decorativo

O Next 16.2.10 pina `postcss@8.4.31`, que carrega o
[GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93). Não existe
Next mais novo que corrija o pin. Por isso o `overrides` na raiz força `postcss ^8.5.10`
para a árvore inteira — com ele, `npm audit` reporta **0 vulnerabilidades**, e o build
do Next passa normalmente.

Duas armadilhas ao mexer nisso:

- **Nunca rode `npm audit fix --force`.** Ele "resolve" rebaixando o Next para a versão
  **9** — uma regressão de sete majors.
- Se o `npm audit` voltar a acusar postcss, o `package-lock.json` está velho: o npm não
  re-resolve uma árvore já travada só porque um `override` novo apareceu. Apague
  `node_modules` e `package-lock.json` e reinstale.

---

## Segredos

Nunca commitados. `.env` local (git-ignored) e Environment Variables na Vercel.
O `.env.example` é a documentação viva de todas as variáveis.
