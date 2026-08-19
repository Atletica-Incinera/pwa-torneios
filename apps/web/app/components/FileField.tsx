'use client';

import { ChangeEvent } from 'react';

/**
 * Campo de arquivo com aparência própria. O `<input type="file">` nativo não
 * é estilizável (o botão "Escolher arquivo" e o nome do arquivo vêm do
 * navegador, com largura fixa que estoura containers estreitos) — aqui ele
 * fica sobreposto e invisível, só para manter clique e teclado nativos, e o
 * que aparece é este gatilho + nome truncável, que respeitam o layout.
 */
export function FileField({
  label,
  accept,
  fileName,
  hint,
  onChange,
  inputKey,
}: {
  label: string;
  accept: string;
  fileName?: string;
  hint?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  inputKey?: number | string;
}) {
  return (
    <label className="file-field">
      <span>{label}</span>
      <span className="file-field-control">
        <span className="file-field-trigger">Escolher arquivo</span>
        <span className="file-field-name">{fileName || 'Nenhum arquivo escolhido'}</span>
        <input key={inputKey} type="file" accept={accept} onChange={onChange} />
      </span>
      {hint ? <small className="field-help">{hint}</small> : null}
    </label>
  );
}
