// "How it works" never overlaps: at 1024, 1280, 1440 and 1920 (pinned steps)
// and 375 (tabs), with the real text, a long text and a short text, every
// step is made active in turn and the visible step blocks (number + title,
// and the paragraph when shown) must not intersect each other or the buttons
// under them. Screenshots of each step go to docs/screenshots/<folder>/.
//   node scripts/check-how.mjs [baseUrl] [folder] [--no-shots]
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const SIZES = [[1024, 768], [1280, 800], [1440, 900], [1920, 1080], [375, 812]];
const LONG = 'A much longer line for this step, written to test the layout: it keeps going across two or three lines on a wide screen, so nothing may overlap the next step.';
const SHORT = 'Short.';

export async function checkHow({ browser, base = 'http://localhost:4173', folder = null, report, sizes = SIZES, texts = ['real', 'long', 'short'] }) {
  if (folder) mkdirSync(`docs/screenshots/${folder}`, { recursive: true });
  for (const [w, h] of sizes) {
    const mobile = w < 768;
    for (const mode of texts) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
      const page = await ctx.newPage();
      await page.goto(`${base}/`, { waitUntil: 'load' });
      await page.waitForTimeout(800);
      if (mode !== 'real') await page.evaluate((t) => document.querySelectorAll('.how__text').forEach((p) => { p.textContent = t; }), mode === 'long' ? LONG : SHORT);
      // Walk to the section so it sets itself up (pin on desktop, tabs on phones).
      await page.evaluate(() => document.querySelector('#how').scrollIntoView());
      await page.waitForTimeout(1200);
      const bad = [];
      for (let i = 0; i < 4; i++) {
        const pin = await page.evaluate(() => window.__howPin?.() || null);
        if (pin) {
          // Early in step i's part of the pin, whatever split the page uses.
          const span = await page.evaluate(() => (window.__howSpan || 3.3));
          await page.evaluate((y) => window.scrollTo(0, y), Math.round(pin[0] + (pin[1] - pin[0]) * Math.min(0.98, (i + 0.3) / span)));
        } else {
          await page.evaluate((i) => document.querySelectorAll('[data-how-tab]')[i].click(), i);
        }
        await page.waitForTimeout(1300);
        const found = await page.evaluate(() => {
          const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && r.width > 0 && r.height > 0 ? r : null; };
          const boxes = [];
          document.querySelectorAll('[data-how-item]').forEach((it, n) => {
            [it.querySelector('.how__tab'), it.querySelector('.how__text')].forEach((el, k) => { const r = vis(el); if (r) boxes.push({ name: `step ${n + 1} ${k ? 'text' : 'title'}`, r }); });
          });
          const foot = document.querySelector('.how__foot .content');
          if (foot) { const r = vis(foot); if (r) boxes.push({ name: 'buttons', r }); }
          const hit = [];
          for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
            const p = boxes[a].r, q = boxes[b].r;
            const sameStep = boxes[a].name.split(' ')[1] === boxes[b].name.split(' ')[1] && boxes[a].name.startsWith('step') && boxes[b].name.startsWith('step');
            if (sameStep) continue;
            if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) hit.push(`${boxes[a].name} × ${boxes[b].name}`);
          }
          const active = [...document.querySelectorAll('[data-how-item]')].findIndex((it) => it.classList.contains('is-active'));
          return { hit, active };
        });
        if (found.hit.length) bad.push(`step ${i + 1}: ${found.hit.join(', ')}`);
        if (folder && mode === 'real') await page.screenshot({ path: `docs/screenshots/${folder}/${w}-how-step${i + 1}.png` });
      }
      report(`How it works at ${w}×${h}, ${mode} text: no overlaps in any step`, bad.length === 0, bad.slice(0, 3).join(' | '));
      await ctx.close();
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base = 'http://localhost:4173', folder = null] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
  let failed = 0;
  const report = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  await checkHow({ browser, base, folder: process.argv.includes('--no-shots') ? null : folder, report });
  await browser.close();
  process.exitCode = failed ? 1 : 0;
}
