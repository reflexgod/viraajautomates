// Screenshots of single sections (element screenshots) at 1440 and 375, after
// scrolling each into view so its reveals have run.
//   node scripts/section-shot.mjs <folder> "<selector>" ["<selector>" ...] [--widths 1440,375] [--path /] [--reduced] [--open "<selector>"]
// Saves docs/screenshots/<folder>/<width>-<name>.png. Needs npm run serve.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (n) => { const i = args.indexOf(`--${n}`); if (i < 0) return false; args.splice(i, 1); return true; };
const widths = opt('widths', '1440,375').split(',').map(Number);
const path = opt('path', '/');
const open = opt('open', '');
const reduced = flag('reduced');
const [folder, ...sels] = args;
const out = `docs/screenshots/${folder}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const w of widths) {
  const mobile = w < 768;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 812 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  await page.goto(`http://localhost:4173${path}`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  // Walk down the page once so every reveal and lazy set-up has run.
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 500) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(60); }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(600);
  // Fixed page furniture would land on top of every element shot.
  await page.addStyleTag({ content: '.nav, .skip-link, .grain, .tabs { visibility: hidden !important; }' });
  if (open) await page.evaluate((s) => document.querySelectorAll(s).forEach((d) => { d.open = true; }), open);
  for (const sel of sels) {
    const el = await page.$(sel);
    if (!el) { console.log(`  missing ${sel}`); continue; }
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const name = sel.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '');
    await el.screenshot({ path: `${out}/${w}-${name}.png` });
    console.log(`${out}/${w}-${name}.png`);
  }
  await ctx.close();
}
await browser.close();
