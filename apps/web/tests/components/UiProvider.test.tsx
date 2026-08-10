import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UiProvider, useUi } from '../../app/components/UiProvider';

function DialogHarness() {
  const { confirm } = useUi();
  return <main><button type="button" onClick={() => void confirm({ title: 'Arquivar equipe?', message: 'Confirme a operação.', confirmLabel: 'Arquivar' })}>Abrir confirmação</button></main>;
}

describe('UiProvider', () => {
  it('prende o foco no diálogo e o devolve ao acionador ao fechar', async () => {
    render(<UiProvider><DialogHarness /></UiProvider>);
    const opener = screen.getByRole('button', { name: 'Abrir confirmação' });
    opener.focus();
    fireEvent.click(opener);
    const confirmButton = await screen.findByRole('button', { name: 'Arquivar' });
    const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
    expect(confirmButton).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(cancelButton).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('direciona o skip-link ao conteúdo e anuncia mudanças importantes', async () => {
    render(<UiProvider><main><h1>Conteúdo</h1></main></UiProvider>);
    fireEvent.click(screen.getByRole('link', { name: 'Pular para o conteúdo' }));
    expect(screen.getByRole('main')).toHaveFocus();
    fireEvent(window, new CustomEvent('intereng:announce', { detail: 'Gol da Alcateia. Placar 3 a 1.' }));
    await waitFor(() => expect(screen.getByText('Gol da Alcateia. Placar 3 a 1.')).toBeInTheDocument());
  });
});
