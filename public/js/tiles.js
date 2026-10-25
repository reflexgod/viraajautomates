// Screenshot tiles ("Your enquiry list", "Your inbox", "Your appointment diary").
// Click, tap or Enter opens the whole screenshot in the lightbox.
//
// "The enquiry writes itself": Asha's row in the enquiry list starts covered,
// then appears cell by cell (name, phone, problem: the real pixels of the
// screenshot, nothing typed in by code) and a soft plum band sweeps once
// across it, leaving the plum outline. About 1 s. Under reduced motion the
// row is simply there, outlined.
import { openLightbox } from './lightbox.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initTiles() {
  document.querySelectorAll('[data-tile]').forEach((t) => {
    t.addEventListener('click', () => openLightbox({ src: t.dataset.full, fallback: t.dataset.fallback, alt: t.dataset.alt, caption: t.dataset.caption }));
  });
}

// Plays the fill on one [data-enquiry] wrapper. Returns the timeline (or null).
export function playEnquiry(wrap, { gsap, delay = 0 } = {}) {
  if (!wrap || !gsap || reduced) return null;
  const mask = wrap.querySelector('.tile__mask');
  const sweep = wrap.querySelector('.tile__sweep');
  const row = wrap.querySelector('.tile__row');
  const cs = getComputedStyle(wrap);
  // Column edges for this crop (desktop: name | phone | problem; phones: name | problem)
  const cuts = [cs.getPropertyValue('--c1').trim(), cs.getPropertyValue('--c2').trim(), '100%'].filter((v, i, a) => a.indexOf(v) === i);
  gsap.killTweensOf([mask, sweep, row]);
  const tl = gsap.timeline({ delay });
  tl.set(mask, { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' })
    .set(row, { opacity: 0 })
    .set(sweep, { opacity: 0, scaleX: 0 });
  cuts.forEach((c, i) => tl.to(mask, { clipPath: `inset(0% 0% 0% ${c})`, duration: 0.16, ease: 'power2.out' }, 0.12 + i * 0.2));
  const end = 0.12 + cuts.length * 0.2;
  tl.set(mask, { opacity: 0 }, end)
    .to(row, { opacity: 1, duration: 0.3 }, end)
    .to(sweep, { opacity: 1, scaleX: 1, duration: 0.35, ease: 'house' }, end)
    .to(sweep, { opacity: 0, duration: 0.3 }, end + 0.35);
  return tl;
}
