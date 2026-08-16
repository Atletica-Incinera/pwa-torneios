/**
 * A tabela única das imagens do PWA.
 *
 * O manifesto, o `<head>` e o script que gera os arquivos leem daqui. Ter três
 * listas paralelas seria a receita para o layout apontar para um arquivo que o
 * gerador deixou de escrever — e o sintoma disso, no iOS, é tela branca sem
 * erro nenhum.
 *
 * Regenerar com `npm run pwa:assets`.
 */

/** Aparelhos iOS cobertos pela tela de abertura, em retrato. */
export const splashDevices = [
  { width: 320, height: 568, scale: 2, name: 'iPhone SE' },
  { width: 375, height: 667, scale: 2, name: 'iPhone 8' },
  { width: 414, height: 896, scale: 2, name: 'iPhone XR / 11' },
  { width: 375, height: 812, scale: 3, name: 'iPhone X / 12 mini' },
  { width: 390, height: 844, scale: 3, name: 'iPhone 12 / 13 / 14' },
  { width: 393, height: 852, scale: 3, name: 'iPhone 14 Pro / 15 / 16' },
  { width: 428, height: 926, scale: 3, name: 'iPhone 12 Pro Max / 14 Plus' },
  { width: 430, height: 932, scale: 3, name: 'iPhone 15 Pro Max / 16 Plus' },
  { width: 768, height: 1024, scale: 2, name: 'iPad' },
  { width: 1024, height: 1366, scale: 2, name: 'iPad Pro 12.9' },
] as const;

export type SplashDevice = (typeof splashDevices)[number];

/** O arquivo é nomeado pelo tamanho físico, que é o que o iOS espera receber. */
export function splashFile(device: SplashDevice) {
  return `/splash/apple-splash-${device.width * device.scale}x${device.height * device.scale}.png`;
}

/**
 * O iOS escolhe por consulta de mídia exata e não tem fallback: aparelho que
 * não bater com nenhuma linha abre com tela branca.
 */
export function splashMedia(device: SplashDevice) {
  return `(device-width: ${device.width}px) and (device-height: ${device.height}px) and (-webkit-device-pixel-ratio: ${device.scale}) and (orientation: portrait)`;
}

/** No formato que o `appleWebApp.startupImage` do Next consome. */
export const appleStartupImages = splashDevices.map((device) => ({ url: splashFile(device), media: splashMedia(device) }));

/**
 * As capturas da ficha de instalação. `narrow` aparece no celular e `wide` no
 * navegador de mesa; sem as duas, Chrome e Edge caem na ficha mínima.
 *
 * A largura é a do viewport em pixels de CSS, não a do arquivo: fotografar o
 * layout num viewport de 1080 de largura renderiza a versão de mesa e publica
 * uma tela de celular que ninguém reconhece. A densidade é que leva o arquivo
 * ao tamanho que a ficha espera.
 */
export const screenshotCaptures = [
  { file: 'publico-ao-vivo-narrow.png', path: '/public', width: 390, height: 844, scale: 3, formFactor: 'narrow', label: 'Jogos ao vivo' },
  { file: 'publico-modalidades-narrow.png', path: '/public/tournaments', width: 390, height: 844, scale: 3, formFactor: 'narrow', label: 'Modalidades e chaveamento' },
  { file: 'publico-ao-vivo-wide.png', path: '/public', width: 1440, height: 900, scale: 1, formFactor: 'wide', label: 'Jogos ao vivo' },
] as const;

/** No formato que o manifesto consome. `sizes` é o tamanho do arquivo. */
export const manifestScreenshots = screenshotCaptures.map((capture) => ({
  src: `/screenshots/${capture.file}`,
  sizes: `${capture.width * capture.scale}x${capture.height * capture.scale}`,
  type: 'image/png',
  form_factor: capture.formFactor,
  label: capture.label,
}));
