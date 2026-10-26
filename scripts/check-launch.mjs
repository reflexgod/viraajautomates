// Pre-launch checks (brief section K). Needs the preview server (npm run serve).
//   node scripts/check-launch.mjs
// Prints PASS / FAIL per check.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { checkScroll } from './check-scroll.mjs';
import { checkHow } from './check-how.mjs';
import { checkOverlap } from './check-overlap.mjs';

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
// Round 6 (owner, 26 Oct 2026): the Plug-in button is the one call to action, everywhere.
const PLUG_MSG = 'Hi Viraaj, saw your website. Can you do a free check for my business?';
const PLUG_HREF = `https://wa.me/919653375679?text=${encodeURIComponent(PLUG_MSG)}`;
const pages6 = { '/': index, '/work/smile-dental/': caseHtml, '/404.html': readFileSync('public/404.html', 'utf8') };
const plugCount = Object.fromEntries(Object.entries(pages6).map(([p, t]) => [p, (t.match(/<div class="plugin plugin--(?:light|dark)[^"]*"[^>]*data-plugin/g) || []).length]));
const plugBad = Object.entries(pages6).flatMap(([p, t]) => [...t.matchAll(/<a class="plugin__btn"([^>]*)>/g)].filter((m) => !m[1].includes(`href="${PLUG_HREF}"`) || !m[1].includes('aria-label="Check my business on WhatsApp"') || / target=/.test(m[1])).map(() => p));
report('The Plug-in button everywhere "Check my business" was: hero, menu, Free check, footer; case study menu, band, footer; 404 (same tab, its own message, aria-label)', plugCount['/'] === 4 && plugCount['/work/smile-dental/'] === 3 && plugCount['/404.html'] === 1 && plugBad.length === 0 && !/>Check my business <span class="btn__arrow"/.test(copy), `${JSON.stringify(plugCount)} ${plugBad.join(' ')}`);
const heroCopy = index.slice(index.indexOf('<div class="hero__copy"'), index.indexOf('<div class="hero__strip"'));
const heroKids = [...heroCopy.matchAll(/\n {6}<(\w+) class="([\w-]+)/g)].map((m) => m[2]).join();
report('Hero holds only "( Mumbai · Pune )", the H1, the sub-line and the Plug-in button; "Free · on WhatsApp…" is in its bubble', heroKids === 'hero__label,hero__title,hero__sub,plugin' && !/compose|hero__link|<input|plugin__micro/.test(heroCopy) && /data-plugin data-plugin-3d/.test(heroCopy)
  && heroCopy.includes('>Mumbai · Pune<') && heroCopy.includes('I help businesses get found on Google<br> and answer enquiries, even after hours.') && heroCopy.includes('<span class="plugin__bubble-meta">Free · on WhatsApp · within one working day</span><span class="plugin__bubble-tap">Tap again to open WhatsApp</span>'), heroKids);
const checkSec = index.slice(index.indexOf('id="check"'), index.indexOf('</section>', index.indexOf('id="check"')));
report('Free check: the report teaser (statement and three steps) static, no field; the Plug-in button', !/<input|data-compose|data-report|unlock/i.test(checkSec) && /check__steps/.test(checkSec) && /data-plugin/.test(checkSec));
report('No "Get my free check", no boxed arrows, no composer left', !/Get my free check|btn__box|btn--plug|compose__/.test(copy) && !existsSync('public/js/compose.js'));
report('"no lock-in" only in Plain terms', (copy.match(/lock-in/gi) || []).length === 1 && /id="terms"[\s\S]*?no lock-in[\s\S]*?<\/section>/.test(index));
report('No negative reassurance words ("spam", "never share", "no hidden", "no charge")', !/\bspam\b|never share|no hidden|no charge|nothing is sold/i.test(copy));
report('No source tags like "(hero)" in any WhatsApp text', !/text=[^"]*%20\((?:hero|footer|nav|menu|services|how|free|case|404)/.test(copy));

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
const fresh = async (opts = {}, seen = true) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  if (seen) await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
  return ctx;
};

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
  const want = ["Hi Viraaj, I'd like the free check. Business name: ", "Hi Viraaj, saw your website. Can you do a free check for my business?", "Hi Viraaj, I'd like to know where I stand on Google. Business name: ", 'Hi Viraaj, can you check my website? Link: ', 'Hi Viraaj, I found your website and have a question.', 'Hi Viraaj, I saw the demo on your website. Can you show me how it would work for my business?'];
  report('WhatsApp prefilled texts: free check, hero composer, Google, website, question, live demo', want.every((t) => texts.has(t)), want.filter((t) => !texts.has(t)).join(' | '));
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

// ---------- Intro ----------
{
  const ctx = await fresh({}, false);
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'commit' });
  const present = await page.waitForSelector('[data-intro]', { state: 'attached', timeout: 4000 }).then(() => true, () => false);
  await page.waitForSelector('[data-intro]', { state: 'detached', timeout: 6000 });
  const ms = Date.now() - t0;
  report('Intro shows on the first visit and is gone within 2.5 s of starting', present && ms > 1500 && ms < 3300, `removed ${ms} ms after navigation (includes page load and the ≤400 ms font wait)`);
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const again = await page.evaluate(() => !!document.querySelector('[data-intro]'));
  report('Intro does not show again in the same session', !again);
  await ctx.close();
  for (const [name, act] of [['click', (p) => p.mouse.click(700, 450)], ['scroll', (p) => p.mouse.wheel(0, 200)], ['key', (p) => p.keyboard.press('ArrowDown')]]) {
    const c = await fresh({}, false);
    const p = await c.newPage();
    await p.goto(BASE + '/', { waitUntil: 'commit' });
    await p.waitForSelector('[data-intro]', { timeout: 4000 });
    await p.waitForTimeout(450);
    const t = Date.now();
    await act(p);
    await p.waitForSelector('[data-intro]', { state: 'detached', timeout: 3000 }).catch(() => {});
    const gone = await p.evaluate(() => !document.querySelector('[data-intro]'));
    report(`Intro skips on ${name}`, gone && Date.now() - t < 600, `${Date.now() - t} ms`);
    await c.close();
  }
  const r = await fresh({ reducedMotion: 'reduce' }, false);
  const rp = await r.newPage();
  await rp.goto(BASE + '/', { waitUntil: 'load' });
  report('Intro is absent with reduced motion', !(await rp.evaluate(() => !!document.querySelector('[data-intro]') || document.documentElement.classList.contains('intro-on'))));
  await r.close();
}

// ---------- Hero on a repeat visit: H1 visible within 1 s ----------
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
  await page.evaluate(() => { const el = document.querySelector('[data-preview="viraaj"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 400); });
  await page.waitForTimeout(1500);
  const box = await page.$eval('[data-preview="viraaj"] .pw__word', (e) => { const r = e.getBoundingClientRect(); return [r.left + 30, r.top + r.height / 2]; });
  await page.mouse.move(box[0] - 40, box[1] + 80);
  await page.mouse.move(box[0], box[1], { steps: 5 });
  await page.waitForTimeout(800);
  const shown = await page.evaluate(() => getComputedStyle(document.querySelector('[data-pcard]')).visibility === 'visible');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1600);
  const vis = await page.evaluate(() => getComputedStyle(document.querySelector('[data-pcard]')).visibility === 'visible');
  const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.pw')?.dataset.preview || null, box);
  report('Hover card: hover "Viraaj", scroll without moving the mouse: the card hides (or switches) with the page', shown && (under ? vis : !vis), `shown ${shown}, visible after scroll ${vis}, trigger under pointer: ${under}`);
  await ctx.close();
}

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
  const MSG = 'Hi Viraaj, saw your website. Can you do a free check for my business?';
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
    const look = await btn.evaluate((a) => { const cs = getComputedStyle(a), r = a.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), font: cs.fontFamily.split(',')[0], weight: cs.fontWeight, size: cs.fontSize, radius: cs.borderRadius, socket: getComputedStyle(a.querySelector('.plugin__socket')).display, bubble: getComputedStyle(a.closest('[data-plugin]').querySelector('.plugin__bubble')).visibility }; });
    const t0 = Date.now();
    const nav = page.waitForURL(/wa\.me/, { timeout: 3000 }).then(() => Date.now() - t0).catch(() => -1);
    if (!m) { await page.mouse.down(); await page.mouse.up(); } else await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    const connected = await page.waitForFunction((s) => document.querySelector(`${s} [data-plugin]`)?.classList.contains('is-connected'), sel, { timeout: 400 }).then(() => true).catch(() => false);
    const ms = await nav;
    const sent = decodeURIComponent(page.url());
    res6.push([`${w} ${sel}`, /is-open/.test(first) && !/is-cord/.test(first) && (!m || /is-armed/.test(first)) && look.bubble === 'visible' && connected && ms >= 430 && ms < 1000 && sent.includes(MSG) && look.h >= 56 && look.w >= 280 && look.w <= 310 && look.font === 'Inter' && look.weight === '500' && look.size === '18px' && look.radius === '4px' && look.socket !== 'none', `${m ? 'tap' : 'hover'}: ${first.replace('plugin ', '')}; ${look.w}×${look.h} ${look.font} ${look.weight} ${look.size}; connected ${connected}; WhatsApp after ${ms} ms`]);
    await ctx.close();
  }
  // The hero's bubble: above the button on desktop, below it on phones; never on the name or the sub-line.
  const bub = [];
  for (const [w, h] of [[1440, 900], [375, 812], [360, 740]]) {
    const m = w < 768;
    const ctx = await fresh({ viewport: { width: w, height: h }, isMobile: m, hasTouch: m });
    await stub(ctx);
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const b = await page.locator('.hero .plugin__btn').boundingBox();
    if (m) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
    await page.waitForTimeout(800);
    const g = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const bubble = r('.hero .plugin__bubble'), btn = r('.hero .plugin__btn'), h1 = r('.hero__title'), sub = r('.hero__sub'), hero = r('.hero');
      const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
      const tap = document.querySelector('.hero .plugin__bubble-tap');
      return { below: bubble.top >= btn.bottom, above: bubble.bottom <= btn.top, clear: !hit(bubble, h1) && !hit(bubble, sub), inside: bubble.top >= 0 && bubble.bottom <= Math.min(hero.bottom, innerHeight), tap: getComputedStyle(tap).display !== 'none', vis: getComputedStyle(document.querySelector('.hero .plugin__bubble')).visibility };
    });
    bub.push([(m ? g.below && g.tap : g.above && !g.tap) && g.clear && g.inside && g.vis === 'visible', `${w}: ${JSON.stringify(g)}`]);
    await ctx.close();
  }
  report('Hero bubble: above the button on desktop; below it on phones with "Tap again" as its last line; never on the name or sub-line; on screen', bub.every((r) => r[0]), bub.map((r) => r[1]).join(' | '));
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
  report('Plug-in button with reduced motion: "Check my business →", straight to WhatsApp', rm.arrow !== 'none' && rm.socket === 'none' && rms >= 0 && rms < 400, `${JSON.stringify(rm)}, ${rms} ms`);
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
  report('Keyboard: Tab reaches the service titles, buttons and footer links', ['Local SEO', 'Websites', 'Riya, AI receptionist', 'Automations', 'Find out where you stand on Google', 'Ask me for a live demo', 'Read the full case study', 'Check my business'].every((t) => seen.some((s) => s.includes(t))), `${seen.length} stops`);
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
const failed = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
