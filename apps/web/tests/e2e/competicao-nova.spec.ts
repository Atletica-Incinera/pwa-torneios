import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/*
 * O caso da virada de torneio: já existe uma competição ativa e a gestão cria
 * outra ao lado dela. É o caminho que a Copa Halterada percorre — e é diferente
 * do da primeira competição de um sistema vazio, que passa pelo bootstrap.
 *
 * A competição nova nasce INATIVA, de propósito: ninguém quer que o site
 * público troque de torneio no instante em que alguém salva um formulário. Quem
 * escolhe o momento é a gestão, pelo seletor, depois de cadastrar o que precisa.
 */
test('a gestão cria um torneio novo ao lado do atual, ativa e cria uma modalidade nele', async ({ page }) => {
  await loginAs(page, 'super@intereng.com', 'super2026');

  await page.goto('/competitions/new');
  await page.getByLabel('Nome do torneio').fill('Copa Nova');
  // O identificador público acompanha o nome enquanto ninguém o editou.
  await expect(page.getByLabel('Identificador público')).toHaveValue('copa-nova');
  await page.getByLabel('Ano da primeira edição').fill(String(new Date().getFullYear()));
  await page.getByLabel('Início').fill(`${new Date().getFullYear()}-11-02`);
  await page.getByLabel('Encerramento').fill(`${new Date().getFullYear()}-11-08`);
  await page.getByRole('button', { name: 'Criar torneio' }).click();

  await expect(page).toHaveURL(/\/competitions$/);
  const seletor = page.getByLabel('Torneio ativo');
  const nova = seletor.getByRole('button', { name: 'Copa Nova', exact: true });
  await expect(nova).toBeVisible();
  // Nasceu inativa: o contexto do app continua o do torneio anterior.
  await expect(nova).toHaveAttribute('aria-pressed', 'false');

  await nova.click();
  await page.getByRole('button', { name: 'Mudar contexto' }).click();
  await expect(nova).toHaveAttribute('aria-pressed', 'true');

  // Já no contexto novo, a gestão cria a modalidade pela tela.
  await page.goto('/disciplines/new');
  await page.getByLabel('Modalidade do catálogo').selectOption('Basquete');
  await page.getByRole('button', { name: 'Salvar modalidade' }).click();
  await expect(page).toHaveURL(/\/disciplines\/basquete/);
});

test('o identificador público de um torneio não pode repetir o de outro', async ({ page }) => {
  await loginAs(page, 'super@intereng.com', 'super2026');
  await page.goto('/competitions/new');
  await page.getByLabel('Nome do torneio').fill('Outro Torneio');
  // O torneio de partida já usa `copa-halterada`.
  await page.getByLabel('Identificador público').fill('copa-halterada');
  await page.getByLabel('Ano da primeira edição').fill(String(new Date().getFullYear()));
  await page.getByLabel('Início').fill(`${new Date().getFullYear()}-11-02`);
  await page.getByLabel('Encerramento').fill(`${new Date().getFullYear()}-11-08`);
  await page.getByRole('button', { name: 'Criar torneio' }).click();
  await expect(page.getByText('Este identificador público já está em uso.')).toBeVisible();
  await expect(page).toHaveURL(/\/competitions\/new/);
});
