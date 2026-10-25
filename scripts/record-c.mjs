// Records the selling interactions as frames and GIFs (docs/screenshots/<folder>/):
// C1 the WhatsApp preview (desktop hover, phone two taps).
// Also asserts the behaviour. node scripts/record-c.mjs [folder]   (needs npm run serve, ffmpeg on PATH)
import { mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const folder = process.argv[2] || 'launch-c';
const out = `docs/screenshots/${folder}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
async function frames(page, name, steps, clip) {
  const dir = `${out}/.frames-${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let i = 0;
  for (const step of steps) {
    await step();
    for (let k = 0; k < 6; k++) { await page.screenshot({ path: `${dir}/${String(i++).padStart(3, '0')}.png`, clip }); await page.waitForTimeout(70); }
  }
  try {
    execSync(`ffmpeg -y -loglevel error -framerate 10 -i "${dir}/%03d.png" -vf "scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse" "${out}/${name}.gif"`);
    console.log(`${out}/${name}.gif`);
  } catch (e) { console.log('ffmpeg failed', String(e).slice(0, 120)); }
  rmSync(dir, { recursive: true, force: true });
}

// Desktop: hover the free check's button. (The hero has its own composer, js/compose.js.)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => sessionStorage.setItem('va-intro', '1'));
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  // Free check: scroll there, hover its one button
  await page.evaluate(() => document.querySelector('#check').scrollIntoView());
  await page.waitForTimeout(900);
  const btn = page.locator('#check .btn');
  const clip = await btn.evaluate((e) => { const r = e.closest('.content').getBoundingClientRect(); return { x: Math.max(0, r.x - 40), y: Math.max(0, r.y - 40), width: Math.min(1440 - Math.max(0, r.x - 40), r.width + 80), height: Math.min(900 - Math.max(0, r.y - 40), r.height + 120) }; });
  await frames(page, 'c1-desktop', [
    async () => { await page.mouse.move(5, 5); },
    async () => { await btn.hover(); },
    async () => { await page.waitForTimeout(400); },
  ], clip);
  const st = await page.evaluate(() => { const a = document.querySelector('#check .btn'); return { label: a.firstChild.textContent, href: a.href, bubble: a.closest('.wa-anchor').querySelector('.wa-bubble__text').textContent, open: a.closest('.wa-anchor').classList.contains('is-open') }; });
  ok('Free check: one button, "Send me your business name"', st.label === 'Send me your business name', st.label);
  ok('Free check: it opens WhatsApp with the free-check text', decodeURIComponent(new URL(st.href).search) === "?text=Hi Viraaj, I'd like the free check (free check). Business name: ", decodeURIComponent(new URL(st.href).search));
  ok('C1: hover shows the exact message', st.open && st.bubble === "Hi Viraaj, I'd like the free check (free check). Business name: …", st.bubble);
  await page.screenshot({ path: `${out}/1440-c1-check.png`, clip });
  await ctx.close();
}

// Phone: first tap shows, second opens WhatsApp; once seen, one tap.
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => sessionStorage.setItem('va-intro', '1'));
  await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, body: 'whatsapp' }));
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.querySelector('#check .btn').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(600);
  const b = await page.$eval('#check .btn', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  let popups = 0;
  ctx.on('page', () => { popups++; });
  await frames(page, 'c1-phone', [
    async () => { await page.waitForTimeout(100); },
    async () => { await page.touchscreen.tap(b[0], b[1]); await page.waitForTimeout(500); },
    async () => { await page.waitForTimeout(400); },
  ], { x: 0, y: 380, width: 375, height: 432 });
  ok('C1 phone: first tap shows the bubble, no WhatsApp yet', popups === 0 && await page.$eval('#check .wa-anchor', (w) => w.classList.contains('is-open')));
  await page.screenshot({ path: `${out}/375-c1-first-tap.png` });
  await page.touchscreen.tap(b[0], b[1]);
  await page.waitForTimeout(800);
  ok('C1 phone: second tap opens WhatsApp', popups === 1, `${popups} new tab(s)`);
  // A reload in the same session: one tap.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#check .btn').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(600);
  await page.touchscreen.tap(b[0], b[1]);
  await page.waitForTimeout(800);
  ok('C1 phone: seen this session, one tap opens WhatsApp', popups === 2, `${popups} new tab(s)`);
  await ctx.close();
}
await browser.close();
