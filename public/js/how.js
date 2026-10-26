// "How it works": one enquiry in four steps.
//
// From 1024 px the board (steps and stage, not the heading or the buttons) pins for 110% of the
// viewport. The pin is CSS position: sticky (styles/sections.css), so the
// browser holds it on its compositor: it never jumps on iOS Safari or Android
// Chrome, and nothing has to be measured when the page above changes height. Scroll progress picks the step: steps 01-03 get a third of the
// pin each and step 04 goes live just before the end, so the pin lets go as
// soon as the story is told (no empty screen before the buttons). A plum
// signal runs down the cream cable beside the steps and arrives at a step's
// jack exactly as that step goes live (the jack fills, one pulse). Clicking a
// step glides to its part of the pin.
// Below 1024 px there is no pin: four tabs over one stage of fixed height;
// tap a tab or swipe the stage. The signal slides to the live tab.
// Each change: the new panel wipes up (clip-path, 0.55 s, house curve) while
// the old one fades; the panel's lines rise 16 px, 0.06 s apart.
// Inactive panels are inert, so Tab never lands inside a hidden one.
// Reduced motion or no JS: nothing here runs; the CSS shows the steps stacked.
import { playEnquiry } from './tiles.js';
import { onScroll } from './scroll.js';

export function initHow({ gsap, lenis }) {
  const how = document.querySelector('[data-how]');
  if (!how || !gsap) return;
  const board = how.querySelector('[data-how-board]');
  const items = [...how.querySelectorAll('[data-how-item]')];
  const tabs = items.map((it) => it.querySelector('[data-how-tab]'));
  const panels = items.map((it) => it.querySelector('[data-how-panel]'));
  const wire = how.querySelector('.how__wire');
  const signal = how.querySelector('[data-how-signal]');
  const wide = matchMedia('(min-width: 1024px)');
  let active = -1;
  let pinned = false;
  let pinLen = 0;   // how far the board stays pinned, in px
  let pinW = 0;     // the width pinLen was measured at
  let jacks = [];   // jack centres along the wire, in px

  how.classList.add('is-live');

  function setActive(i, { animate = true } = {}) {
    if (i === active) return;
    const prev = active;
    active = i;
    items.forEach((it, n) => {
      it.classList.toggle('is-active', n === i);
      panels[n].inert = n !== i;
      panels[n].setAttribute('aria-hidden', String(n !== i));
      if (n === i) tabs[n].setAttribute('aria-current', 'step'); else tabs[n].removeAttribute('aria-current');
    });
    // The live step shows its paragraph, so the jacks below it move: measure again.
    measure();
    if (!wide.matches) moveSignal(i);
    const panel = panels[i];
    if (animate && prev !== -1) {
      gsap.fromTo(panel, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, ease: 'house', clearProps: 'clipPath' });
      gsap.fromTo(panel.querySelectorAll('[data-how-rise]'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, delay: 0.08, ease: 'house', clearProps: 'transform,opacity' });
    }
    // Step 03: Asha's row writes itself into the enquiry list.
    if (i === 2) playEnquiry(panel.querySelector('[data-enquiry]'), { gsap, delay: animate ? 0.35 : 0.1 });
  }

  /* ---------- The cable and its signal ---------- */
  function measure() {
    const w = wire.getBoundingClientRect();
    jacks = tabs.map((t) => {
      const j = t.querySelector('.how__jack').getBoundingClientRect();
      return wide.matches ? j.top + j.height / 2 - w.top : j.left + j.width / 2 - w.left;
    });
    if (wide.matches) {
      wire.style.setProperty('--wire-a', `${jacks[0]}px`);
      wire.style.setProperty('--wire-b', `${w.height - jacks[3]}px`);
    } else {
      wire.style.setProperty('--wire-a', `${jacks[0]}px`);
      wire.style.setProperty('--wire-b', `${w.width - jacks[3]}px`);
    }
  }
  function moveSignal(i) {
    if (!jacks.length) return;
    signal.style.transform = wide.matches ? `translateY(${jacks[i]}px)` : `translateX(${jacks[i]}px)`;
  }
  // Pinned: in each step's part the signal rests on the live jack for the
  // first half, then travels to the next one, arriving as that step goes live.
  // SPAN parts of the pin: step 04 goes live at 3 / SPAN (about 91%).
  const SPAN = 3.3;
  window.__howSpan = SPAN;   // read by scripts/check-how.mjs
  const ease = gsap.parseEase('house');
  function scrub(p) {
    const q = Math.min(3.999, Math.max(0, p * SPAN));
    const k = Math.floor(q);
    const t = q - k;
    setActive(k);
    const travel = k < 3 && t > 0.5 ? ease((t - 0.5) / 0.5) : 0;
    const y = jacks[k] + (k < 3 ? (jacks[k + 1] - jacks[k]) * travel : 0);
    signal.style.transform = `translateY(${y}px)`;
  }

  /* ---------- Desktop pin / mobile tabs ---------- */
  // The board sticks when its top reaches 24 px under the nav bar (never higher
  // than 120 px from the top), so the nav never covers it and the heading above
  // has already scrolled past. Only the board pins; the space after it (the
  // .how__pin wrapper's ::after) holds the buttons back while it does.
  const nav = document.querySelector('[data-nav]');
  const wrap = how.querySelector('[data-how-pin]');
  let top = 120;    // where the board sticks, px from the top of the viewport
  // Where the pin starts and ends, in page pixels (read by scripts/check-how.mjs).
  const range = () => {
    const start = Math.round(wrap.getBoundingClientRect().top + scrollY - top);
    return [start, start + pinLen];
  };
  window.__howPin = () => (pinned ? range() : null);
  function setPin() {
    // A phone or tablet's toolbar changes the height while scrolling: only a
    // new width measures the pin's length again, so it never jumps.
    if (!pinLen || innerWidth !== pinW) { pinLen = Math.round(innerHeight * 1.1); pinW = innerWidth; }
    top = Math.max(120, Math.round((nav?.getBoundingClientRect().bottom || 0) + 24));
    how.style.setProperty('--how-pin-top', `${top}px`);
    how.style.setProperty('--how-pin-len', `${pinLen}px`);
  }
  function build() {
    pinned = wide.matches;
    how.classList.toggle('is-pinned', pinned);
    if (pinned) setPin();
    measure();
    if (pinned) { follow(); return; }
    signal.style.transform = '';
    moveSignal(Math.max(0, active));
  }
  function follow() {
    if (!pinned) return;
    const p = (top - wrap.getBoundingClientRect().top) / Math.max(1, pinLen);
    scrub(Math.min(1, Math.max(0, p)));
  }
  onScroll(follow);
  // The board's own size changes (a step's paragraph, fonts): the jacks move.
  new ResizeObserver(() => { measure(); follow(); }).observe(board);
  lenis?.resize?.();

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      if (pinned) {
        // Early in step i's part, where the signal rests on its jack.
        const [start, end] = range();
        const y = start + (end - start) * Math.min(1, (i + 0.25) / SPAN);
        if (lenis) lenis.scrollTo(y, { duration: 0.9, easing: (t) => 1 - (1 - t) ** 4 }); else scrollTo({ top: y, behavior: 'smooth' });
      } else {
        setActive(i);
      }
    });
  });

  // Swipe the stage (below 1024 px): left for the next step, right for the previous.
  let sx = 0, sy = 0, swiping = false;
  board.addEventListener('touchstart', (e) => {
    if (wide.matches || !e.target.closest('[data-how-panel]')) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true;
  }, { passive: true });
  board.addEventListener('touchend', (e) => {
    if (!swiping) return;
    swiping = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    setActive(Math.min(3, Math.max(0, active + (dx < 0 ? 1 : -1))));
  }, { passive: true });
  // Arrow keys move between the tabs when one has focus.
  tabs.forEach((tab, i) => tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const n = Math.min(3, Math.max(0, i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1)));
    tabs[n].focus();
    tabs[n].click();
  }));

  setActive(0, { animate: false });
  build();
  wide.addEventListener('change', build);
  addEventListener('resize', () => {
    if (pinned) { setPin(); follow(); } else { measure(); moveSignal(active); }
  });
}
