// Case study page script. The page reads, links work and the video shows its
// poster without it.
//   Reveals   [data-case-reveal] fade up 28 px: opacity 0.9 s, transform 1.1 s,
//             house curve, once, when the element reaches 92% of the viewport
//             (IntersectionObserver).
//             Images start at 40% opacity, never fainter, so no frame looks empty.
//   Tabs      the tab of the section under the reading line is filled; a tab
//             glides to its section (the nav bar and tabs are allowed for).
//   Video     plays only while on screen; never by itself under reduced motion
//             (poster); the Pause / Play button works with mouse, touch and keys.
//   Step 03   Asha's row writes itself into the enquiry list, once, in view.
import { setupMotion, restoreScroll, prefetchOnHover } from './core.js';
import { initClock } from './clock.js';
import { initNav } from './nav.js';
import { initReveals } from './reveal.js';
import { initTiles, playEnquiry } from './tiles.js';
import { initPlugins } from './plugin.js';
import { initCursor } from './cursor.js';
import { whenSeen } from './scroll.js';

window.__vaStarted = true;
// gsap and Lenis load beside this module (the loader at the end of the page).
await window.__vaLibs;
const root = document.documentElement;
const { gsap, lenis, motion, reduced, goTo } = setupMotion({ offset: -130 });

initClock();
initNav({ gsap, lenis, goTo });
initTiles();
initPlugins();
prefetchOnHover();
restoreScroll(lenis);

/* ---------- Tabs ---------- */
const tabs = [...document.querySelectorAll('[data-tab]')];
const sections = tabs.map((t) => document.querySelector(t.getAttribute('href')));
function setTab(i) {
  tabs.forEach((t, n) => t.setAttribute('aria-current', String(n === i)));
  // Keep the live tab in view when the bar scrolls sideways (phones).
  const t = tabs[i];
  const bar = t?.closest('.tabs__list');
  if (bar && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: t.offsetLeft - (bar.clientWidth - t.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
}
setTab(0);
const pick = () => {
  const line = innerHeight * 0.4;
  let i = 0;
  sections.forEach((s, n) => { if (s && s.getBoundingClientRect().top <= line) i = n; });
  if (tabs[i]?.getAttribute('aria-current') !== 'true') setTab(i);
};
if (lenis) lenis.on('scroll', pick);
addEventListener('scroll', pick, { passive: true });

/* ---------- Video: only while visible; a Pause / Play button always works ---------- */
const video = document.querySelector('[data-case-video]');
const playBtn = document.querySelector('[data-case-play]');
if (video && playBtn) {
  let userPaused = reduced;   // reduced motion: poster until Play is pressed
  let onScreen = false;
  const sync = () => { playBtn.textContent = video.paused ? 'Play' : 'Pause'; playBtn.setAttribute('aria-label', `${video.paused ? 'Play' : 'Pause'} the screen recording`); };
  const run = () => { if (onScreen && !userPaused) { video.preload = 'auto'; video.play().catch(() => {}); } else video.pause(); };
  playBtn.hidden = false;
  playBtn.addEventListener('click', () => { userPaused = !video.paused; if (userPaused) video.pause(); else { onScreen = true; userPaused = false; run(); } });
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  sync();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { onScreen = entries.some((e) => e.isIntersecting); run(); }, { threshold: 0.25 }).observe(video);
  }
}

/* ---------- Motion ---------- */
if (!motion) {
  root.classList.add('reveal-done');
} else {
  root.classList.add('motion');
  initCursor({ gsap });
  initReveals({ gsap });
  gsap.set('[data-case-reveal]', { opacity: (i, el) => (el.matches('figure') ? 0.4 : 0), y: 28 });
  root.classList.add('reveal-done');
  whenSeen(document.querySelectorAll('[data-case-reveal]'), (el) => {
    gsap.to(el, { opacity: 1, duration: 0.9, ease: 'house', overwrite: 'auto' });
    gsap.to(el, { y: 0, duration: 1.1, ease: 'house', overwrite: 'auto' });
  }, '0px 0px -8% 0px');
  const wrap = document.querySelector('[data-enquiry]');
  if (wrap) whenSeen(wrap, () => playEnquiry(wrap, { gsap, delay: 0.5 }), '0px 0px -25% 0px');
}
