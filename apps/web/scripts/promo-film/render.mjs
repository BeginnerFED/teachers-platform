/**
 * Renders the sign-in page's promo film (apps/web/src/features/promo-film) into the video
 * files the page plays, frame by frame, with its synthesised soundtrack.
 *
 * Run it against a running dev server (`pnpm dev:web`), which serves the film's
 * development-only page at /login/film:
 *
 *   npm i --prefix <tools> playwright-core ffmpeg-static     (once, anywhere outside the repo)
 *   PROMO_TOOLS=<tools> node apps/web/scripts/promo-film/render.mjs [options]
 *
 * Options:
 *   --base=http://localhost:3000   the dev server (default 3000)
 *   --locale=uk|tr                 tr renders the development reading aid, for review only
 *   --version=v1                   output name: public/promo/teachers-platform-<version>.*
 *                                  (bump it with every new cut, and PROMO_FILM in
 *                                  features/login-promo/promo-video.tsx with it, so no browser
 *                                  keeps an old cut from its cache)
 *   --master=<file.mp4>            also keep a high-quality master (CRF 18) for sharing
 *   --chrome=<path>                Chrome to drive (default: the Windows install path)
 *
 * How it stays deterministic: the film is a pure function of time; the product screens it
 * films use CSS and Web Animations, which the page pins to the moment each first appeared
 * (see film-player.tsx). Frames therefore come out identical on every run.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const tools = process.env.PROMO_TOOLS
if (!tools) {
  console.error(
    'Set PROMO_TOOLS to a folder where playwright-core and ffmpeg-static are installed.',
  )
  process.exit(2)
}
const require = createRequire(path.join(path.resolve(tools), 'node_modules', 'noop.js'))
const { chromium } = require('playwright-core')
const ffmpeg = require('ffmpeg-static')

const here = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(here, '../../public/promo')
const base = flag('base', 'http://localhost:3000')
const locale = flag('locale', 'uk')
const version = flag('version', 'v1')
const master = flag('master', null)
const chrome = flag('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe')
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-film-'))

const run = (command, commandArgs, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'],
    })
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    )
    if (input) input(child.stdin)
  })

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
})
const context = await browser.newContext({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 1,
})
if (locale === 'tr') {
  await context.addCookies([
    { name: 'dev-locale', value: 'tr', domain: new URL(base).hostname, path: '/' },
  ])
}

async function openFilm() {
  const page = await context.newPage()
  await page.goto(`${base}/login/film?render`, { waitUntil: 'load', timeout: 120000 })
  // Development overlays sit over the frame; the video must not carry them.
  await page.addStyleTag({
    content: 'nextjs-portal, button.fixed.right-4.bottom-4 { display: none !important; }',
  })
  await page.waitForFunction(() => !!window.__film, null, { timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  return page
}

const page = await openFilm()
const { duration, fps } = await page.evaluate(() => ({
  duration: window.__film.duration,
  fps: window.__film.fps,
}))

// The soundtrack.
const wav = path.join(work, 'film.wav')
fs.writeFileSync(wav, Buffer.from(await page.evaluate(() => window.__film.renderAudio()), 'base64'))

// The picture, straight into a lossless-enough intermediate.
const intermediate = path.join(work, 'film.mp4')
const frames = Math.round((duration / 1000) * fps)
const film = page.locator('[data-film]')
await run(
  ffmpeg,
  [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-framerate',
    String(fps),
    '-c:v',
    'mjpeg',
    '-i',
    '-',
    '-i',
    wav,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '16',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-shortest',
    intermediate,
  ],
  async (stdin) => {
    for (let frame = 0; frame < frames; frame++) {
      await page.evaluate((ms) => window.__film.seek(ms), (frame * 1000) / fps)
      const jpeg = await film.screenshot({ type: 'jpeg', quality: 95 })
      if (!stdin.write(jpeg)) await new Promise((resolve) => stdin.once('drain', resolve))
      if (frame % 150 === 0) console.log(`frame ${frame}/${frames}`)
    }
    stdin.end()
  },
)

// The poster: the closing card. Births only hold moving forward, so step up to it fresh.
const posterPage = await openFilm()
const posterAt = duration - 1500
for (let ms = posterAt - 3000; ms <= posterAt; ms += 100)
  await posterPage.evaluate((t) => window.__film.seek(t), ms)
fs.mkdirSync(publicDir, { recursive: true })
await posterPage.locator('[data-film]').screenshot({
  type: 'jpeg',
  quality: 88,
  path: path.join(publicDir, `teachers-platform-${version}.jpg`),
})
await browser.close()

// What the page plays: sized for a sign-in page, not a cinema.
const name = path.join(publicDir, `teachers-platform-${version}`)
await run(ffmpeg, [
  '-y',
  '-loglevel',
  'error',
  '-i',
  intermediate,
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '27',
  '-pix_fmt',
  'yuv420p',
  '-profile:v',
  'high',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-movflags',
  '+faststart',
  `${name}.mp4`,
])
await run(ffmpeg, [
  '-y',
  '-loglevel',
  'error',
  '-i',
  intermediate,
  '-c:v',
  'libvpx-vp9',
  '-b:v',
  '0',
  '-crf',
  '38',
  '-row-mt',
  '1',
  '-deadline',
  'good',
  '-cpu-used',
  '2',
  '-c:a',
  'libopus',
  '-b:a',
  '112k',
  `${name}.webm`,
])
if (master) {
  await run(ffmpeg, [
    '-y',
    '-loglevel',
    'error',
    '-i',
    intermediate,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    path.resolve(master),
  ])
}

fs.rmSync(work, { recursive: true, force: true })
for (const extension of ['mp4', 'webm', 'jpg']) {
  const file = `${name}.${extension}`
  console.log(
    `${path.relative(process.cwd(), file)}  ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`,
  )
}
