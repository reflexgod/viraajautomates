// Dev tool: traces a first visit (412 px phone, 4x CPU) and lists main-thread tasks over 50 ms
// with what is inside them.  node scripts/trace.mjs [url]   (needs npm run serve)
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 });
const page = await ctx.newPage();
if (process.env.STYLE) await ctx.addInitScript((css) => { document.addEventListener('readystatechange', () => {}, { once: true }); const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st); }, process.env.STYLE);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await browser.startTracing(page, { categories: ['toplevel', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink.user_timing'] });
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(8000);
const buf = await browser.stopTracing();
const { traceEvents } = JSON.parse(buf.toString());
if (process.env.DEBUG) { const big = {}; traceEvents.filter((e) => e.dur > 50000).forEach((e) => { big[e.name] = (big[e.name] || 0) + 1; }); console.log(big); }
const mtLayout = (pidtid) => traceEvents.filter((e) => e.name === 'Layout' && e.pid + ':' + e.tid === pidtid).reduce((a, e) => a + e.dur, 0);
const main = traceEvents.filter((e) => (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && e.dur > 50000);
const nav = traceEvents.find((e) => e.name === 'navigationStart')?.ts || traceEvents[0].ts;
// The page's main thread (CrRendererMain with the most work).
const mains = traceEvents.filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => e.pid + ':' + e.tid);
const counts = {};
traceEvents.filter((e) => /RunTask/.test(e.name) && mains.includes(e.pid + ':' + e.tid)).forEach((e) => { counts[e.pid + ':' + e.tid] = (counts[e.pid + ':' + e.tid] || 0) + e.dur; });
const mt = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
for (const t of main.filter((e) => e.pid + ':' + e.tid === mt)) {
  const inside = traceEvents.filter((e) => e.pid === t.pid && e.tid === t.tid && e.ts >= t.ts && e.ts + (e.dur || 0) <= t.ts + t.dur && e.dur > 8000 && !/RunTask/.test(e.name));
  console.log(`${Math.round((t.ts - nav) / 1000)}ms  ${Math.round(t.dur / 1000)}ms`);
  inside.slice(0, 14).forEach((e) => console.log(`    ${e.name} ${Math.round(e.dur / 1000)}ms ${e.args?.data?.url || e.args?.data?.functionName || e.args?.data?.type || ''} ${e.args?.beginData?.stackTrace?.[0]?.url || ''}:${e.args?.beginData?.stackTrace?.[0]?.functionName || ''}`));
}
console.log(`total Layout on main thread: ${Math.round(mtLayout(mt) / 1000)} ms`);
await browser.close();
