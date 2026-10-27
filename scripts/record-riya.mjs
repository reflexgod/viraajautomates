// Records the Riya panel opening and closing (the cord, the socket, the panel
// growing out of it, a reply, then back into the socket) at 1440 and 375, and
// turns each into a GIF in docs/screenshots/riya-panel/. The reply is stubbed
// so the recording is the same every time.
//   node scripts/record-riya.mjs      (needs npm run serve, ffmpeg on PATH)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const OUT = 'docs/screenshots/riya-panel';
const TMP = `${OUT}/.frames`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });

for (const [w, h, mobile] of [[1440, 900, false], [375, 812, true]]) {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await ctx.route('https://chat.viraajautomates.tech/**', (r) => setTimeout(() => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ output: 'Namaste! Saturday morning ka slot mil jayega. Aapka naam bata dijiye?' }) }), 900));
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('motion'), null, { timeout: 8000 }).catch(() => {});
  const link = page.locator('#services [data-riya]');
  await link.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 120));
  await page.waitForTimeout(800);
  // Load the panel's code first, as a hover would, so the recording starts at the click.
  await link.hover().catch(() => {});
  await page.waitForTimeout(700);

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  const t0 = Date.now();
  cdp.on('Page.screencastFrame', ({ data, sessionId }) => { frames.push([Date.now() - t0, data]); cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
  await page.waitForTimeout(300);
  if (mobile) await link.tap(); else await link.click();
  await page.waitForTimeout(1600);
  await page.locator('.riya__chip').first().click();
  await page.waitForTimeout(2400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1300);
  await cdp.send('Page.stopScreencast');
  await ctx.close();

  // Frames at their real times, resampled to 25 fps.
  const list = [];
  frames.forEach(([t, data], i) => {
    const f = `${TMP}/${String(i).padStart(4, '0')}.jpg`;
    writeFileSync(f, Buffer.from(data, 'base64'));
    const next = frames[i + 1] ? frames[i + 1][0] : t + 40;
    list.push(`file '${f.split('/').pop()}'`, `duration ${((next - t) / 1000).toFixed(3)}`);
  });
  writeFileSync(`${TMP}/list.txt`, list.join('\n'));
  const gif = `${OUT}/riya-open-close-${w}.gif`;
  const scale = mobile ? 360 : 720;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${TMP}/list.txt`, '-vf', `fps=25,scale=${scale}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, gif]);
  console.log(`${gif}  ${frames.length} frames`);
}
rmSync(TMP, { recursive: true, force: true });
await browser.close();
