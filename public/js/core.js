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

// ScrollTrigger is only needed for the desktop pin, so it loads on demand
// (evaluating it at start-up forced a full-page layout on every phone).
let stLoad = null;
export function loadScrollTrigger() {
  if (!stLoad) {
    stLoad = new Promise((done, fail) => {
      if (window.ScrollTrigger) { done(); return; }
      const s = document.createElement('script');
      s.src = new URL('./vendor/ScrollTrigger.min.js', import.meta.url).href;
      s.onload = done;
      s.onerror = fail;
      document.head.appendChild(s);
    }).then(() => {
      const { gsap, ScrollTrigger } = window;
      gsap.registerPlugin(ScrollTrigger);
      // Pinned sections must not jump when a phone's address bar moves.
      ScrollTrigger.config({ ignoreMobileResize: true });
      return ScrollTrigger;
    });
  }
  return stLoad;
}

export function setupMotion({ offset = 0 } = {}) {
  const { gsap, Lenis } = window;
  const motion = !reduced && !!gsap;
  let lenis = null;
  if (motion) {
    gsap.registerEase('house', house);
    gsap.defaults({ ease: 'house' });
    if (Lenis) {
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
      lenis.on('scroll', () => window.ScrollTrigger?.update());
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  // In-page links: a 1.4 s ease-out-quart glide (or a jump without motion).
  // Anything that changes the page's height lazily (the pin) can ask to be
  // set up first, so the glide lands where it should.
  const easeOutQuart = (t) => 1 - (1 - t) ** 4;
  const before = [];
  function goTo(target, opts = {}) {
    if (!target) return;
    // A hook may return a promise (the pin loads ScrollTrigger first).
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
