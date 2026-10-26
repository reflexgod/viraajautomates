// The About portrait: "Viraaj" in the About line shows his photo.
// From 1024 px it appears in the empty left column under "( About )", never
// over the text, and ends above the next section's label. Narrower, that column is gone: it opens above the name
// (below it when there is no room), inside the screen and under the nav bar.
// Mouse: hover shows it, a click opens it large. Keyboard: focus shows it.
// Touch: a tap shows or hides it; a tap elsewhere or a scroll hides it.
// The photo loads the first time it is asked for, never on page load. The
// fade is a CSS transition, so reduced motion turns it off.
import { openLightbox } from './lightbox.js';

const PHOTO = {
  src: 'images/viraaj-480.webp',
  srcset: 'images/viraaj-480.webp 480w, images/viraaj-960.webp 960w',
  full: 'images/viraaj-960.webp',
  fallback: 'images/viraaj.jpg',
  alt: 'Viraaj, who builds and looks after every system himself.',
  caption: 'Viraaj, Mumbai',
};

export function initPortrait() {
  const word = document.querySelector('.pw[data-preview="viraaj"]');
  const fig = document.querySelector('[data-portrait]');
  if (!word || !fig) return;
  const slot = fig.querySelector('[data-portrait-slot]');
  const nav = document.querySelector('[data-nav]');
  const wide = matchMedia('(min-width: 1024px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let open = false;
  let hideTimer = 0;

  function load() {
    if (slot.firstChild) return;
    slot.innerHTML = `<img src="${PHOTO.src}" srcset="${PHOTO.srcset}" sizes="240px" width="480" height="600" alt="" decoding="async">`;
  }

  // Narrow screens: above the name, under the nav bar, inside the screen; it
  // shrinks (to 160 px wide at least, 4:5) to fit the space above the name, and
  // only goes below the name when even that does not fit.
  function place() {
    if (wide.matches) {
      // The left column: as wide as it allows (240 px at most), and short
      // enough to end 24 px above the next section's label.
      ['--x', '--y', '--w'].forEach((p) => fig.style.removeProperty(p));
      const next = document.querySelector('#about + section .rail');
      if (next) {
        const room = next.getBoundingClientRect().top - fig.getBoundingClientRect().top - 24;
        if (room * 0.8 < fig.offsetWidth) fig.style.setProperty('--w', `${Math.max(120, Math.floor(room * 0.8))}px`);
      }
      return;
    }
    const r = word.querySelector('.pw__word').getBoundingClientRect();
    const top = Math.max(0, nav?.getBoundingClientRect().bottom || 0) + 12;
    const room = r.top - 12 - top;                       // height free above the name
    let w = Math.min(240, innerWidth - 24, Math.floor((room * 4) / 5));
    let y;
    if (w >= 160) y = r.top - 12 - (w * 5) / 4;
    else { w = Math.min(240, innerWidth - 24); y = Math.min(r.bottom + 12, innerHeight - (w * 5) / 4 - 12); }
    const x = Math.min(Math.max(12, r.left), innerWidth - w - 12);
    fig.style.setProperty('--w', `${w}px`);
    fig.style.setProperty('--x', `${Math.round(x)}px`);
    fig.style.setProperty('--y', `${Math.round(Math.max(top, y))}px`);
  }

  function show() {
    clearTimeout(hideTimer);
    load();
    open = true;
    place();
    fig.classList.add('is-shown');
    word.classList.add('is-active');
  }
  function hide(delay = 0) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      open = false;
      fig.classList.remove('is-shown');
      word.classList.remove('is-active');
    }, delay);
  }

  if (fine) {
    word.addEventListener('pointerenter', show);
    word.addEventListener('pointerleave', () => hide(80));
  }
  word.addEventListener('focus', () => { if (word.matches(':focus-visible')) show(); });
  word.addEventListener('blur', () => hide(60));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });

  word.addEventListener('click', (e) => {
    // A mouse click opens the photo large; a tap (or Enter) shows or hides it.
    if (fine && e.pointerType === 'mouse') { hide(); openLightbox({ src: PHOTO.full, fallback: PHOTO.fallback, alt: PHOTO.alt, caption: PHOTO.caption }); return; }
    if (open) hide(); else show();
  });
  document.addEventListener('pointerdown', (e) => { if (open && !fine && !word.contains(e.target)) hide(); });
  // Narrow screens: it is placed against the name, so a scroll closes it.
  addEventListener('scroll', () => { if (open && !wide.matches) hide(); }, { passive: true });
  addEventListener('resize', () => { if (open) place(); });
  wide.addEventListener('change', () => { if (open) place(); });
}
