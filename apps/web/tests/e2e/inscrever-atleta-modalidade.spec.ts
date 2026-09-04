import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Inscrever um atleta numa modalidade é o que faz a artilharia existir: a mesa
 * só oferece como autor de um gol quem está no elenco daquela modalidade, e a
 * API recusa a atribuição a quem não está.
 *
 * Na véspera do evento, 428 dos 429 atletas em produção estavam sem modalidade
 * nenhuma — e o elenco estava trancado por engano, porque a chave publicada
 * antecipadamente fazia o app achar que o mata-mata já tinha começado.
 *
 * Este teste percorre o caminho inteiro pela tela, do jeito que a organização
 * vai percorrer: achar o atleta, marcar a modalidade, salvar, e conferir que
 * ele passou a contar como elenco daquela modalidade.
 */
/** Os grupos vem em `<details>`: abrir pelo atributo nao depende do estado inicial. */
async function abrirGrupos(page: import('@playwright/test').Page) {
  await page.locator('details.team-modality').first().waitFor();
  await page.$$eval('details.team-modality', (grupos) =>
    grupos.forEach((grupo) => grupo.setAttribute('open', 'open')),
  );
}

test('o organizador inscreve um atleta numa modalidade pela tela', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams/caotica');

  // O atleta sem modalidade aparece agrupado como tal — é onde a organização
  // vai encontrar os 428.
  const semModalidade = page.locator('details.team-modality').filter({ hasText: 'Sem modalidade' });
  await expect(semModalidade).toBeVisible();
  await abrirGrupos(page);

  const nome = 'João Pedro';
  const linha = semModalidade.locator('.roster-manage-row').filter({ hasText: nome });
  await expect(linha).toHaveCount(1);

  await linha.getByRole('button', { name: `Editar modalidades de ${nome}` }).click();
  const editor = linha.locator('.local-athlete-editor');
  await expect(editor).toBeVisible();

  // A caixa da modalidade tem de estar habilitada: se estivesse travada, a
  // organização não teria como inscrever ninguém.
  const caixa = editor.getByRole('checkbox', { name: 'Vôlei' });
  await expect(caixa).toBeEnabled();
  await caixa.check();
  await editor.getByRole('button', { name: /Salvar/ }).click();

  // O atleta migra do grupo "Sem modalidade" para o da modalidade escolhida.
  await abrirGrupos(page);
  const grupoVolei = page.locator('details.team-modality').filter({ hasText: 'Vôlei' });
  await expect(grupoVolei).toBeVisible();
  await expect(grupoVolei.locator('.roster-manage-row').filter({ hasText: nome })).toHaveCount(1);
});

test('modalidade cujo mata-mata já começou continua travada', async ({ page }) => {
  // A trava não sumiu — ela passou a valer no momento certo. O Futsal tem uma
  // semifinal "Ao vivo" na semente, então ali o elenco está fechado mesmo.
  await loginAs(page);
  await page.goto('/teams/caotica');

  await abrirGrupos(page);
  const semModalidade = page.locator('details.team-modality').filter({ hasText: 'Sem modalidade' });
  const nome = 'João Pedro';
  const linha = semModalidade.locator('.roster-manage-row').filter({ hasText: nome });
  await linha.getByRole('button', { name: `Editar modalidades de ${nome}` }).click();

  const futsal = linha.locator('.local-athlete-editor').getByRole('checkbox', { name: 'Futsal' });
  await expect(futsal).toBeDisabled();
});
