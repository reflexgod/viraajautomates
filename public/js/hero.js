// Hero: the entrance, the exit on scroll, and the cable loader.
import { onScroll } from './scroll.js';

// Entrance: the copy rises in CSS (base.css), so it never waits for scripts;
// with the intro it waits for the split. The cord drops in under its own physics.
export function heroEntrance({ cable, ready }) {
  ready.then(() => cable.enter());
}

// Exit: from the hero's top at the top of the viewport until its bottom
// reaches 20% of it, the cord lifts up and out; the copy fades 1.8x faster.
export function heroExit({ cable }) {
  const hero = document.querySelector('[data-hero]');
  const copy = [...hero.querySelectorAll('[data-hero-copy], .hero__strip')];
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let last = 0;
  const update = () => {
    const r = hero.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight * 0.2)));
    if (p === last) return;
    last = p;
    cable.exit(smooth(0.05, 0.95, p));
    // While the Plug-in chat is open (a phone scrolls it into view), the copy stays put.
    const o = hero.querySelector('.plugin.is-open') ? 1 : 1 - Math.min(1, p * 1.8);
    copy.forEach((el) => { el.style.opacity = o; el.style.transform = o < 1 ? `translateY(${-40 * (1 - o)}px)` : ''; });
  };
  onScroll(update);
  hero.addEventListener('plugin-toggle', () => { last = -1; update(); });
}

// A cheap check only: creating a test WebGL context cost ~60 ms of main
// thread at start-up. If the real context fails later, the still stays.
const supportsWebGL = () => 'WebGLRenderingContext' in window;

