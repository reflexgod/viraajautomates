// Shared by every page: the house curve, smooth scrolling and in-page glides.
// Everything here is an enhancement; without it the page scrolls natively.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// The one house curve, cubic-bezier(.22, 1, .36, 1), the same as --ease in CSS.
function bezier(x1, y1, x2, y2) {
  const at = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  return (x) => {
    if (x <= 0 || x >= 1) return x;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 20; i++) { t = (lo + hi) / 2; if (at(x1, x2, t) < x) lo = t; else hi = t; }
    return at(y1, y2, t);
  };
}
export const house = bezier(0.22, 1, 0.36, 1);

// Phones and tablets scroll natively (their own momentum, nothing on the main
// thread); smooth scrolling is for wheels and trackpads only.
const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;

// Back and forward: the page comes back where it was left. Most browsers keep
// the page in memory (back/forward cache) and nothing is needed. Otherwise the
// browser restores the scroll itself; the position saved on leaving is applied
// again after the page has set itself up, in case anything above it changed height.
const SCROLL_KEY = `va-scroll:${location.pathname}`;
addEventListener('pagehide', () => { try { sessionStorage.setItem(SCROLL_KEY, String(Math.round(scrollY))); } catch (e) { /* storage blocked */ } });
export function savedScroll() {
  const nav = performance.getEntriesByType?.('navigation')[0];
  if (nav?.type !== 'back_forward') return null;
  try { const y = sessionStorage.getItem(SCROLL_KEY); return y === null ? null : Number(y); } catch (e) { return null; }
}
export function restoreScroll(lenis) {
  const y = savedScroll();
  if (y === null) return;
  const go = () => requestAnimationFrame(() => {
    if (Math.abs(scrollY - y) < 2) return;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
  });
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
}

// Pages open at once: where the browser has speculation rules (in each page's
// head), it prerenders the case study on hover. Elsewhere, hovering or touching
// a link to another page of the site fetches that page into the cache.
export function prefetchOnHover() {
  if (HTMLScriptElement.supports?.('speculationrules')) return;
  const done = new Set([location.pathname]);
  const go = (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a || a.origin !== location.origin || a.hash && a.pathname === location.pathname || done.has(a.pathname)) return;
    done.add(a.pathname);
    fetch(a.href, { credentials: 'same-origin', priority: 'low' }).catch(() => done.delete(a.pathname));
  };
  addEventListener('pointerover', go, { passive: true });
  addEventListener('touchstart', go, { passive: true });
  addEventListener('focusin', go);
}

// "Chat with Riya now" links open the Riya panel (js/riya-panel.js, with
// css/riya.css). Both load side by side, after the page's load event: once the
// page is idle, when a link scrolls near the screen, or on the first hover,
// focus or touch of one, whichever comes first, so a click never waits on the
// network. Without JS the link opens the demo site.
export function riyaLinks(lenis) {
  const links = document.querySelectorAll('[data-riya]');
  if (!links.length) return;
  let panel = null;
  const sheet = () => new Promise((done) => {
    const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('../css/riya.css', import.meta.url).href });
    l.onload = l.onerror = done;
    document.head.append(l);
  });
  const load = () => (panel ||= Promise.all([import('./riya-panel.js'), sheet()]).then(([m]) => m, (e) => { panel = null; throw e; }));
  const preload = () => load().catch(() => {});
  links.forEach((a) => {
    ['pointerenter', 'focus', 'touchstart'].forEach((t) => a.addEventListener(t, preload, { once: true, passive: true }));
    a.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button > 0) return;
      e.preventDefault();
      load().then((m) => m.openRiya(a, { lenis }), () => location.assign(a.href));
    });
  });
  const later = () => {
    if (window.requestIdleCallback) requestIdleCallback(preload, { timeout: 3000 }); else setTimeout(preload, 1500);
    // Near the screen: 600 px ahead. The first report is where the links start
    // (the hero's is on screen), so only a link scrolled in later counts.
    let first = true;
    const near = new IntersectionObserver((es) => {
      if (!first && es.some((e) => e.isIntersecting)) { near.disconnect(); preload(); }
      first = false;
    }, { rootMargin: '600px 0px' });
    links.forEach((a) => near.observe(a));
  };
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
}

export function setupMotion({ offset = 0 } = {}) {
  const { gsap, Lenis } = window;
  const motion = !reduced && !!gsap;
  let lenis = null;
  if (motion) {
    gsap.registerEase('house', house);
    gsap.defaults({ ease: 'house' });
    if (Lenis && !touch) {
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      // Back from the in-memory cache: the page height may have changed meanwhile.
      addEventListener('pageshow', (e) => { if (e.persisted) lenis.resize(); });
    }
  }

  // In-page links: a 1.4 s ease-out-quart glide (or a jump without motion).
  // Anything that changes the page's height lazily (the pin) can ask to be
  // set up first, so the glide lands where it should.
  const easeOutQuart = (t) => 1 - (1 - t) ** 4;
  const before = [];
  function goTo(target, opts = {}) {
    if (!target) return;
    // A hook may return a promise.
    const waits = before.splice(0).map((fn) => fn()).filter(Boolean);
    if (waits.length) { Promise.all(waits).then(() => glide(target, opts), () => glide(target, opts)); return; }
    glide(target, opts);
  }
  function glide(target, { immediate = false, extra = 0 } = {}) {
    if (lenis) lenis.scrollTo(target, { offset: offset + extra, duration: 1.4, easing: easeOutQuart, immediate });
    else {
      const y = target.getBoundingClientRect().top + scrollY + offset + extra;
      scrollTo({ top: y, behavior: reduced || immediate ? 'auto' : 'smooth' });
    }
    if (target !== document.body && !target.matches('a, button, input, textarea, select, summary, [tabindex]')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus?.({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.closest('[data-menu]') || a.hasAttribute('data-how-tab') || e.defaultPrevented) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    goTo(target);
  });

  const beforeGoTo = (fn) => before.push(fn);
  return { gsap: motion ? gsap : null, lenis, motion, reduced, goTo, beforeGoTo };
}
