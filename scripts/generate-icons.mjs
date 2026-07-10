/**
 * Gera ícones PNG a partir dos SVGs existentes.
 * iOS exige PNG para apple-touch-icon — SVG não funciona.
 *
 * Uso: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(__dirname, '..', 'public')

const SIZES = {
  'pwa-192x192.png': 192,
  'pwa-512x512.png': 512,
  'apple-touch-icon-180x180.png': 180,
  'apple-touch-icon-167x167.png': 167,
  'apple-touch-icon-152x152.png': 152,
  'apple-touch-icon-120x120.png': 120,
  'favicon-32x32.png': 32,
}

async function main() {
  const svgSource = readFileSync(resolve(PUBLIC, 'pwa-512x512.svg'))

  for (const [filename, size] of Object.entries(SIZES)) {
    // Check if file already exists
    try {
      const existing = readFileSync(resolve(PUBLIC, filename))
      console.log(`✓ ${filename} já existe (${existing.length} bytes)`)
      continue
    } catch {
      // File doesn't exist, generate it
    }

    const png = await sharp(svgSource)
      .resize(size, size)
      .png()
      .toBuffer()

    writeFileSync(resolve(PUBLIC, filename), png)
    console.log(`✓ ${filename} gerado (${size}x${size}, ${png.length} bytes)`)
  }

  console.log('\n✅ Todos os ícones PNG foram gerados!')
}

main().catch(err => {
  console.error('❌ Erro ao gerar ícones:', err)
  process.exit(1)
})
