/**
 * Gera splash screens para iOS a partir do SVG existente.
 * iOS exige imagens específicas para cada tamanho de tela.
 *
 * Uso: node scripts/generate-splash.mjs
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(__dirname, '..', 'public')

/**
 * Tamanhos de splash screen para iOS.
 * Formato: { filename, width, height }
 * Usa o viewport real de cada dispositivo (com safe areas).
 * A imagem centralizada do SVG será colocada sobre fundo branco.
 */
const SPLASH_SIZES = [
  // iPhone 14 Pro Max / 15 Plus / 16 Plus
  { filename: 'splash-1290x2796.png', width: 1290, height: 2796 },
  // iPhone 14 Pro / 15 Pro
  { filename: 'splash-1179x2556.png', width: 1179, height: 2556 },
  // iPhone 14 Plus / 15 Plus
  { filename: 'splash-1284x2778.png', width: 1284, height: 2778 },
  // iPhone 14 / 15 / 16
  { filename: 'splash-1170x2532.png', width: 1170, height: 2532 },
  // iPhone SE (3rd gen) / 8 Plus
  { filename: 'splash-750x1334.png', width: 750, height: 1334 },
  // iPad Pro 12.9"
  { filename: 'splash-2048x2732.png', width: 2048, height: 2732 },
  // iPad Pro 11" / iPad Air 10.9"
  { filename: 'splash-1668x2388.png', width: 1668, height: 2388 },
  // iPad 10th gen / iPad Air 10.5"
  { filename: 'splash-1620x2160.png', width: 1620, height: 2160 },
  // iPad mini 6th gen
  { filename: 'splash-1488x2266.png', width: 1488, height: 2266 },
]

async function main() {
  const svgSource = readFileSync(resolve(PUBLIC, 'pwa-512x512.svg'))

  // Create a white background and center the icon
  const iconSize = Math.min(512, 128) // Use 128px as icon size on splash
  const iconBuffer = await sharp(svgSource)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer()

  for (const { filename, width, height } of SPLASH_SIZES) {
    // Check if file already exists
    try {
      readFileSync(resolve(PUBLIC, filename))
      console.log(`✓ ${filename} já existe`)
      continue
    } catch {
      // Generate it
    }

    // Create splash: white background + centered icon
    const splash = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        {
          input: iconBuffer,
          top: Math.round((height - iconSize) / 2),
          left: Math.round((width - iconSize) / 2),
        },
      ])
      .png()
      .toBuffer()

    writeFileSync(resolve(PUBLIC, filename), splash)
    console.log(`✓ ${filename} gerado (${width}x${height}, ${(splash.length / 1024).toFixed(1)} KB)`)
  }

  console.log('\n✅ Todas as splash screens foram geradas!')
}

main().catch(err => {
  console.error('❌ Erro ao gerar splash screens:', err)
  process.exit(1)
})
