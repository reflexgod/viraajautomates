// Records the Plug-in button at 1440 (hover, leave, hover, click) and 375 (tap,
// tap) as real-time video, turns it into GIFs, and asserts what happens: the
// bubble and the plug on hover (the 3D cord in the hero when it is live), the
// way back on leave, "Connected ✓" and WhatsApp about 450 ms after the click,
// in the same tab; on a phone the first tap only shows, the second goes.
// Frames come from the browser's screencast (as they are painted), with their times.
//   node scripts/record-plugin.mjs [folder]   (needs npm run serve, ffmpeg on PATH)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const folder = process.argv[2] || 'plugin';
const out = `docs/screenshots/${folder}`;
const tmp = `${out}/.video`;
mkdirSync(out, { recursive: true });
const MSG = 'Hi Viraaj, saw your website. Can you do a free check for my business?';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);

for (const w of [1440, 375]) {
  const m = w < 768;
  const size = { width: w, height: m ? 812 : 900 };
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, isMobile: m, hasTouch: m });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
  // Stand in for WhatsApp, so the navigation can be seen and timed.
  await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<body style="margin:0;display:grid;place-items:center;height:100vh;font:16px sans-serif;background:#ECE5DD">WhatsApp</body>' }));
  // Every class change on the hero's button, with its time, reported out of the page as it happens.
  const log = [];
  const t0 = Date.now();
  await ctx.exposeFunction('__plugin', (cls) => log.push([Date.now() - t0, cls]));
  await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const r = document.querySelector('.hero [data-plugin]');
    if (r) new MutationObserver(() => window.__plugin(r.className)).observe(r, { attributes: true, attributeFilter: ['class'] });
  }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  const frames = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, sessionId }) => { frames.push([Date.now() - t0, data]); cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
  await page.goto('http://localhost:4173/', { waitUntil: 'load' });
  await page.mouse.move(10, 10);
  await page.waitForFunction(() => document.querySelector('[data-hero]').classList.contains('is-live'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3800);   // the drop-in settles
  const live = await page.evaluate(() => document.querySelector('[data-hero]').classList.contains('is-live'));
  await page.screenshot({ path: `${out}/${w}-hero.png` });
  const box = await page.locator('.hero .plugin__btn').boundingBox();
  const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const mark = () => Date.now() - t0;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 });
  const since = (t, cls) => log.find(([at, k]) => at >= t && k.split(' ').includes(cls));
  let start, clickAt, navMs;
  const go = (at) => page.waitForURL(/wa\.me/, { timeout: 4000 }).then(() => Date.now() - t0 - at).catch(() => -1);
  if (!m) {
    start = mark();
    await page.waitForTimeout(400);
    const h1 = mark();
    await page.mouse.move(c.x, c.y, { steps: 8 });
    await page.waitForTimeout(1000);
    const cls = await page.locator('.hero [data-plugin]').getAttribute('class');
    await page.screenshot({ path: `${out}/${w}-hover.png` });
    ok(`${w}: hover raises the bubble and brings the plug (${/is-cord/.test(cls) ? '3D cord' : '2D plug'})`, /is-open/.test(cls) && (!live || /is-cord/.test(cls)) && !!since(h1, 'is-open'), `live ${live}, ${cls}`);
    await page.mouse.move(c.x, c.y - 220, { steps: 6 });
    await page.waitForTimeout(900);
    ok(`${w}: leaving lets it go`, !/is-open/.test(await page.locator('.hero [data-plugin]').getAttribute('class')));
    await page.mouse.move(c.x, c.y, { steps: 6 });
    await page.waitForTimeout(900);
    clickAt = mark();
    const nav = go(clickAt);
    await page.mouse.down(); await page.mouse.up();
    navMs = await nav;
  } else {
    start = mark();
    await page.waitForTimeout(400);
    const tap1 = mark();
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForTimeout(1200);
    const first = { cls: await page.locator('.hero [data-plugin]').getAttribute('class'), hint: await page.textContent('.hero [data-plugin-hint]'), url: page.url() };
    await page.screenshot({ path: `${out}/${w}-first-tap.png` });
    ok(`${w}: first tap shows the bubble and "Tap again to open WhatsApp", stays on the page`, /is-armed/.test(first.cls) && first.hint === 'Tap again to open WhatsApp' && !/wa\.me/.test(first.url) && !!since(tap1, 'is-open'), JSON.stringify(first));
    clickAt = mark();
    const nav = go(clickAt);
    await page.touchscreen.tap(c.x, c.y);
    navMs = await nav;
  }
  const conn = since(clickAt, 'is-connected');
  ok(`${w}: ${m ? 'second tap' : 'click'} connects ("Connected ✓" at once) and opens WhatsApp about 450 ms later, in this tab`, !!conn && conn[0] - clickAt < 150 && navMs >= 430 && navMs < 900 && decodeURIComponent(page.url()).includes(MSG), `connected after ${conn ? conn[0] - clickAt : '–'} ms, WhatsApp after ${navMs} ms`);
  await page.waitForTimeout(500);
  await cdp.send('Page.stopScreencast').catch(() => {});
  await ctx.close();
  // The frames, from just before the first move to the WhatsApp stand-in, as a GIF around the button.
  const keep = frames.filter(([t]) => t >= start - 200 && t <= clickAt + 900);
  const pad = (i) => String(i).padStart(4, '0');
  const list = keep.map(([t, data], i) => {
    writeFileSync(`${tmp}/${pad(i)}.jpg`, Buffer.from(data, 'base64'));
    const next = keep[i + 1]?.[0] ?? t + 50;
    return `file '${pad(i)}.jpg'\nduration ${Math.max(0.01, (next - t) / 1000).toFixed(3)}`;
  });
  writeFileSync(`${tmp}/list.txt`, list.join('\n') + '\n');
  const crop = m ? `crop=375:520:0:${Math.max(0, Math.min(812 - 520, Math.round(box.y - 300)))}` : `crop=1100:560:60:${Math.max(0, Math.round(box.y - 300))}`;
  const name = `${out}/${w}-${m ? 'tap-tap' : 'hover-click'}.gif`;
  try {
    execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${tmp}/list.txt" -vf "${crop},fps=20,scale=${m ? 375 : 720}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse" "${name}"`);
    console.log(`${name} (${keep.length} frames)`);
  } catch (e) { console.log('ffmpeg failed', String(e).slice(0, 200)); }
  rmSync(tmp, { recursive: true, force: true });
}
await browser.close();
