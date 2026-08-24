import type { Page } from '@playwright/test';

export async function loginAs(page: Page, email = 'ana@ufpe.br', password = 'intereng2026') {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.locator('input[aria-label="Senha"]').fill(password);
  await page.getByRole('button', { name: 'ENTRAR' }).click();
  await page.waitForURL(/\/dashboard/);
}
