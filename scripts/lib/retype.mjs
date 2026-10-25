// Re-set a few words inside a real screenshot so they match it exactly:
// the font, size, position and colour are fitted against text that is already
// in the same screenshot (brute force, smallest pixel difference), then the
// old words are covered with the cell's own background and the new words are
// drawn with the fitted settings. Used by prepare-demo-shots.mjs to mask
// phone numbers as "99999 XXX99" and to fix one capital letter, never to add
// anything that was not there.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const FONTS = {
  Roboto: 'node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2',
};

let browser = null;
async function page() {
  browser ??= await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await browser.newPage();
  const faces = Object.entries(FONTS).map(([name, file]) => `@font-face { font-family: "${name}"; src: url(data:font/woff2;base64,${readFileSync(file).toString('base64')}); }`).join('\n');
  await p.setContent(`<style>${faces}</style><body>${Object.keys(FONTS).map((f) => `<span style="font-family:'${f}'">x</span>`).join('')}</body>`);
  await p.evaluate(() => document.fonts.ready);
  return p;
}
export async function closeRetype() { await browser?.close(); browser = null; }

// png: Buffer. jobs: [{ ref: {x, y, w, h, text}, fonts: ['Arial', 'Roboto'], cover: {x, y, w, h}, text }]
//   or [{ fixed: {font, size, x, y}, cover, text }] when the settings are already known.
// The new text starts where the reference text starts (same x and baseline),
// unless `place: {dx, dy}` moves it relative to the fitted origin.
export async function retype(png, jobs) {
  const p = await page();
  const out = await p.evaluate(async ({ src, jobs }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const base = document.createElement('canvas');
    base.width = W; base.height = H;
    const bc = base.getContext('2d', { willReadFrequently: true });
    bc.drawImage(img, 0, 0);
    const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const report = [];
    for (const job of jobs) {
      // job.fixed = { font, size, x, y }: draw with known settings (no fitting);
      // colours still come from the cover area of the screenshot itself.
      const { x, y, w, h, text } = job.ref || { ...job.cover, text: '' };
      const ref = bc.getImageData(x, y, w, h).data;
      // Background: the brightest pixel; ink: the darkest.
      let bg = [0, 0, 0], ink = [255, 255, 255], bl = -1, il = 999;
      for (let i = 0; i < ref.length; i += 4) {
        const l = lum(ref, i);
        if (l > bl) { bl = l; bg = [ref[i], ref[i + 1], ref[i + 2]]; }
        if (l < il) { il = l; ink = [ref[i], ref[i + 1], ref[i + 2]]; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cx = c.getContext('2d', { willReadFrequently: true });
      const diff = (font, size, ox, oy) => {
        cx.fillStyle = `rgb(${bg})`; cx.fillRect(0, 0, w, h);
        cx.fillStyle = `rgb(${ink})`; cx.font = `${size}px "${font}"`; cx.textBaseline = 'alphabetic';
        cx.fillText(text, ox, oy);
        const d = cx.getImageData(0, 0, w, h).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s += Math.abs(lum(d, i) - lum(ref, i));
        return s;
      };
      let best = job.fixed ? { s: 0, font: job.fixed.font, size: job.fixed.size, ox: job.fixed.x - x, oy: job.fixed.y - y } : null;
      for (const font of job.fixed ? [] : job.fonts) {
        for (let size = job.sizes?.[0] ?? 12; size <= (job.sizes?.[1] ?? 20); size += 0.25) {
          for (let ox = 0; ox <= (job.maxX ?? 8); ox += 0.5) {
            for (let oy = Math.round(h * 0.45); oy <= h; oy += 0.5) {
              const s = diff(font, size, ox, oy);
              if (!best || s < best.s) best = { s, font, size, ox, oy };
            }
          }
        }
      }
      // Cover the old words, draw the new ones.
      const cv = job.cover;
      bc.fillStyle = `rgb(${bg})`;
      bc.fillRect(cv.x, cv.y, cv.w, cv.h);
      bc.fillStyle = `rgb(${ink})`;
      bc.font = `${best.size}px "${best.font}"`;
      bc.textBaseline = 'alphabetic';
      bc.fillText(job.text, x + best.ox + (job.place?.dx || 0), y + best.oy + (job.place?.dy || 0));
      report.push(`${text} -> ${job.text}: ${best.font} ${best.size}px, origin ${x + best.ox},${y + best.oy}, diff/px ${(best.s / (w * h)).toFixed(1)}`);
    }
    return { data: base.toDataURL('image/png'), report };
  }, { src: `data:image/png;base64,${png.toString('base64')}`, jobs });
  await p.close();
  out.report.forEach((r) => console.log('  retype: ' + r));
  return Buffer.from(out.data.split(',')[1], 'base64');
}
