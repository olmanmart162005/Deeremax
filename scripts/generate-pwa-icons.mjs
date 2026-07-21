import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let sharp
let pngToIco

try {
  sharp = (await import('sharp')).default
  pngToIco = (await import('png-to-ico')).default
} catch (err) {
  console.error('❌ Error: Falta el paquete "sharp" o "png-to-ico". Por favor ejecuta "npm install".')
  console.error(err.message)
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const publicDir = path.join(projectRoot, 'public')
const iconDir = path.join(publicDir, 'pwa-icons')
const sourceLogo = path.join(publicDir, 'logoDeereMax.jpeg')

const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512]

const createSquareIcon = async (size) => {
  const outputPath = path.join(iconDir, `icon-${size}x${size}.png`)
  await sharp(sourceLogo)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(outputPath)
}

const createMaskableIcon = async () => {
  const outputPath = path.join(iconDir, 'icon-maskable-512x512.png')
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(sourceLogo)
          .resize(400, 400, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .png()
          .toBuffer(),
        left: 56,
        top: 56,
      },
    ])
    .png()
    .toFile(outputPath)
}

const createAppleTouchIcon = async () => {
  const outputPath = path.join(publicDir, 'apple-touch-icon.png')
  await sharp(sourceLogo)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(outputPath)
}

const createFaviconPng = async () => {
  const outputPath = path.join(publicDir, 'favicon.png')
  await sharp(sourceLogo)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(outputPath)
}

const createFaviconIco = async () => {
  const outputPath = path.join(publicDir, 'favicon.ico')
  const pngBuffers = await Promise.all(
    [16, 32, 48].map((size) =>
      sharp(sourceLogo)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer(),
    ),
  )
  const icoBuffer = await pngToIco(pngBuffers)
  await writeFile(outputPath, icoBuffer)
}

const createManifestCopies = async () => {
  const manifest = {
    name: 'DeereMax',
    short_name: 'DeereMax',
    description: 'Sistema Empresarial de Reportes Agrícolas DeereMax.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#166534',
    background_color: '#ffffff',
    icons: sizes.map((size) => ({
      src: `/pwa-icons/icon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
  }

  manifest.icons.push({
    src: '/pwa-icons/icon-maskable-512x512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  })

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  await writeFile(path.join(publicDir, 'manifest.webmanifest'), manifestText)
  await writeFile(path.join(publicDir, 'manifest.json'), manifestText)
}

const main = async () => {
  await mkdir(iconDir, { recursive: true })
  await Promise.all(sizes.map((size) => createSquareIcon(size)))
  await Promise.all([createMaskableIcon(), createAppleTouchIcon(), createFaviconPng(), createFaviconIco(), createManifestCopies()])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