// Quality tier: phones and low-core machines get cheaper shadows and a
// pixel ratio capped at 1.5. ?tier=high or ?tier=low forces one (for testing).
export function pickTier() {
  const forced = new URLSearchParams(location.search).get('tier');
  const coarse = matchMedia('(hover: none)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const high = forced ? forced === 'high' : !coarse && cores >= 4;
  return high
    ? { name: 'high', dpr: 1.75, realShadows: true, shadowMap: 2048 }
    : { name: 'low', dpr: 1.5, realShadows: false };
}

// The live cord only where it will run well. A device that averaged under
// 24 fps keeps the still image for 7 days, then tries again. ?tier=... always tries.
const OFF_KEY = 'va-cord-off';
const OFF_DAYS = 7;
function cordBlocked() {
  if (new URLSearchParams(location.search).has('tier')) return '';
  try {
    const off = JSON.parse(localStorage.getItem(OFF_KEY) || 'null');
    if (off && Date.now() - off.at < OFF_DAYS * 864e5) return `averaged ${off.fps} fps`;
    localStorage.removeItem(OFF_KEY); // expired, or an old flag without a date
  } catch (e) { try { localStorage.removeItem(OFF_KEY); } catch (err) { /* storage blocked */ } }
  // Most phones report 4 GB; only the smallest devices get the still image.
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return `device memory ${navigator.deviceMemory} GB`;
  if (navigator.connection?.saveData) return 'Save-Data is on';
  return '';
}

// First visit (with the intro): the still image of the cord shows from the
// intro's split; the live cord loads once the intro is over, the visitor has
// moved, touched, scrolled or pressed a key (or 5 s have passed), and the page
// is idle (requestIdleCallback, 1.5 s at most). It starts at rest and fades in
// over the still, so nothing jumps. Its first shader compile is the heaviest
// task on the page (~0.6 s on a software GPU), so it never lands in the first
// seconds of a load.
// Repeat visit (no intro): the live cord loads when the page is idle and the
// hero is on screen, and drops in; the still waits hidden unless it fails.
// Returns a small handle so the entrance and the exit can steer the cord.
export function startCable({ split = null, done = null } = {}) {
  const hero = document.querySelector('[data-hero]');
  const wide = matchMedia('(min-width: 1024px)');
  const still = hero.querySelector('.hero__still');
  const report = new URLSearchParams(location.search).has('fps');
  const state = { enter: 1, exit: 0, entering: false, live: null, off: false };
  const showStill = () => { if (!state.live) hero.classList.add('show-still'); };
  if (!document.documentElement.classList.contains('cable-wait')) hero.classList.add('show-still');
  const push = () => state.live?.setLift(Math.max(state.enter, state.exit));
  const note = (text) => {
    if (!report) return;
    let el = hero.querySelector('.cable-note');
    if (!el) { el = document.createElement('div'); el.className = 'cable-fps cable-note'; hero.appendChild(el); }
    el.textContent = text;
  };

  const blocked = cordBlocked();
  if (blocked || !supportsWebGL() || !('Worker' in window)) {
    state.off = true;
    note(`still image: ${blocked || 'no WebGL'}`);
    showStill();
    return handle();
  }
  const fallback = setTimeout(showStill, 4000);
  let token = 0;

  // Fall back (for OFF_DAYS) if 3 seconds average under 24 fps, measured after the
  // first second, which holds the shader compile and the entrance.
  function watchFrames() {
    let frames = 0;
    const t0 = performance.now() + 1000;
    const tick = (now) => {
      if (!state.live) return;
      if (now >= t0) frames++;
      if (now - t0 < 3000) { requestAnimationFrame(tick); return; }
      const fps = Math.round((frames * 1000) / (now - t0));
      if (fps >= 24) { note(`${fps} fps · live`); return; }
      try { localStorage.setItem(OFF_KEY, JSON.stringify({ fps, at: Date.now() })); } catch (e) {}
      note(`still image: averaged ${fps} fps`);
      state.live.destroy();
      state.live = null;
      state.off = true;
      hero.classList.remove('is-live');
      showStill();
    };
    requestAnimationFrame(tick);
  }

  async function mount() {
    const mine = ++token;
    state.live?.destroy();
    state.live = null;
    try {
      const { createCable } = await import('./cable/cable.js');
      const next = await createCable(hero, { frame: wide.matches ? 'wide' : 'tall', tier: pickTier(), lift: Math.max(state.enter, state.exit) });
      if (mine !== token) { next.destroy(); return; }
      state.live = next;
      clearTimeout(fallback);
      hero.classList.remove('show-still');
      push();
      if (state.entering) dropIn();
      watchFrames();
    } catch (err) {
      console.warn('[cable] WebGL cable unavailable; the still image stays.', err);
      showStill();
    }
  }

  // The cord falls from above its rest pose and settles (about 3 s).
  function dropIn() {
    if (!state.live || !window.gsap || state.enter === 0) return;
    window.gsap.to(state, { enter: 0, duration: 3, delay: 0.2, ease: 'power2.inOut', onUpdate: push });
  }

  function handle() {
    return {
      enter() { state.entering = true; dropIn(); },
      exit(v) {
        state.exit = v;
        push();
        // The still (no WebGL) leaves the same way.
        if (!state.live) still.style.transform = v ? `translateY(${-v * 70}%)` : '';
      },
      // The Plug-in button: swing the plug to its socket (or let go), brighten its lamp.
      // live() is false until the cord is drawn live and its plug is on screen.
      live: () => !!state.live && state.exit === 0 && state.live.plugInView(),
      reach: (sock, opts) => state.live?.reach(sock, opts),
      glow: (v) => state.live?.glow(v),
    };
  }

  if (done) {
    split.then(() => hero.classList.add('show-still'));
    const idle = () => new Promise((res) => ('requestIdleCallback' in window ? requestIdleCallback(res, { timeout: 1500 }) : setTimeout(res, 1500)));
    const stirred = () => new Promise((res) => {
      const evs = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'];
      const go = () => { evs.forEach((t) => removeEventListener(t, go, true)); clearTimeout(timer); res(); };
      evs.forEach((t) => addEventListener(t, go, { capture: true, passive: true, once: true }));
      const timer = setTimeout(go, 5000);
    });
    done.then(stirred).then(idle).then(() => { state.enter = 0; mount(); });
  } else {
    // Otherwise: once the page is idle and the hero is on screen.
    const idle = () => new Promise((res) => ('requestIdleCallback' in window ? requestIdleCallback(res, { timeout: 1200 }) : setTimeout(res, 300)));
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((res) => addEventListener('load', res, { once: true }));
    const onScreen = new Promise((res) => {
      const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); res(); } });
      io.observe(hero);
    });
    Promise.all([loaded, onScreen]).then(idle).then(mount);
  }
  wide.addEventListener('change', () => { if (state.off) return; state.enter = 0; mount(); });
  still.decode?.().catch(() => {});
  return handle();
}
