// Custom cursor, fine pointers only: a 6 px dot (0.08 s follow) and a 34 px
// ring (0.45 s), blended with difference. Over links the ring grows to 56 px;
// over anything with [data-cursor] it becomes an 84 px black disc with a word
// (VIEW, CHAT, EMAIL, GRAB, PULL). Press squeezes it, release springs back.

export function initCursor({ gsap }) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.querySelector('[data-cursor-root]');
  if (!root) return;
  const dot = root.querySelector('[data-cursor-dot]');
  const ring = root.querySelector('[data-cursor-ring]');
  const label = root.querySelector('[data-cursor-label]');
  document.documentElement.classList.add('has-cursor');
  root.classList.add('is-hidden');

  const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3.out' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3.out' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });

  let shown = false;
  let lastWord = '';
  let px = 0, py = 0;

  function state(target) {
    const tagged = target.closest?.('[data-cursor]');
    const word = tagged && tagged.matches(':not([disabled])') ? tagged.dataset.cursor : '';
    if (word !== lastWord) {
      if (word) label.textContent = word;
      lastWord = word;
    }
    root.classList.toggle('is-label', !!word);
    root.classList.toggle('is-link', !word && !!target.closest?.('a[href], button, summary, label, [role="button"]'));
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!shown) {
      gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
      root.classList.remove('is-hidden');
      shown = true;
    }
    px = e.clientX; py = e.clientY;
    dx(e.clientX); dy(e.clientY);
    rx(e.clientX); ry(e.clientY);
    state(e.target);
  }, { passive: true });

  // Content moves under a still pointer while scrolling: look again once per frame.
  let queued = false;
  window.addEventListener('scroll', () => {
    if (!shown || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; const el = document.elementFromPoint(px, py); if (el) state(el); });
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', () => { root.classList.add('is-hidden'); shown = false; });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') gsap.to(ring, { scale: 0.85, duration: 0.15, ease: 'power3.out' }); });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') return;
    gsap.to(ring, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    state(e.target);
  });
}
