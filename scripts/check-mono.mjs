// Mono text (everything set in --font-mono) at 375 and 320 px: how many lines
// each piece takes, and whether any runs off the screen. Labels (30 characters
// or fewer) must sit on one line; longer captions may wrap. Text inside a bar
// that scrolls sideways (the case study's tabs) may run past the screen.
//   node scripts/check-mono.mjs [baseUrl] [--json]   (part of check-launch.mjs)
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const PAGES = ['/', '/work/smile-dental/', '/privacy', '/404.html'];
const WIDTHS = [375, 320];

// Every element whose own text is set in the mono stack, with its line count.
export async function monoTexts(page) {
  return page.evaluate(() => {
    const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim().split(',')[0].trim();
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.fontFamily.split(',')[0].trim() !== mono) continue;
      if (el.closest('[hidden], .sr-only') || cs.visibility === 'hidden') continue;
      // Only the element that holds the text, so a label counts once.
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      // Lines from the text itself (not icons): a new line starts more than
      // half a line below the last one (flex chips sit a few px apart).
      const rects = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() && !n.parentElement.closest('svg') ? 1 : 2) });
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(n);
        rects.push(...[...range.getClientRects()].filter((q) => q.width > 0));
      }
      if (!rects.length) continue;
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const tops = rects.map((q) => q.top).sort((a, b) => a - b);
      let lines = 1;
      for (let i = 1, last = tops[0]; i < tops.length; i++) if (tops[i] > last + lh / 2) { lines++; last = tops[i]; }
      const right = Math.max(...rects.map((q) => q.right));
      let scroller = el.parentElement;
      while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowX)) scroller = scroller.parentElement;
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      out.push({
        text: text.slice(0, 60),
        label: text.length <= 30,
        sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''),
        lines,
        overflow: !scroller && right > innerWidth + 0.5 ? Math.round(right - innerWidth) : 0,
      });
    }
    return out;
  });
}

export async function checkMono({ browser, base = 'http://localhost:4173', report }) {
  const all = [];
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const path of PAGES) {
      await page.goto(base + path, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      for (const t of await monoTexts(page)) all.push({ w, path, ...t });
    }
    await ctx.close();
  }
  const wraps = all.filter((t) => t.label && t.lines > 1);
  const over = all.filter((t) => t.overflow > 0);
  if (report) {
    report(`Mono labels at 375 and 320 stay on one line (${all.filter((t) => t.label).length} labels)`, wraps.length === 0, wraps.map((t) => `${t.w} ${t.path} "${t.text}" ${t.lines} lines`).join(' | '));
    report(`No mono text runs off the screen at 375 or 320 (${all.length} checked)`, over.length === 0, over.map((t) => `${t.w} ${t.path} "${t.text}" +${t.overflow}px`).join(' | '));
  }
  return all;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base = 'http://localhost:4173'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const json = process.argv.includes('--json');
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let failed = 0;
  const report = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  const all = await checkMono({ browser, base, report: json ? null : report });
  if (json) console.log(JSON.stringify(all));
  await browser.close();
  process.exitCode = failed ? 1 : 0;
}
