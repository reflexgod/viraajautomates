// The custom cursor stays visible everywhere: chalk on dark sections, ink on light
// ones (data-theme), the disc inverted to match, only the dot over paragraphs and
// over the Plug-in button, the thin 44 px ring over preview words. At 1440, one stop
// in every section. Links made of words get the thin ring, never a disc over them. With a folder, saves a frame around the pointer at each stop.
//   node scripts/check-cursor.mjs [folder]      (needs npm run serve)
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const CHALK = 'rgb(245, 237, 226)', INK = 'rgb(29, 24, 22)';

export async function checkCursor({ browser, base = 'http://localhost:4173', report, folder = null }) {
  if (folder) mkdirSync(`docs/screenshots/${folder}`, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  // [name, selector, expected theme, expected state]
  const stops = [
    ['hero, empty ground', '.hero', 'dark', 'ring', (r) => [r.left + r.width * 0.3, r.top + r.height * 0.75]],
    ['hero name', '.hero__title', 'dark', 'dot'],
    ['nav "Free report" (words: ring, no disc)', '.nav__check', 'dark', 'link'],
    ['nav mail icon (EMAIL disc)', '.nav__mail', 'dark', 'label'],
    ['About text', '#about .t-statement', 'light', 'dot', (r) => [r.left + r.width * 0.6, r.top + r.height * 0.6]],
    ['About preview word', '[data-preview="viraaj"] .pw__word', 'light', 'preview'],
    ['service title', '[data-preview="seo"] .pw__word', 'light', 'preview'],
    ['service link (words: ring, no disc)', '#services .row__proof a', 'light', 'link'],
    ['the drawn phone (its chat text)', '#how .phone', 'light', 'dot', (r) => [r.left + r.width / 2, r.top + r.height * 0.45]],
    ['Plain terms', '#terms', 'light', 'ring', (r) => [r.left + 40, r.top + 40]],
    ['process', '#process .step__title', 'light', 'dot'],
    ['FAQ question', '#questions summary', 'light', 'link'],
    ['Free report button', '#check .plugin__btn', 'light', 'plug'],
    ['footer', '.footer', 'dark', 'ring', (r) => [r.left + r.width * 0.85, r.top + 40]],
    ['footer email (words: ring, no disc)', '.footer a[href^="mailto:"]', 'dark', 'link'],
    ['footer link', '.footer a[href="#check"], .footer a[href$="privacy"]', 'dark', 'link'],
  ];
  const results = [];
  let i = 0;
  for (const [name, sel, theme, want, at] of stops) {
    const el = page.locator(sel).first();
    await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(700);
    const r = await el.evaluate((e) => { const b = e.getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; });
    const [x, y] = at ? at(r) : [r.left + Math.min(r.width / 2, 60), r.top + r.height / 2];
    await page.mouse.move(x - 30, y - 20);
    await page.mouse.move(x, y, { steps: 6 });
    await page.waitForTimeout(650);
    const s = await page.evaluate(() => {
      const root = document.querySelector('[data-cursor-root]'), dot = root.querySelector('[data-cursor-dot]'), ring = root.querySelector('[data-cursor-ring]'), label = root.querySelector('[data-cursor-label]');
      const d = getComputedStyle(dot), g = getComputedStyle(ring);
      return { cls: root.className, dot: d.backgroundColor, dotOn: d.opacity, ring: g.borderTopColor, ringOn: g.opacity, ringW: g.width, disc: g.backgroundColor, word: label.textContent, wordColor: getComputedStyle(label).color, blend: d.mixBlendMode };
    });
    const fg = theme === 'dark' ? CHALK : INK, bg = theme === 'dark' ? INK : CHALK;
    const ok = s.blend === 'normal' && (want === 'label'
      ? s.disc === fg && s.wordColor === bg && /is-label/.test(s.cls)
      : want === 'dot' ? s.dot === fg && s.dotOn === '1' && s.ringOn === '0'
      : want === 'plug' ? s.dot === fg && s.ringOn === '0'
      : want === 'preview' ? s.ring === fg && s.ringW === '44px' && s.dotOn === '0'
      : want === 'link' ? s.ring === fg && s.dot === fg && s.ringW === '56px'
      : s.ring === fg && s.dot === fg && s.ringOn === '1');
    results.push([ok, `${name}: ${theme} ${want} → ${JSON.stringify(s)}`]);
    if (folder) await page.screenshot({ path: `docs/screenshots/${folder}/cursor-${String(++i).padStart(2, '0')}.png`, clip: { x: Math.max(0, Math.min(1440 - 360, x - 180)), y: Math.max(0, Math.min(900 - 220, y - 110)), width: 360, height: 220 } });
  }
  // The menu: black, so chalk.
  await page.evaluate(() => scrollTo(0, 0));
  await page.click('[data-menu-btn]');
  await page.waitForTimeout(900);
  const m = await page.locator('[data-menu] .menu__word').first().boundingBox();
  await page.mouse.move(m.x + 40, m.y + m.height / 2, { steps: 6 });
  await page.waitForTimeout(500);
  const ms = await page.evaluate(() => getComputedStyle(document.querySelector('[data-cursor-ring]')).borderTopColor);
  results.push([ms === CHALK, `menu: dark → ring ${ms}`]);
  if (folder) await page.screenshot({ path: `docs/screenshots/${folder}/cursor-${String(++i).padStart(2, '0')}.png`, clip: { x: Math.max(0, m.x - 140), y: Math.max(0, m.y - 80), width: 360, height: 220 } });
  await ctx.close();
  report(`Cursor at 1440: chalk on dark (hero, nav, menu, footer), ink on light; disc inverted; dot only over text and the button; 44 px ring over preview words (${results.length} stops)`, results.every((r) => r[0]), results.filter((r) => !r[0]).map((r) => r[1]).join(' | '));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
  let all = true;
  const report = (name, ok, detail = '') => { all &&= ok; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  await checkCursor({ browser, report, folder: process.argv[2] || null });
  await browser.close();
  process.exit(all ? 0 : 1);
}
