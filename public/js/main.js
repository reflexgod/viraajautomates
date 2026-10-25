// Viraaj Automates: home page script.
// Everything here is an enhancement: the page reads and every link works without it.
import { setupMotion, loadScrollTrigger } from './core.js';
import { initClock } from './clock.js';
import { initNav } from './nav.js';
import { heroEntrance, heroExit, startCable } from './hero.js';
import { initReveals } from './reveal.js';
import { initPreviews } from './preview.js';
import { initHow } from './how.js';
import { initTiles } from './tiles.js';
import { initMessages } from './message.js';
import { initCompose } from './compose.js';
import { initProcess } from './process.js';
import { initCursor } from './cursor.js';
import { whenSeen } from './scroll.js';

window.__vaStarted = true;
const root = document.documentElement;
const { gsap, lenis, motion, goTo, beforeGoTo } = setupMotion();

// The intro (if it is playing) hands over when its panel splits, and is done a second later.
const introOn = root.classList.contains('intro-on');
const introSplit = new Promise((done) => {
  if (!introOn || root.classList.contains('intro-split')) done();
  else addEventListener('va:intro-split', done, { once: true });
});
const introDone = new Promise((done) => {
  if (!introOn || !document.querySelector('[data-intro]')) done();
  else addEventListener('va:intro-done', done, { once: true });
});

initClock();
initNav({ gsap, lenis, goTo });
initPreviews({ gsap, lenis });
initTiles();
initMessages();
initCompose();

if (!motion) {
  root.classList.add('reveal-done');
} else {
  root.classList.add('motion');
  const cable = startCable(introOn ? { split: introSplit, done: introDone } : {});
  heroEntrance({ cable, ready: introSplit });
  heroExit({ cable });
  initCursor({ gsap });
  // Reveals and rows use IntersectionObservers and one scroll loop: cheap, so at once.
  initReveals({ gsap });
  initProcess();
  // The one ScrollTrigger (the "How it works" pin) is set up when the section
  // comes within a screen of the viewport, before any in-page jump, or at once
  // if the page opens below the hero. Its first measure is the costliest task
  // on the page, so it stays out of the first seconds.
  let howReady = null;
  const setupHow = () => {
    if (!howReady) {
      howReady = Promise.resolve(initHow({ gsap, loadScrollTrigger, lenis }));
      // Fonts change line lengths; measure again if they arrive later.
      if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => window.ScrollTrigger?.refresh());
    }
    return howReady;
  };
  beforeGoTo(setupHow);
  if (scrollY > innerHeight) setupHow();
  else whenSeen(document.querySelector('[data-how]'), setupHow, '0px 0px 100% 0px');
}
