// "No text ever lands on other text while scrolling": walks through a section in
// 150 px steps (wheel, so smooth scrolling and pins behave as for a visitor), down
// and back up, slowly and quickly, and at each stop collects every visible line
// of text on screen (Range rects of each text node, clipped by overflow and the
// viewport, ignoring transparent and screen-reader-only text). Two text boxes that
// intersect fail, unless an opaque layer between them hides the lower one (a nav
// bar or a sticky tab bar over the page is fine; text on text is not).
// Screenshots of each stop go to docs/screenshots/<folder>/ when a folder is given.
//   node scripts/check-overlap.mjs [folder]      (needs npm run serve)
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

export { overlapsInPage };
export const SIZES = [[1440, 900], [1280, 720], [1024, 768], [768, 1024], [375, 812]];
export const TARGETS = [
  { path: '/', sel: '#how', name: 'how' },
  { path: '/', sel: '#process', name: 'process' },
  { path: '/', sel: '#services', name: 'services' },
  { path: '/work/smile-dental/', sel: 'main', name: 'case' },
];

// Runs in the page: every pair of visible, intersecting text boxes.
function overlapsInPage() {
  const vw = innerWidth, vh = innerHeight;
  const opacity = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= +cs.opacity; } return o; };
  const clipOf = (el) => {
    let r = { l: 0, t: 0, r: vw, b: vh };
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.overflow !== 'visible' || cs.clipPath !== 'none') {
        const b = e.getBoundingClientRect();
        r = { l: Math.max(r.l, b.left), t: Math.max(r.t, b.top), r: Math.min(r.r, b.right), b: Math.min(r.b, b.bottom) };
      }
    }
    return r;
  };
  const boxes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('script, style, template, .sr-only, [data-intro], .cursor, .grain')) continue;
    if (opacity(el) < 0.05) continue;
    const c = clipOf(el);
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const q of range.getClientRects()) {
      const r = { l: Math.max(q.left, c.l), t: Math.max(q.top, c.t), r: Math.min(q.right, c.r), b: Math.min(q.bottom, c.b) };
      if (r.r - r.l < 2 || r.b - r.t < 4) continue;
      boxes.push({ el, r, text: n.textContent.trim().slice(0, 40) });
    }
  }
  // The lower of two boxes is hidden if an opaque layer sits between them at that point.
  const opaque = (e) => { const cs = getComputedStyle(e); const m = cs.backgroundColor.match(/[\d.]+/g); return (m && (m.length < 4 || +m[3] > 0.9) && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') || cs.backgroundImage !== 'none'; };
  const hidden = (a, b, x, y) => {
    const stack = document.elementsFromPoint(x, y);
    const find = (box) => stack.findIndex((s) => s === box.el || box.el.contains(s));
    const pa = find(a), pb = find(b);
    if (pa < 0 || pb < 0) return true;   // one of them isn't painted here at all
    const low = pa < pb ? b : a;
    for (let i = Math.min(pa, pb); i < Math.max(pa, pb); i++) { const s = stack[i]; if (!s.contains(low.el) && opaque(s)) return true; }
    return false;
  };
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const l = Math.max(a.r.l, b.r.l), r = Math.min(a.r.r, b.r.r), t = Math.max(a.r.t, b.r.t), bt = Math.min(a.r.b, b.r.b);
    if (r - l < 3 || bt - t < 3) continue;
    if (hidden(a, b, (l + r) / 2, (t + bt) / 2)) continue;
    out.push(`"${a.text}" × "${b.text}" at ${Math.round(l)},${Math.round(t)}`);
  }
  return [...new Set(out)];
}

export async function checkOverlap({ browser, base = 'http://localhost:4173', report, folder = null, sizes = SIZES, targets = TARGETS }) {
  if (folder) mkdirSync(`docs/screenshots/${folder}`, { recursive: true });
  for (const t of targets) {
    const fails = [];
    let stops = 0;
    for (const [w, h] of sizes) {
      const mobile = w < 768;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
      await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
      const page = await ctx.newPage();
      await page.goto(base + t.path, { waitUntil: 'load' });
      await page.waitForTimeout(1200);
      // Pass the section once so its pin is set up, come back, then open every "What's
      // included" as a visitor might: the page above the pin grows after it was measured.
      await page.evaluate((sel) => document.querySelector(sel).scrollIntoView(), t.sel);
      await page.waitForTimeout(1200);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(600);
      await page.evaluate(() => document.querySelectorAll('details.inc').forEach((d) => { d.open = true; }));
      await page.waitForTimeout(600);
      const span = async () => page.evaluate((sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); return [Math.round(r.top + scrollY - innerHeight * 0.6), Math.round(r.bottom + scrollY - innerHeight * 0.2)]; }, t.sel);
      await page.mouse.move(w / 2, h / 2);
      // Arrive well above the section, then walk through it with the wheel.
      let [from, to] = await span();
      await page.evaluate((y) => scrollTo(0, Math.max(0, y)), from - 300);
      await page.waitForTimeout(700);
      for (const [dir, step, pause] of [[1, 150, 260], [-1, 150, 260], [1, 450, 120], [-1, 450, 120]]) {
        for (let k = 0; k < 400; k++) {
          await page.mouse.wheel(0, dir * step);
          await page.waitForTimeout(pause);
          // Pins add scroll length: the section's end is measured again as we go.
          [from, to] = await span();
          const y = await page.evaluate(() => scrollY);
          if ((dir > 0 && y >= to) || (dir < 0 && y <= from)) break;
          if (dir > 0 && k > 0 && y < from) continue;
          await page.waitForTimeout(450);   // let step changes and reveals settle
          stops++;
          const found = await page.evaluate(overlapsInPage);
          if (folder && step === 150 && t.name === 'how') await page.screenshot({ path: `docs/screenshots/${folder}/${t.name}-${w}-${dir > 0 ? 'down' : 'up'}-${String(k).padStart(2, '0')}.png` });
          if (found.length) fails.push(`${w}×${h} ${dir > 0 ? 'down' : 'up'} ${step}px @${y}: ${found.slice(0, 2).join('; ')}`);
        }
      }
      await ctx.close();
    }
    report(`No text overlaps text while scrolling ${t.path}${t.sel} (1440×900, 1280×720, 1024×768, 768, 375; slow and fast, down and up; ${stops} stops)`, fails.length === 0, fails.slice(0, 4).join(' | '));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
  const report = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  const folder = process.argv[2] || null;
  const only = process.argv[3];
  await checkOverlap({ browser, report, folder, targets: only ? TARGETS.filter((t) => t.name === only) : TARGETS });
  await browser.close();
}
