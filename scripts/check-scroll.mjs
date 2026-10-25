// "Nothing ever looks empty": scrolls each page in 400 px steps at 1440 and 375,
// with motion, with reduced motion and with JavaScript off. At every step it
// saves a screenshot (.scroll-check/, git-ignored) and fails if a labelled
// section shows its label while any of its content on screen (top above 88% of
// the viewport) is below 40% opacity. Used by check-launch.mjs; also runs alone:
//   node scripts/check-scroll.mjs        (needs npm run serve)
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

export async function checkScroll({ browser, fresh, report, base, paths = ['/', '/work/smile-dental/'] }) {
  const outDir = '.scroll-check';
  mkdirSync(outDir, { recursive: true });
  const modes = [['motion', {}], ['reduced', { reducedMotion: 'reduce' }], ['nojs', { javaScriptEnabled: false }]];
  for (const path of paths) {
    for (const [mode, extra] of modes) {
      for (const w of [1440, 375]) {
        const ctx = await fresh({ viewport: { width: w, height: w < 768 ? 812 : 900 }, isMobile: w < 768, hasTouch: w < 768, ...extra });
        const page = await ctx.newPage();
        await page.goto(base + path, { waitUntil: 'load' });
        await page.waitForTimeout(1500);
        const H = await page.evaluate(() => document.documentElement.scrollHeight);
        const bad = [];
        for (let y = 0; y < H; y += 400) {
          await page.evaluate((y) => window.scrollTo(0, y), y);
          // Long enough for a reveal to pass 40%, short enough to catch a late one.
          await page.waitForTimeout(mode === 'motion' ? 450 : 150);
          const tag = `${path === '/' ? 'home' : path.replace(/\W+/g, '-').replace(/^-|-$/g, '')}-${mode}-${w}-${String(y).padStart(5, '0')}`;
          await page.screenshot({ path: `${outDir}/${tag}.jpg`, type: 'jpeg', quality: 50 });
          const found = await page.evaluate(() => {
            const vh = innerHeight;
            const eff = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return -1; o *= parseFloat(cs.opacity); } return o; };
            const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < vh; };
            const out = [];
            document.querySelectorAll('.rail.t-label').forEach((label) => {
              if (!onScreen(label) || eff(label) < 0.5) return;
              const box = label.parentElement;
              const parts = [...box.querySelectorAll('p, h2, h3, li, summary, figure, img, .btn')].filter((el) => !label.contains(el) && !el.closest('[aria-hidden="true"], [inert], .rail'));
              parts.forEach((el) => {
                const r = el.getBoundingClientRect();
                if (!onScreen(el) || r.top > vh * 0.88) return;
                const o = eff(el);
                if (o >= 0 && o < 0.4) out.push(`${label.textContent.replace(/\s+/g, ' ').trim()}: "${(el.textContent || el.alt || el.tagName).trim().slice(0, 30)}" at ${o.toFixed(2)}`);
              });
            });
            return out;
          });
          if (found.length) bad.push(`y=${y}: ${found.slice(0, 2).join('; ')}`);
        }
        report(`No empty labelled section on ${path}, ${mode}, ${w}px (400 px steps, screenshots in ${outDir}/)`, bad.length === 0, bad.slice(0, 4).join(' | '));
        await ctx.close();
      }
    }
  }
}

// Standalone
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
  const fresh = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
    return ctx;
  };
  let failed = 0;
  const report = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  await checkScroll({ browser, fresh, report, base: 'http://localhost:4173', paths: process.argv.slice(2).length ? process.argv.slice(2) : undefined });
  await browser.close();
  process.exitCode = failed ? 1 : 0;
}
