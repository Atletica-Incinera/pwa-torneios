import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaRegistration } from '../../app/components/PwaRegistration';

describe('PwaRegistration', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('informa quando o navegador fica offline', async () => {
    render(<PwaRegistration />);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    fireEvent(window, new Event('offline'));
    expect(await screen.findByText(/você está offline/i)).toBeInTheDocument();
  });

  it('oferece a instalação e respeita a dispensa durante a sessão', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt');
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
    render(<PwaRegistration />);
    fireEvent(window, event);
    fireEvent.click(await screen.findByRole('button', { name: 'Instalar' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  });
});
