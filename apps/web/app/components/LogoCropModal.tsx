'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cropImageToWebp, loadImageForCrop, type OptimizedImage } from '../lib/image-utils';

const FRAME_SIZE = 260;
const MAX_ZOOM = 3;

type Offset = { x: number; y: number };

/**
 * Modal de recorte do logotipo: o usuário arrasta e dá zoom sobre a imagem
 * dentro de uma moldura circular — o mesmo círculo em que o logotipo será
 * exibido no app (ver `.team-mark-logo` em globals.css) — até o enquadramento
 * ficar bom, e só então a imagem é recortada e convertida para WebP.
 */
export function LogoCropModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (image: OptimizedImage) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origin: Offset } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImageForCrop(file)
      .then((loaded) => {
        if (cancelled) return;
        const scale = FRAME_SIZE / Math.min(loaded.naturalWidth, loaded.naturalHeight);
        setImage(loaded);
        setBaseScale(scale);
        setZoom(1);
        setOffset({
          x: (FRAME_SIZE - loaded.naturalWidth * scale) / 2,
          y: (FRAME_SIZE - loaded.naturalHeight * scale) / 2,
        });
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Não foi possível ler a imagem.');
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  function clampOffset(next: Offset, currentScale: number): Offset {
    if (!image) return next;
    const width = image.naturalWidth * currentScale;
    const height = image.naturalHeight * currentScale;
    const minX = Math.min(0, FRAME_SIZE - width);
    const minY = Math.min(0, FRAME_SIZE - height);
    return {
      x: Math.min(0, Math.max(minX, next.x)),
      y: Math.min(0, Math.max(minY, next.y)),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, origin: offset };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const scale = baseScale * zoom;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    setOffset(
      clampOffset({ x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy }, scale),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  function handleZoomChange(nextZoom: number) {
    const scale = baseScale * zoom;
    const nextScale = baseScale * nextZoom;
    const center = FRAME_SIZE / 2;
    const ratio = nextScale / scale;
    setZoom(nextZoom);
    setOffset(
      clampOffset(
        { x: center - (center - offset.x) * ratio, y: center - (center - offset.y) * ratio },
        nextScale,
      ),
    );
  }

  async function confirm() {
    if (!image) return;
    setProcessing(true);
    setError('');
    const scale = baseScale * zoom;
    try {
      const optimized = await cropImageToWebp(image, {
        x: -offset.x / scale,
        y: -offset.y / scale,
        size: FRAME_SIZE / scale,
      });
      onConfirm(optimized);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível recortar a imagem.');
      setProcessing(false);
    }
  }

  const scale = baseScale * zoom;

  return (
    <div className="app-dialog-backdrop" role="presentation">
      <div className="app-dialog logo-crop-dialog" role="dialog" aria-modal="true" aria-label="Ajustar logotipo">
        <h2>AJUSTAR LOGOTIPO</h2>
        <p>Arraste para posicionar e aproxime com o controle. O círculo é exatamente o que aparece no app.</p>
        {image ? (
          <>
            <div
              className="logo-crop-frame"
              style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={image.src}
                alt=""
                draggable={false}
                style={{
                  width: image.naturalWidth * scale,
                  height: image.naturalHeight * scale,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            </div>
            <label className="logo-crop-zoom">
              <span>Zoom</span>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => handleZoomChange(Number(event.target.value))}
              />
            </label>
          </>
        ) : (
          <p className="field-help">Carregando imagem…</p>
        )}
        {error ? (
          <p className="form-feedback form-feedback-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={processing}>
            Cancelar
          </button>
          <button type="button" className="primary-button" onClick={confirm} disabled={!image || processing}>
            {processing ? 'Recortando…' : 'Usar esta imagem'}
          </button>
        </div>
      </div>
    </div>
  );
}
