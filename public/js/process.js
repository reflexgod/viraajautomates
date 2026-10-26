// Scroll-linked rows: the service rows and the five process steps.
// Each row's top hairline draws from the left between 90% and 55% of the
// viewport; its text comes up from 40% (never fainter, so nothing looks
// missing) to full opacity between 90% and 50%. The process step at the
// reading line (55%) gets a short hairline under its title. Without motion
// the rows are simply all there (CSS defaults are 1).
import { onScroll } from './scroll.js';

const clamp = (v) => Math.min(1, Math.max(0, v));

export function initProcess() {
  const rows = [...document.querySelectorAll('[data-step], [data-row]')];
  if (!rows.length) return;
  const last = rows.map(() => ({ draw: -1, lift: -1, on: null }));
  onScroll(() => {
    const vh = innerHeight;
    const boxes = rows.map((r) => r.getBoundingClientRect());
    rows.forEach((row, i) => {
      const top = boxes[i].top / vh;
      const draw = Math.round(clamp((0.9 - top) / 0.35) * 1000) / 1000;
      const lift = Math.round(clamp((0.9 - top) / 0.4) * 1000) / 1000;
      const was = last[i];
      // Plain properties on the row and its children, never an inherited custom
      // property: that restyled every row's whole subtree on each scroll frame.
      if (draw !== was.draw) { row.style.backgroundSize = `${draw * 100}% 1px`; was.draw = draw; }
      if (lift !== was.lift) {
        const o = String(0.4 + 0.6 * lift);
        for (const c of row.children) c.style.opacity = o;
        was.lift = lift;
      }
      if (row.matches('[data-step]')) {
        const on = boxes[i].top < vh * 0.55 && boxes[i].bottom > vh * 0.55;
        if (on !== was.on) { row.classList.toggle('is-active', on); was.on = on; }
      }
    });
  });
}
