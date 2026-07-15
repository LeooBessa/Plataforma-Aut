import { expect, test } from '@playwright/test';

/**
 * O FLUXO QUE GERA DINHEIRO, de ponta a ponta.
 *
 * Visitante busca um carro → filtra → abre o detalhe → agenda uma visita → o
 * lead aparece no painel do admin. É o caminho crítico do negócio inteiro num
 * teste só. Se este passar, o essencial funciona.
 *
 * Pré-requisitos (manuais): API em :8000 e web em :3000, banco com o seed, e um
 * admin. As credenciais vêm de env vars para não fixar senha no código:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@autopremium.com.br';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'senha1234';

// Nome único por execução — evita que rodar o teste duas vezes crie ambiguidade
// no painel (dois "João" agendados para o mesmo carro).
const CUSTOMER = `Cliente E2E ${Date.now()}`;

test('visitante busca, filtra, abre o veículo e agenda uma visita', async ({ page }) => {
  // --- Home: os carros vêm no HTML (SEO) ---
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('carro certo');

  // --- Busca com filtro ---
  await page.goto('/veiculos');
  await expect(page.getByRole('heading', { name: /veículos à venda/i })).toBeVisible();

  // O filtro vive na URL — navego direto, que é o que o Google e um link
  // compartilhado fazem.
  await page.goto('/veiculos?fuel=flex');
  const firstCard = page.getByRole('link', { name: /ver detalhes/i }).first();
  await expect(firstCard).toBeVisible();

  // --- Abre o detalhe ---
  await firstCard.click();
  await expect(page).toHaveURL(/\/veiculos\/.+/);
  await expect(page.getByRole('heading', { name: /ficha técnica/i })).toBeVisible();

  // --- Agenda a visita ---
  await page.getByRole('button', { name: /agendar visita/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Seu nome').fill(CUSTOMER);
  await dialog.getByLabel(/telefone/i).fill('11999998888');
  await dialog.getByLabel('E-mail').fill('cliente.e2e@teste.com');

  // Uma data dentro da janela permitida (amanhã).
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await dialog.getByLabel(/data da visita/i).fill(tomorrow.toISOString().slice(0, 10));

  await dialog.getByLabel(/horário/i).selectOption('10:00');

  await dialog.getByRole('button', { name: /confirmar agendamento/i }).click();

  // A confirmação prova que o lead foi gravado (a API respondeu 201).
  await expect(dialog.getByText(/visita agendada/i)).toBeVisible();
});

test('o lead agendado aparece no painel do administrador', async ({ page }) => {
  // --- Login ---
  await page.goto('/admin/login');
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Depois do login, cai no dashboard.
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // --- O agendamento do teste anterior está na lista ---
  await page.goto('/admin/agendamentos');
  await expect(page.getByRole('heading', { name: 'Agendamentos' })).toBeVisible();

  // O cliente criado no primeiro teste tem que estar aqui. É a prova de que o
  // fluxo visitante→banco→painel fecha o círculo.
  await expect(page.getByText(CUSTOMER)).toBeVisible();
});

test('rota protegida do painel redireciona para o login', async ({ page }) => {
  // Sem sessão, o painel manda para o login. A segurança REAL é a API (401),
  // mas a UX de não mostrar um painel vazio e piscando também importa.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});
