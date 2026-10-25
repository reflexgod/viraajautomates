// Dev tool: CPU profile of a first visit (412 px phone, 4x CPU); prints the
// functions with the most self time, by file.  node scripts/profile.mjs [url] [ms]
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:4173/';
const ms = Number(process.argv[3] || 7000);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.RATE || 4) });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(ms);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => { const n = byId.get(id); const f = n.callFrame; const key = `${f.functionName || '(anon)'}  ${f.url.replace(/^.*\/\/[^/]+/, '')}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0)); });
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => console.log(`${(v / 1000).toFixed(0).padStart(6)} ms  ${k}`));
await browser.close();
