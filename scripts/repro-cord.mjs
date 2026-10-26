// Can the hero cord be pulled? One scenario per line: is the live cord up,
// does hovering it show GRAB, does a press take hold (PULL), and did WebGL
// report an error or a lost context. Needs npm run serve.
//   node scripts/repro-cord.mjs [baseUrl]
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const W = 1440, H = 900;

async function findSpot(page) {
  const spots = [];
  for (let y = 220; y < 840; y += 40) for (let x = 760; x < 1400; x += 40) {
    await page.mouse.move(x, y);
    if (await page.evaluate(() => document.querySelector('[data-hero]').classList.contains('is-over-cable'))) spots.push({ x, y });
  }
  return spots.sort((p, q) => Math.abs(p.y - 470) - Math.abs(q.y - 470))[0] || null;
}

// The state of the cord at one spot: hover, then press and let go.
async function probe(page, spot) {
  await page.mouse.move(700, 880);
  await page.waitForTimeout(300);
  const live = await page.evaluate(() => document.querySelector('[data-hero]').classList.contains('is-live'));
  if (!live) await page.waitForFunction(() => document.querySelector('[data-hero]').classList.contains('is-live'), null, { timeout: 8000 }).catch(() => {});
  const liveAfter = await page.evaluate(() => document.querySelector('[data-hero]').classList.contains('is-live'));
  await page.mouse.move(spot.x, spot.y, { steps: 4 });
  await page.waitForTimeout(250);
  const grab = await page.getAttribute('[data-hero]', 'data-cursor');
  await page.mouse.down();
  await page.waitForTimeout(80);
  const held = await page.evaluate(() => document.querySelector('[data-hero]').classList.contains('is-holding'));
  await page.mouse.move(spot.x - 120, spot.y + 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const stuck = await page.evaluate(() => document.querySelector('[data-hero]').classList.contains('is-holding'));
  const gl = await page.evaluate(() => ({ lost: window.__lost || 0, errors: window.__glErrors || [] }));
  return { liveAtOnce: live, live: liveAfter, grab: grab || '-', held, stuck, ...gl };
}

export async function reproCord({ browser, base = 'http://localhost:4173', log = console.log }) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(() => {
    document.addEventListener('webglcontextlost', () => { window.__lost = (window.__lost || 0) + 1; }, true);
    const err = console.error;
    console.error = (...a) => { (window.__glErrors ||= []).push(String(a[0]).slice(0, 120)); err(...a); };
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (/webgl|context|GL_/i.test(m.text())) pageErrors.push(m.text().slice(0, 120)); });

  const results = [];
  const run = async (name, setup) => {
    await setup();
    const r = await probe(page, spot);
    results.push([name, r]);
    log(`${name.padEnd(42)} ${JSON.stringify(r)}`);
  };

  // Right after load: the pointer enters the hero at once.
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.mouse.move(700, 700);
  const t0 = Date.now();
  await page.waitForFunction(() => document.querySelector('[data-hero]').classList.contains('is-live'), null, { timeout: 15000 }).catch(() => {});
  log(`live cord after the pointer entered: ${Date.now() - t0} ms`);
  await page.waitForTimeout(1500);
  const spot = await findSpot(page);
  log(`cord spot: ${JSON.stringify(spot)}`);
  if (!spot) { await ctx.close(); return results; }

  await run('right after load', async () => {});
  await run('scrolled down and back up', async () => {
    await page.mouse.move(700, 880);
    await page.mouse.wheel(0, 1600); await page.waitForTimeout(1200);
    await page.mouse.wheel(0, -1600); await page.waitForTimeout(1800);
  });
  await run('case study, then back', async () => {
    await page.evaluate(() => document.querySelector('a[href="work/smile-dental/"]').click());
    await page.waitForURL('**/work/smile-dental/'); await page.waitForTimeout(800);
    await page.goBack({ waitUntil: 'load' }); await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
  });
  await run('home opened from the case study (link)', async () => {
    await page.evaluate(() => document.querySelector('a[href="work/smile-dental/"]').click());
    await page.waitForURL('**/work/smile-dental/'); await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('.nav__mark').click());
    await page.waitForURL((u) => new URL(u).pathname === '/'); await page.waitForTimeout(1000);
  });
  await run('another tab in front, then back', async () => {
    const other = await ctx.newPage();
    await other.goto('about:blank'); await other.bringToFront(); await page.waitForTimeout(1500);
    await page.bringToFront(); await other.close(); await page.waitForTimeout(800);
  });
  await run('pressed the socket next to the CTA', async () => {
    const sock = page.locator('.hero .plugin__socket');
    await sock.hover(); await page.waitForTimeout(600);
    // The button opens WhatsApp in a new tab; keep this one.
    ctx.once('page', (p) => p.close().catch(() => {}));
    await sock.click({ modifiers: [] }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.bringToFront();
    if (new URL(page.url()).pathname !== '/') { await page.goBack({ waitUntil: 'load' }); await page.waitForTimeout(800); }
  });
  await run('drag released outside the window', async () => {
    await page.mouse.move(spot.x, spot.y, { steps: 3 }); await page.waitForTimeout(200);
    await page.mouse.down();
    await page.mouse.move(W + 200, -100, { steps: 8 });
    await page.mouse.up();
    await page.mouse.move(700, 880); await page.waitForTimeout(1500);
  });
  log(pageErrors.length ? `errors: ${pageErrors.join(' | ')}` : 'no page or WebGL errors');
  await ctx.close();
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  await reproCord({ browser, base: process.argv[2] || 'http://localhost:4173' });
  await browser.close();
}
