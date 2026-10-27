// Viraaj Automates: home page script.
// Everything here is an enhancement: the page reads and every link works without it.
import { setupMotion, savedScroll, restoreScroll, prefetchOnHover, riyaLinks } from './core.js';
import { initClock } from './clock.js';
import { initNav } from './nav.js';
import { heroExit, startCable } from './hero.js';
import { initReveals } from './reveal.js';
import { initPreviews } from './preview.js';
import { initPortrait } from './portrait.js';
import { initHow } from './how.js';
import { initTiles } from './tiles.js';
import { initPlugins } from './plugin.js';
import { initProcess } from './process.js';
import { initCursor } from './cursor.js';
import { whenSeen } from './scroll.js';

window.__vaStarted = true;
// gsap and Lenis load beside this module (the loader at the end of index.html).
await window.__vaLibs;
const root = document.documentElement;
const { gsap, lenis, motion, goTo, beforeGoTo } = setupMotion();

initClock();
initNav({ gsap, lenis, goTo });
initPreviews({ gsap, lenis });
initPortrait();
initTiles();
prefetchOnHover();
riyaLinks(lenis);

if (!motion) {
  root.classList.add('reveal-done');
  // Reduced motion: it stays a plain link; without the animation library: the 2D plug.
  initPlugins();
} else {
  root.classList.add('motion');
  const cable = startCable();
  // The hero's Plug-in button reaches for the live cord; the others use their 2D plug.
  initPlugins({ cable, lenis });
  heroExit({ cable });
  initCursor({ gsap });
  // Reveals and rows use IntersectionObservers and one scroll loop: cheap, so at once.
  initReveals({ gsap });
  initProcess();
  // "How it works" (tabs, or the sticky pin from 1024 px) sets itself up when
  // the main thread is first idle, when the section comes within a screen, or
  // before any in-page jump; at once if the page opens below the top (a reload
  // or the back button), so the page is its final height before the browser
  // restores the scroll.
  let howReady = false;
  const setupHow = () => {
    if (howReady) return;
    howReady = true;
    initHow({ gsap, lenis });
  };
  beforeGoTo(setupHow);
  if (scrollY > 0 || savedScroll() !== null) setupHow();
  else {
    whenSeen(document.querySelector('[data-how]'), setupHow, '0px 0px 100% 0px');
    if ('requestIdleCallback' in window) requestIdleCallback(setupHow, { timeout: 3000 });
  }
}
restoreScroll(lenis);
