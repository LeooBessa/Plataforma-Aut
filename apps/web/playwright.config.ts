import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright — testes end-to-end do fluxo que gera dinheiro.
 *
 * O E2E complementa os 87 testes de unidade/integração: aqueles provam que cada
 * peça funciona; este prova que elas funcionam JUNTAS, no navegador de verdade,
 * do jeito que o cliente vai usar.
 *
 * Assume que a API (:8000) e o web (:3000) já estão no ar — não os sobe sozinho
 * porque a API precisa do banco com o seed, que é um pré-requisito manual.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // o fluxo agenda visitas; rodar em paralelo poluiria o banco
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    // Rastro só quando um teste falha na primeira tentativa — dá o replay exato
    // do que quebrou, sem inchar cada execução verde.
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
