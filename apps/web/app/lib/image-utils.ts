export type OptimizedImage = {
  blob: Blob;
  previewUrl: string;
};

export const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;

/** Lê o arquivo escolhido pelo usuário como uma imagem pronta para recorte manual (crop). */
export async function loadImageForCrop(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');
  const source = await fileToDataUrl(file);
  return loadImage(source);
}

export type SquareCrop = {
  /** Origem do recorte em pixels da imagem original (não da tela). */
  x: number;
  y: number;
  /** Lado do quadrado de recorte, também em pixels da imagem original. */
  size: number;
};

/** Recorta uma região quadrada da imagem e devolve o WebP pronto para upload. */
export async function cropImageToWebp(
  image: HTMLImageElement,
  crop: SquareCrop,
  outputSize = 512,
  quality = 0.82,
): Promise<OptimizedImage> {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem.');
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, outputSize, outputSize);

  const blob = await canvasToBlob(canvas, quality);
  if (blob.type !== 'image/webp') {
    throw new Error('Este navegador não conseguiu converter a imagem para WebP.');
  }
  return { blob, previewUrl: await blobToDataUrl(blob) };
}

export async function optimizeImageFile(
  file: File,
  maxSize = 512,
  quality = 0.82,
): Promise<OptimizedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');

  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, quality);
  if (blob.type !== 'image/webp') {
    throw new Error('Este navegador não conseguiu converter a imagem para WebP.');
  }
  return { blob, previewUrl: await blobToDataUrl(blob) };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível converter a imagem.')),
      'image/webp',
      quality,
    );
  });
}

function fileToDataUrl(file: Blob): Promise<string> {
  return blobToDataUrl(file);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    image.src = source;
  });
}
