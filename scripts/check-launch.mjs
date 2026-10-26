// Pre-launch checks (brief section K). Needs the preview server (npm run serve).
//   node scripts/check-launch.mjs
// Prints PASS / FAIL per check.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { checkScroll } from './check-scroll.mjs';
import { checkHow } from './check-how.mjs';
import { checkOverlap } from './check-overlap.mjs';
import { checkCable } from './check-cable.mjs';
import { checkCursor } from './check-cursor.mjs';
import { checkSpeed } from './check-speed.mjs';
import { checkMono } from './check-mono.mjs';
import { checkPortrait } from './check-portrait.mjs';
import { checkPlug } from './check-plug.mjs';

const BASE = 'http://localhost:4173';
const results = [];
const report = (name, ok, detail = '') => { results.push([name, ok, detail]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

// ---------- Files ----------
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!p.includes('vendor')) walk(p); } else if (/\.(html|css|js|txt|xml|json)$/.test(f) || f === 'CNAME') files.push(p); } })('public');
const banned = /photo coming|placeholder|todo|lorem/i;
// The input's own placeholder attribute and the ::placeholder rule are not placeholder content.
const hits = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => banned.test(l.replace(/\splaceholder="[^"]*"|::placeholder/g, ''))));
report('No "Photo coming", "placeholder", "TODO", "lorem" in the site files', hits.length === 0, hits.map(([f, n]) => `${f}:${n}`).join(' '));
const html = files.filter((f) => f.endsWith('.html'));
report('No noindex anywhere', !html.some((f) => /noindex/i.test(readFileSync(f, 'utf8'))));
const robots = readFileSync('public/robots.txt', 'utf8');
report('robots.txt allows all and lists the sitemap', /User-agent: \*/i.test(robots) && !/Disallow: \/\s*$/m.test(robots) && /Sitemap: https:\/\/viraajautomates\.tech\/sitemap\.xml/.test(robots), robots.replace(/\n/g, ' | '));
const sitemap = readFileSync('public/sitemap.xml', 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
report('sitemap.xml uses https://viraajautomates.tech', locs.length > 0 && locs.every((u) => u.startsWith('https://viraajautomates.tech/')), locs.join(' '));
const index = readFileSync('public/index.html', 'utf8');
const urls = [...index.matchAll(/(?:rel="canonical" href|property="og:(?:url|image)" content|name="twitter:image" content)="([^"]+)"/g)].map((m) => m[1]);
report('Canonical and OG URLs use https://viraajautomates.tech', urls.length >= 3 && urls.every((u) => u.startsWith('https://viraajautomates.tech/')), urls.join(' '));
report('CNAME contains viraajautomates.tech', readFileSync('public/CNAME', 'utf8').trim() === 'viraajautomates.tech');
report('sitemap.xml lists the case study', locs.includes('https://viraajautomates.tech/work/smile-dental/'));
const caseHtml = readFileSync('public/work/smile-dental/index.html', 'utf8');
const caseMeta = ['<title>', 'name="description"', 'rel="canonical" href="https://viraajautomates.tech/work/smile-dental/"', 'property="og:url" content="https://viraajautomates.tech/work/smile-dental/"', 'property="og:title"', 'property="og:image"'];
report('Case study has its own title, description, canonical and OG tags', caseMeta.every((m) => caseHtml.includes(m)), caseMeta.filter((m) => !caseHtml.includes(m)).join(' '));
// Never reveal the method or the stack, anywhere a visitor can load.
const siteText = files.map((f) => [f, readFileSync(f, 'utf8')]);
// The words are stored encoded, so this public script doesn't name them either.
const method = new RegExp(Buffer.from('bjhufGdlbWluaXxvcGVuYWl8XGJWUFNcYnxwYWdlc3BlZWR8Z29vZ2xlXC5jb21cL3NlYXJjaHx2aWV3LXNvdXJjZXxsaWdodGhvdXNl', 'base64').toString(), 'i');
const methodHits = siteText.filter(([, t]) => method.test(t)).map(([f, t]) => `${f}: ${t.match(method)[0]}`);
report('No stack or method named in the site (tool names, test links)', methodHits.length === 0, methodHits.join(' | '));
// The demo site is never linked (owner, 26 Oct 2026): visitors ask on WhatsApp instead.
// The demo site is linked once (owner, 26 Oct 2026, round 5): the Riya row's "Chat with Riya now ↗"; nowhere else.
const demoHost = ['demo', 'viraajautomates', 'tech'].join('.');
const riyaDemo = `https://${demoHost}/?riya=open`;
const demoHits = siteText.flatMap(([f, t]) => t.split(demoHost).slice(1).map(() => f));
const riyaRow = index.split('<li class="row" data-row>')[3] || '';
report('The demo site is linked only from the Riya row ("Chat with Riya now ↗", new tab)', demoHits.length === 1 && riyaRow.includes(`<a class="proof" href="${riyaDemo}" target="_blank" rel="noopener"`) && riyaRow.includes('>Chat with Riya now <span aria-hidden="true">↗</span>'), demoHits.join(' | '));
// No speed claims (owner, 26 Oct 2026).
const speed = /in seconds|within seconds|instant|within the hour|in minutes|lightning|blazing/i;
// Visitor-facing text lives in the pages and in the two scripts that write sentences.
const speedHits = siteText.filter(([f]) => /\.html$|clock\.js$|message\.js$/.test(f)).filter(([, t]) => speed.test(t.replace(/<script[\s\S]*?<\/script>/g, ''))).map(([f, t]) => `${f}: ${t.match(speed)[0]}`);
report('No speed claims ("in seconds" and the like)', speedHits.length === 0, speedHits.join(' | '));
report('No "Sample" names left (fictional names, captions say "names changed")', !siteText.some(([f, t]) => f.endsWith('.html') && /[A-Z][a-z]+ Sample/.test(t)));
// The one exception is the owner's own hero line (round 4, 26 Oct 2026), in the hero and the meta description.

report('No "small business" anywhere a visitor can read', !siteText.some(([, t]) => /small business/i.test(t)));
const copy = html.map((f) => readFileSync(f, 'utf8')).join('\n');
report('No "reminders" claim anywhere', !/remind/i.test(copy));
report('No "Line 01" / "Line open" labels left', !/\(\s*Line\b|Line open|No line here/.test(copy));
report('No badges drawn on images', !/snap__tag|class="[^"]*badge/.test(copy));
// Round 3 (owner, 26 Oct 2026): honest limits, one call to action per service, no locked report.
report('No "unless you\'ve added them" anywhere', !/unless you(?:'|&#39;|’)ve added them/i.test(copy));
report('No "every customer" / "never miss" claims', !/every customer|never miss/i.test(copy));
const demoCta = (index.match(/>Ask me for a live demo/g) || []).length;
report('"Ask me for a live demo" at most twice on the home page (hero, How it works)', demoCta >= 1 && demoCta <= 2, `${demoCta}x`);
const rows = index.split('<li class="row" data-row>').slice(1).map((r) => r.slice(0, r.indexOf('</details>')));
// One call to action per row: a WhatsApp link, or (Riya) the demo link.
const rowBad = rows.filter((r) => {
  const title = r.match(/<h3 class="row__title">([\s\S]*?)<\/h3>/)?.[1] || '';
  const ctas = (r.match(/href="https:\/\/wa\.me\//g) || []).length + (r.match(/href="https:\/\/demo\./g) || []).length;
  return /<a\b/.test(title) || !/<button class="pw" type="button" data-preview="\w+"/.test(title) || ctas !== 1;
}).map((r) => r.match(/class="pw__word">([^<]+)/)?.[1] || '?');
report('Service titles open a preview, never a link; each row has exactly one call to action', rows.length === 4 && rowBad.length === 0, rowBad.join(' | '));
report('FAQ "Is my customers\' data safe?" names the AI service and the automation server', index.includes('Requests are saved in your own Google Sheet and inbox. To reply, messages pass through the AI service and the automation server I run. Riya never gives a diagnosis or fees.'));
report('Privacy notice names the AI service and the automation server as processors', /AI service and the automation server I run\. Both act as processors/.test(readFileSync('public/privacy.html', 'utf8')));
// Round 7 (owner, 26 Oct 2026): the hero is the name, a two-line sub-line and the Plug-in button.
report('Hero H1 is the name, on one line', /<h1 class="hero__title[^>]*>\s*<span class="line-mask"><span[^>]*>Viraaj Automates<\/span><\/span>\s*<\/h1>/.test(index));
// Rounds 6 and 8 (owner, 26 Oct 2026): the Plug-in button is the one call to action, everywhere:
// "Get my free report" ("Unlock my free report" under the report teaser), one message.
const PLUG_MSG = 'Hi Viraaj, saw your website. Can I get the free report for my business?';
const PLUG_HREF = `https://wa.me/919653375679?text=${encodeURIComponent(PLUG_MSG)}`;
const pages6 = { '/': index, '/work/smile-dental/': caseHtml, '/404.html': readFileSync('public/404.html', 'utf8') };
const plugCount = Object.fromEntries(Object.entries(pages6).map(([p, t]) => [p, (t.match(/<div class="plugin plugin--(?:light|dark)[^"]*"[^>]*data-plugin/g) || []).length]));
const plugBad = Object.entries(pages6).flatMap(([p, t]) => [...t.matchAll(/<a class="plugin__btn"([^>]*)>(?:<span[^>]*>){2}([^<]*)/g)].filter((m) => !m[1].includes(`href="${PLUG_HREF}"`) || !m[1].includes(`aria-label="${m[2]} on WhatsApp"`) || !/^(?:Get|Unlock) my free report$/.test(m[2]) || / target=/.test(m[1])).map((m) => `${p} ${m[2]}`));
report('The Plug-in button everywhere: hero, menu, Free report, footer; case study menu, band, footer; 404 ("Get my free report", same tab, one message, aria-label)', plugCount['/'] === 4 && plugCount['/work/smile-dental/'] === 3 && plugCount['/404.html'] === 1 && plugBad.length === 0, `${JSON.stringify(plugCount)} ${plugBad.join(' ')}`);
report('Nav "Free report" links send the same message', [index, caseHtml].every((t) => new RegExp(`<a class="nav__check" href="${PLUG_HREF.replace(/[?]/g, '\\?')}"[^>]*>Free report<`).test(t)));
report('"free report" everywhere, never "free check" or "check my business"', !/free check|check my business/i.test(html.map((f) => readFileSync(f, 'utf8')).join('\n') + readFileSync('public/js/plugin.js', 'utf8')) && /\( <\/span>Free report<span/.test(index) && index.includes('After the free report you get a fixed price') && readFileSync('public/privacy.html', 'utf8').includes('the free report you asked for'));
// Every button carries the mini WhatsApp chat: header, the message with time and ticks, the line about the report.
const chats = Object.values(pages6).flatMap((t) => [...t.matchAll(/<div class="plugin__chat" aria-hidden="true">([\s\S]*?)<\/div><\/div><\/div>/g)].map((m) => m[1]));
report('Each Plug-in button has the mini WhatsApp chat (Viraaj, the message, time and ticks, "Free · on WhatsApp · within one working day", "Tap again to send")', chats.length === 8 && chats.every((c) => c.includes('<b>Viraaj</b><small>usually replies within a day</small>') && c.includes(`data-chat-rest>${PLUG_MSG}<`) && c.includes('data-chat-time') && c.includes('chat__ticks') && c.includes('Free · on WhatsApp · within one working day') && c.includes('Tap again to send')), `${chats.length} chats`);
const heroCopy = index.slice(index.indexOf('<div class="hero__copy"'), index.indexOf('<div class="hero__strip"'));
const heroKids = [...heroCopy.matchAll(/\n {6}<(\w+) class="([\w-]+)/g)].map((m) => m[2]).join();
report('Hero holds only the H1, the sub-line and the Plug-in button (no place label); Mumbai and Pune stay in the description and structured data', heroKids === 'hero__title,hero__sub,plugin' && !/compose|hero__link|<input|plugin__micro/.test(heroCopy) && /data-plugin data-plugin-3d/.test(heroCopy)
  && !heroCopy.includes('Mumbai · Pune') && /name="description" content="[^"]*Mumbai and Pune/.test(index) && index.includes('"areaServed": ["Mumbai", "Pune"]') && heroCopy.includes('I help businesses get found on Google<br> and answer enquiries, even after hours.'), heroKids);
const checkSec = index.slice(index.indexOf('id="check"'), index.indexOf('</section>', index.indexOf('id="check"')));
report('Free report: the report teaser (statement and three steps) static, no field; "Unlock my free report"', !/<input|data-compose|data-report/i.test(checkSec) && /check__steps/.test(checkSec) && /data-plugin/.test(checkSec) && checkSec.includes('<span class="plugin__text">Unlock my free report</span>'));
report('No "Get my free check", no boxed arrows, no composer left', !/Get my free check|btn__box|btn--plug|compose__/.test(copy) && !existsSync('public/js/compose.js'));
report('"no lock-in" only in Plain terms', (copy.match(/lock-in/gi) || []).length === 1 && /id="terms"[\s\S]*?no lock-in[\s\S]*?<\/section>/.test(index));
report('No negative reassurance words ("spam", "never share", "no hidden", "no charge")', !/\bspam\b|never share|no hidden|no charge|nothing is sold/i.test(copy));
report('No source tags like "(hero)" in any WhatsApp text', !/text=[^"]*%20\((?:hero|footer|nav|menu|services|how|free|case|404)/.test(copy));

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
const fresh = (opts = {}) => browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });

// ---------- Footer, images, links ----------
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const links = new Map();
  for (const path of ['/', '/work/smile-dental/', '/privacy', '/404.html']) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const foot = await page.evaluate(() => [...document.querySelectorAll('footer p')].map((p) => p.textContent.trim()).find((t) => t.startsWith('©')));
    report(`Footer line on ${path}`, foot === '© 2026 Nexoraa. Viraaj Automates is a Nexoraa brand.', foot);
    // Every image has a source that loads, with width and height set (below the fold: lazy)
    const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src'), w: i.getAttribute('width'), h: i.getAttribute('height'), lazy: i.loading, top: i.getBoundingClientRect().top + scrollY })));
    const bad = imgs.filter((i) => !i.src || !i.w || !i.h || (i.top > 1200 && i.lazy !== 'lazy'));
    report(`Images on ${path}: source, width, height, lazy below the fold`, bad.length === 0, bad.map((i) => i.src).join(' '));
    for (const href of await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href))) links.set(href, path);
    // Every file the page references (img, source, poster, lightbox targets) loads
    const refs = await page.evaluate(() => {
      const u = (x) => new URL(x, location.href).href;
      const out = [];
      document.querySelectorAll('img[src]').forEach((i) => out.push(u(i.getAttribute('src'))));
      document.querySelectorAll('source[srcset]').forEach((s) => s.getAttribute('srcset').split(',').forEach((p) => out.push(u(p.trim().split(' ')[0]))));
      document.querySelectorAll('source[src]').forEach((s) => out.push(u(s.getAttribute('src'))));
      document.querySelectorAll('video[poster]').forEach((v) => out.push(u(v.getAttribute('poster'))));
      document.querySelectorAll('[data-full], [data-fallback]').forEach((t) => { if (t.dataset.full) out.push(u(t.dataset.full)); if (t.dataset.fallback) out.push(u(t.dataset.fallback)); });
      return [...new Set(out)].filter((x) => !x.startsWith('data:'));
    });
    const miss = [];
    for (const r of refs) { const res = await page.request.get(r); if (res.status() !== 200) miss.push(`${r} (${res.status()})`); }
    report(`Every image and video file on ${path} exists (${refs.length})`, miss.length === 0, miss.join(' '));
    // Captions: every figure caption says "Demo"
    const caps = await page.evaluate(() => [...document.querySelectorAll('main figcaption')].map((c) => c.textContent.trim()));
    if (caps.length) { const bad = caps.filter((c) => !/Demo/.test(c)); report(`Every caption on ${path} says "Demo" (${caps.length})`, bad.length === 0, bad.join(' | ')); }
    // A caption whose picture shows a (fictional) name ends "Demo · names changed".
    const named = await page.evaluate(() => [...document.querySelectorAll('main figure')].filter((f) => /Asha Rao/.test(f.textContent + [...f.querySelectorAll('img')].map((i) => i.alt).join(' '))).map((f) => f.querySelector('figcaption')?.textContent.trim() || '(no caption)'));
    if (named.length) { const badN = named.filter((c) => !/Demo · names changed$/.test(c)); report(`Captions showing a name end "Demo · names changed" on ${path} (${named.length})`, badN.length === 0, badN.join(' | ')); }
    // Section labels: one format, "( Word )"
    const labels = await page.evaluate(() => [...document.querySelectorAll('.t-label')].map((l) => l.textContent.trim().replace(/\s+/g, ' ')));
    const badL = labels.filter((l) => !/^\( [^()]+ \)$/.test(l));
    report(`Labels on ${path} all read "( … )"`, badL.length === 0, badL.join(' | '));
  }
  // Internal links: 200; in-page anchors: target exists
  const broken = [];
  const wa = [];
  for (const [href, from] of links) {
    const u = new URL(href);
    if (u.protocol === 'mailto:') { if (u.pathname !== 'viraaj.automates@gmail.com') broken.push(href); continue; }
    if (u.hostname === 'wa.me') { wa.push(href); continue; }
    if (u.origin === BASE) {
      if (u.hash && u.pathname === '/') { await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); if (!(await page.$(u.hash))) broken.push(`${href} (from ${from})`); continue; }
      const r = await page.request.get(href); if (r.status() !== 200) broken.push(`${href} ${r.status()} (from ${from})`);
      continue;
    }
    // External: anything else must answer
    try { const r = await page.request.get(href, { timeout: 15000 }); if (r.status() >= 400) broken.push(`${href} ${r.status()}`); } catch (e) { broken.push(`${href} (${String(e).slice(0, 60)})`); }
  }
  report('Every link works (internal pages, anchors, email)', broken.length === 0, broken.join(' | '));
  const waBad = wa.filter((h) => { const u = new URL(h); return u.pathname !== '/919653375679' || !u.searchParams.get('text'); });
  const texts = new Set(wa.map((h) => new URL(h).searchParams.get('text')));
  const want = ['Hi Viraaj, saw your website. Can I get the free report for my business?',"Hi Viraaj, I'd like to know where I stand on Google. Business name: ", 'Hi Viraaj, can you check my website? Link: ', 'Hi Viraaj, I found your website and have a question.', 'Hi Viraaj, I saw the demo on your website. Can you show me how it would work for my business?'];
  report('WhatsApp prefilled texts: free report, Google, website, question, live demo', want.every((t) => texts.has(t)), want.filter((t) => !texts.has(t)).join(' | '));
  report(`Every WhatsApp link opens +91 96533 75679 with prefilled text (${wa.length} links)`, wa.length > 0 && waBad.length === 0, [...new Set(wa.map((h) => new URL(h).searchParams.get('text')))].map((t) => `"${t}"`).join(' / '));
  await ctx.close();
}

// ---------- No sideways scroll ----------
{
  const over = [];
  for (const w of [360, 375, 414, 768, 1024, 1440]) {
    const ctx = await fresh({ viewport: { width: w, height: 800 }, isMobile: w < 768, hasTouch: w < 768 });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    let worst = 0;
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 700) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(120);
      worst = Math.max(worst, await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
    }
    if (worst > 0) over.push(`${w}px: ${worst}px`);
    await ctx.close();
  }
  report('No horizontal scroll at 360, 375, 414, 768, 1024, 1440', over.length === 0, over.join(' '));
}

// ---------- Nothing looks empty (scripts/check-scroll.mjs) ----------
await checkScroll({ browser, fresh, report, base: BASE });

// ---------- How it works never overlaps (scripts/check-how.mjs) ----------
await checkHow({ browser, base: BASE, report });

// ---------- Speed and seamless: hero from first paint, fonts, page changes, back button, pin, scrolling (scripts/check-speed.mjs) ----------
await checkSpeed({ browser, base: BASE, report });

// ---------- Mono labels on one line at 375 and 320 (scripts/check-mono.mjs) ----------
await checkMono({ browser, base: BASE, report });

// ---------- Hero: H1 visible within 1 s ----------
{
  const ctx = await fresh({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'commit' });
  await page.waitForSelector('.hero__title', { timeout: 5000 });
  const t0 = Date.now();
  let seen = -1;
  while (Date.now() - t0 < 3000) {
    const ok = await page.evaluate(() => {
      const spans = [...document.querySelectorAll('.hero__title .line-mask > span')];
      return spans.length > 0 && spans.every((s) => { const m = new DOMMatrix(getComputedStyle(s).transform); return Math.abs(m.m42) < s.offsetHeight * 0.5; });
    });
    if (ok) { seen = Date.now() - t0; break; }
    await page.waitForTimeout(50);
  }
  report('Repeat visit at 375: the H1 is visible within 1 s of first paint', seen >= 0 && seen <= 1000, `${seen} ms`);
  await ctx.close();
}

// ---------- Hover card follows the page while it scrolls under a still pointer ----------
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const el = document.querySelector('[data-preview="websites"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 400); });
  await page.waitForTimeout(1500);
  const box = await page.$eval('[data-preview="websites"] .pw__word', (e) => { const r = e.getBoundingClientRect(); return [r.left + 30, r.top + r.height / 2]; });
  await page.mouse.move(box[0] - 40, box[1] + 80);
  await page.mouse.move(box[0], box[1], { steps: 5 });
  await page.waitForTimeout(800);
  const shown = await page.evaluate(() => getComputedStyle(document.querySelector('[data-pcard]')).visibility === 'visible');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1600);
  const vis = await page.evaluate(() => getComputedStyle(document.querySelector('[data-pcard]')).visibility === 'visible');
  const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.pw')?.dataset.preview || null, box);
  report('Hover card: hover a service title, scroll without moving the mouse: the card hides (or switches) with the page', shown && (under ? vis : !vis), `shown ${shown}, visible after scroll ${vis}, trigger under pointer: ${under}`);
  await ctx.close();
}

// ---------- The About portrait (scripts/check-portrait.mjs) ----------
await checkPortrait({ browser, base: BASE, report });

// ---------- Service titles open their preview (lightbox), never a new tab ----------
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  let popups = 0;
  ctx.on('page', () => { popups++; });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const opened = [];
  for (const key of ['seo', 'websites', 'riya', 'automations']) {
    const t = page.locator(`.row__title [data-preview="${key}"] .pw__word`);
    await t.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await t.click();
    await page.waitForTimeout(700);
    const ok = await page.evaluate(() => { const d = document.querySelector('[data-lightbox]'); return d.open && d.querySelector('[data-lightbox-media]').children.length > 0; });
    opened.push(`${key}: ${ok ? 'preview' : 'nothing'}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  report('Each service title opens its preview, and no title opens WhatsApp', opened.every((o) => o.endsWith('preview')) && popups === 0, `${opened.join(', ')}; new tabs ${popups}`);
  await ctx.close();
}

// ---------- The Plug-in button: hover, click, taps, reduced motion, no JS ----------
// (The hero's 3D cord reaching for the socket, with GIFs: scripts/record-plugin.mjs.)
{
  const MSG = 'Hi Viraaj, saw your website. Can I get the free report for my business?';
  const stub = (ctx) => ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'whatsapp' }));
  const res6 = [];
  for (const [w, sel] of [[1440, '#check'], [1440, '#contact'], [375, '#check']]) {
    const m = w < 768;
    const ctx = await fresh({ viewport: { width: w, height: m ? 812 : 900 }, isMobile: m, hasTouch: m });
    await stub(ctx);
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const btn = page.locator(`${sel} .plugin__btn`);
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const cls = () => page.locator(`${sel} [data-plugin]`).getAttribute('class');
    const b = await btn.boundingBox();
    let first = '';
    if (!m) { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 }); await page.waitForTimeout(700); first = await cls(); }
    else { await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(700); first = await cls(); }
    const look = await btn.evaluate((a) => { const cs = getComputedStyle(a), r = a.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), font: cs.fontFamily.split(',')[0], weight: cs.fontWeight, size: cs.fontSize, radius: cs.borderRadius, socket: getComputedStyle(a.querySelector('.plugin__socket')).display, bubble: getComputedStyle(a.closest('[data-plugin]').querySelector('.plugin__chat')).visibility }; });
    // One socket only: the 2D plug does not wait beside it (it shows only as it snaps in).
    const plugShown = await btn.evaluate((a) => +getComputedStyle(a.querySelector('.plugin__plug')).opacity > 0.05);
    const t0 = Date.now();
    const nav = page.waitForURL(/wa\.me/, { timeout: 3000 }).then(() => Date.now() - t0).catch(() => -1);
    if (!m) { await page.mouse.down(); await page.mouse.up(); } else { const nb = await btn.boundingBox(); await page.touchscreen.tap(nb.x + nb.width / 2, nb.y + nb.height / 2); }
    const connected = await page.waitForFunction((s) => document.querySelector(`${s} [data-plugin]`)?.classList.contains('is-sent'), sel, { timeout: 400 }).then(() => true).catch(() => false);
    // Snapped: the plug face sits exactly on the socket, the ticks are blue.
    await page.waitForTimeout(280);
    const snap = await page.evaluate((s) => { const r = document.querySelector(`${s} [data-plugin]`); if (!r) return null; const p = r.querySelector('.plugin__plug').getBoundingClientRect(), k = r.querySelector('.plugin__socket svg').getBoundingClientRect(); return { dx: Math.round(p.left - k.left), dy: Math.round(p.top - k.top), tick: getComputedStyle(r.querySelector('.chat__ticks')).color }; }, sel).catch(() => null);
    const ms = await nav;
    const sent = decodeURIComponent(page.url());
    const fit = !!snap && snap.dx === 0 && snap.dy === 0 && snap.tick === 'rgb(83, 189, 235)';
    res6.push([`${w} ${sel}`, /is-open/.test(first) && !/is-cord/.test(first) && (!m || /is-armed/.test(first)) && look.bubble === 'visible' && !plugShown && fit && connected && ms >= 430 && ms < 1000 && sent.includes(MSG) && look.h >= 56 && look.w === 300 && look.font === 'Inter' && look.weight === '500' && look.size === '18px' && look.radius === '4px' && look.socket !== 'none', `${m ? 'tap' : 'hover'}: ${first.replace('plugin ', '')}; ${look.w}×${look.h} ${look.font} ${look.weight} ${look.size}; 2D plug beside the socket ${plugShown}, snapped ${JSON.stringify(snap)}; connected ${connected}; WhatsApp after ${ms} ms`]);
    await ctx.close();
  }
  // The chat opens below the button, types the message in, covers no text, stays on screen;
  // the button does not move (on a phone the second tap lands where the first did).
  const bub = [];
  for (const [w, h, sel] of [[1440, 900, '.hero'], [1440, 900, '#check'], [1440, 900, '#contact'], [375, 812, '.hero'], [360, 740, '.hero'], [375, 812, '#check']]) {
    const m = w < 768;
    const ctx = await fresh({ viewport: { width: w, height: h }, isMobile: m, hasTouch: m });
    await stub(ctx);
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const btn = page.locator(`${sel} .plugin__btn`);
    if (sel !== '.hero') { await btn.evaluate((a) => a.scrollIntoView({ block: 'center' })); await page.waitForTimeout(900); }
    const b = await btn.boundingBox();
    const pageY = await page.evaluate((y) => Math.round(y + scrollY), b.y);
    if (m) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
    const mid = await page.waitForTimeout(300).then(() => page.evaluate((s) => document.querySelector(`${s} [data-chat-typed]`).textContent.length, sel));
    await page.waitForTimeout(1000);
    const g = await page.evaluate(([s, m]) => {
      const root = document.querySelector(`${s} [data-plugin]`);
      const scope = m && s === '.hero' ? document.querySelector('.hero') : document.body;
      const card = root.querySelector('.chat').getBoundingClientRect(), btnR = root.querySelector('.plugin__btn').getBoundingClientRect();
      const covered = [];
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() && !root.contains(n.parentElement) ? 1 : 2) });
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (getComputedStyle(n.parentElement).visibility !== 'visible' || n.parentElement.closest('.sr-only, [aria-hidden="true"], .cursor')) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) if (q.width > 1 && q.left < card.right && card.left < q.right && q.top < card.bottom && card.top < q.bottom) covered.push(n.textContent.trim().slice(0, 24));
      }
      return { btnPageY: Math.round(btnR.top + scrollY), below: card.top >= btnR.bottom, onScreen: card.top >= 0 && card.bottom <= innerHeight, covered, w: Math.round(card.width), typed: root.querySelector('[data-chat-typed]').textContent.length, meta: getComputedStyle(root.querySelector('.chat__meta')).opacity, tap: getComputedStyle(root.querySelector('.chat__tap')).display !== 'none', time: /^\d\d:\d\d$/.test(root.querySelector('[data-chat-time]').textContent) };
    }, [sel, m]);
    const ok = g.below && g.onScreen && !g.covered.length && Math.abs(g.btnPageY - pageY) <= 3 && mid > 0 && mid < MSG.length && g.typed === MSG.length && g.meta === '1' && g.time && g.tap === m && g.w === (m ? w - 48 : 340);
    bub.push([ok, `${w} ${sel}: ${JSON.stringify({ ...g, midType: mid })}`]);
    await ctx.close();
  }
  report('The mini chat: below the button (which keeps its place; a phone scrolls the chat into view), typed in, then time and ticks; covers no text (the phone hero: none in the hero); on screen; "Tap again to send" on phones', bub.every((r) => r[0]), bub.map((r) => r[1]).join(' | '));
  report('Plug-in button (2D plug): hover or first tap shows the message; click or second tap connects, then WhatsApp in this tab about 450 ms later', res6.every((r) => r[1]), res6.map((r) => `${r[0]}: ${r[2]}`).join(' | '));
  // Reduced motion: a plain link with an arrow, no socket, straight to WhatsApp.
  const rc = await fresh({ reducedMotion: 'reduce' });
  await stub(rc);
  const rp = await rc.newPage();
  await rp.goto(BASE + '/', { waitUntil: 'load' });
  const rm = await rp.evaluate(() => { const a = document.querySelector('.hero .plugin__btn'); return { arrow: getComputedStyle(a.querySelector('.plugin__arrow')).display, socket: getComputedStyle(a.querySelector('.plugin__socket')).display }; });
  const r0 = Date.now();
  const rnav = rp.waitForURL(/wa\.me/, { timeout: 3000 }).then(() => Date.now() - r0).catch(() => -1);
  await rp.click('.hero .plugin__btn');
  const rms = await rnav;
  report('Plug-in button with reduced motion: "Get my free report →", straight to WhatsApp', rm.arrow !== 'none' && rm.socket === 'none' && rms >= 0 && rms < 400, `${JSON.stringify(rm)}, ${rms} ms`);
  await rc.close();
  // Without JavaScript: the same plain link.
  const nj = await fresh({ javaScriptEnabled: false });
  const np = await nj.newPage();
  await np.goto(BASE + '/', { waitUntil: 'load' });
  const nojs = await np.evaluate(() => [...document.querySelectorAll('.plugin__btn')].map((a) => ({ arrow: getComputedStyle(a.querySelector('.plugin__arrow')).display, socket: getComputedStyle(a.querySelector('.plugin__socket')).display, text: new URL(a.href).searchParams.get('text') })));
  report('Plug-in button without JavaScript: a plain link with an arrow and the message', nojs.length === 4 && nojs.every((x) => x.arrow !== 'none' && x.socket === 'none' && x.text === MSG), JSON.stringify(nojs[0]));
  await nj.close();
  // Every other primary button: Inter 500, sentence case.
  const bc = await fresh();
  const bp = await bc.newPage();
  const mono = [];
  for (const path of ['/', '/work/smile-dental/', '/404.html']) {
    await bp.goto(BASE + path, { waitUntil: 'load' });
    mono.push(...(await bp.evaluate(() => [...document.querySelectorAll('.btn')].filter((b) => { const cs = getComputedStyle(b); return !/Inter/.test(cs.fontFamily) || cs.textTransform !== 'none' || cs.fontWeight !== '500'; }).map((b) => b.textContent.trim()))).map((t) => `${path}: ${t}`));
  }
  report('Every other primary button is Inter 500, sentence case', mono.length === 0, mono.join(' | '));
  await bc.close();
}


// ---------- No text on text while scrolling: How it works (pin), process rows, services, the case study (sticky tabs) ----------
await checkOverlap({ browser, base: BASE, report });


// ---------- The hero cord: mouse and touch, and not switched off for ordinary phones ----------
await checkCable({ browser, base: BASE, report });

// ---------- The hero cord is plugged into the button's socket (WebKit and Chromium, phones and laptops) ----------
await checkPlug({ base: BASE, report });


// ---------- The cursor: visible on dark and light sections, never over words ----------
await checkCursor({ browser, base: BASE, report });


// ---------- Keyboard ----------
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const seen = [];
  let noRing = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return null;
      const cs = getComputedStyle(a); const w = a.querySelector('.pw__word, .tile__shot'); const ws = w ? getComputedStyle(w) : null;
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (ws && ws.outlineStyle !== 'none' && parseFloat(ws.outlineWidth) >= 2)
        // The composer's writing line: full cream and 2 px thick on focus
        || (a.tagName === 'INPUT' && cs.boxShadow !== 'none' && parseFloat(cs.borderBottomWidth) >= 1);
      return { label: (a.getAttribute('aria-label') || a.textContent || a.className).trim().replace(/\s+/g, ' ').slice(0, 40), ring, tag: a.tagName };
    });
    if (!f) continue;
    seen.push(f.label);
    if (!f.ring) noRing.push(f.label);
  }
  report('Keyboard: every focused element shows a 2 px outline', noRing.length === 0, noRing.slice(0, 6).join(' | '));
  report('Keyboard: Tab reaches the service titles, buttons and footer links', ['Local SEO', 'Websites', 'Riya, AI receptionist', 'Automations', 'Find out where you stand on Google', 'Ask me for a live demo', 'Read the full case study', 'Get my free report', 'Unlock my free report'].every((t) => seen.some((s) => s.includes(t))), `${seen.length} stops`);
  // Menu: focus trap, Escape, focus return
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.focus('[data-menu-btn]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const inside = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); inside.push(await page.evaluate(() => !!document.activeElement.closest('[data-menu], [data-nav]'))); }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  const back = await page.evaluate(() => document.activeElement.matches('[data-menu-btn]') && document.querySelector('[data-menu]').hidden);
  report('Menu traps focus while open', inside.every(Boolean));
  report('Escape closes the menu and returns focus to the menu button', back);
  await ctx.close();
}
await browser.close();
// The summary, and the exit code: 1 when any check failed, 0 only when all passed.
const failed = results.filter((r) => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log(`FAILED:\n${failed.map((r) => `  - ${r[0]}`).join('\n')}`);
process.exit(failed.length ? 1 : 0);
