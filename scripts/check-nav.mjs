// Checks the menu: open, focus trap, Escape, focus return, and a section jump.
// Needs the preview server (npm run serve).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const out = process.argv[2] || 'docs/screenshots/nav-check';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
for (const [w, h] of [[1440, 900], [375, 812]]) {
  const mobile = w < 768;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('[data-menu-btn]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${w}-menu.png` });
  const trail = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    trail.push(await page.evaluate(() => document.activeElement.textContent.trim().replace(/\s+/g, ' ').slice(0, 22) || document.activeElement.getAttribute('aria-label')));
  }
  console.log(w, 'tab order:', trail.join(' | '));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  console.log(w, 'after Escape:', await page.evaluate(() => ({
    focus: document.activeElement.matches('[data-menu-btn]'),
    expanded: document.querySelector('[data-menu-btn]').getAttribute('aria-expanded'),
    hidden: document.querySelector('[data-menu]').hidden,
  })));
  // A menu link closes the menu and lands on its section.
  await page.click('[data-menu-btn]');
  await page.waitForTimeout(1200);
  await page.click('[data-menu] a[href="#process"]');
  await page.waitForTimeout(1500);
  console.log(w, 'after "Process":', await page.evaluate(() => ({
    hidden: document.querySelector('[data-menu]').hidden,
    processTop: Math.round(document.querySelector('#process').getBoundingClientRect().top),
  })));
  await ctx.close();
}
await browser.close();
