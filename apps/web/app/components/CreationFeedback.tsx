'use client';

import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function CreationFeedback() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('created') !== '1') return;
    setVisible(true);
    url.searchParams.delete('created');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  if (!visible) return null;

  return (
    <div className="creation-feedback" role="status">
      <CheckCircle2 size={19} />
      <span>Registro salvo neste protótipo.</span>
      <button type="button" onClick={() => setVisible(false)} aria-label="Fechar confirmação"><X size={17} /></button>
    </div>
  );
}
