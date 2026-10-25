// Preview words (the About photo): an underlined trigger that shows what it names.
// Fine pointer: one card follows the pointer (24 px below and right), tilts with
// horizontal speed, and the next item's media wipes up through the same card.
// Keyboard: focus shows the card under the trigger; Escape closes it.
// Touch: the first tap places the card above or below the trigger, the second
// opens it large, a tap elsewhere closes it.
// While the page scrolls under a still pointer (Lenis moves it, and :hover does
// not update then), the trigger under the last pointer position is looked up on
// every scroll frame: the card follows it, switches to it, or hides.
// When a [data-sweep] block first reaches 70% of the viewport, its triggers light in turn.
import { openLightbox } from './lightbox.js';
import { whenSeen } from './scroll.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Every item is real: today only the photo of me in the About line.
const ITEMS = {
  viraaj: { kind: 'image', src: 'images/viraaj-480.webp', full: 'images/viraaj-960.webp', fallback: 'images/viraaj.jpg', ratio: '4 / 5', caption: 'Viraaj · Mumbai', alt: 'Viraaj, who builds and looks after every system himself.' },
};

export function initPreviews({ gsap, lenis = null }) {
  const words = [...document.querySelectorAll('.pw')];
  const card = document.querySelector('[data-pcard]');
  const frame = card?.querySelector('[data-pcard-frame]');
  if (!words.length || !card) return;

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const touch = matchMedia('(hover: none)').matches;

  // Card skeleton: a media slot (layers wipe through it) and a caption.
  frame.innerHTML = '<div class="pcard__slot" data-slot></div><p class="pcard__cap" data-cap></p>';
  const slot = frame.querySelector('[data-slot]');
  const cap = frame.querySelector('[data-cap]');

  // One video element, reused, so the clip downloads once and only when first shown.
  let video = null;
  function getVideo(it) {
    if (!video) {
      video = document.createElement('video');
      video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none';
      video.setAttribute('aria-hidden', 'true');
      video.poster = it.src;
      video.innerHTML = `<source src="${it.video}.webm" type="video/webm"><source src="${it.video}.mp4" type="video/mp4">`;
    }
    return video;
  }
  const playVideo = () => { if (video && visible && current === 'websites') video.play().catch(() => {}); };
  const pauseVideo = () => video?.pause();

  function layer(key) {
    const it = ITEMS[key];
    const el = document.createElement('div');
    el.className = 'pcard__layer' + (it.mat ? ' pcard__layer--mat' : '') + (it.left ? ' pcard__layer--left' : '');
    if (it.kind === 'html') {
      el.appendChild(document.querySelector(it.template).content.cloneNode(true));
    } else if (it.kind === 'video' && !reduced) {
      el.appendChild(getVideo(it));
    } else {
      // Reduced motion: the video item shows the clinic page as a still.
      const src = it.kind === 'video' ? it.still : it.src;
      el.innerHTML = `<img src="${src}" alt="" decoding="async">`;
    }
    return el;
  }
  const caption = (key) => {
    const [title, ...rest] = ITEMS[key].caption.split(' · ');
    return `<b>${title}</b><span>${rest.join(' · ')}</span>`;
  };

  let current = null;   // key shown in the card
  let visible = false;
  let hideTimer = 0;

  function setContent(key) {
    if (key === current) return;
    const it = ITEMS[key];
    const next = layer(key);
    slot.style.setProperty('--ratio', it.ratio);
    cap.innerHTML = caption(key);
    if (current && visible && gsap) {
      // The new media wipes up through the same card.
      slot.appendChild(next);
      const old = [...slot.children].slice(0, -1);
      gsap.fromTo(next, { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, ease: 'expo.inOut',
        onComplete: () => old.forEach((o) => o.remove()),
      });
    } else {
      slot.replaceChildren(next);
    }
    current = key;
    if (key === 'websites') playVideo(); else pauseVideo();
  }

  /* ---------- Show / hide ---------- */
  function show() {
    clearTimeout(hideTimer);
    if (visible) return;
    visible = true;
    if (gsap) {
      gsap.killTweensOf(card, 'opacity,scale');
      gsap.set(card, { visibility: 'visible' });
      gsap.fromTo(card, { scale: 0.5 }, { scale: 1, duration: 0.5, ease: 'power3.out' });
      gsap.to(card, { opacity: 1, duration: 0.3, ease: 'power3.out' });
    } else {
      card.style.visibility = 'visible';
      card.style.opacity = 1;
    }
    playVideo();
  }
  function hide(delay = 0) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!visible) return;
      visible = false;
      pauseVideo();
      words.forEach((w) => w.classList.remove('is-active'));
      if (gsap) {
        gsap.to(card, { opacity: 0, scale: 0.85, duration: 0.3, ease: 'power3.out', onComplete: () => { if (!visible) { gsap.set(card, { visibility: 'hidden' }); current = null; } } });
      } else {
        card.style.visibility = 'hidden';
        card.style.opacity = 0;
        current = null;
      }
    }, delay);
  }

  /* ---------- Placement ---------- */
  const W = () => card.offsetWidth;
  const H = () => card.offsetHeight;
  let qx, qy, qr;
  if (gsap) {
    gsap.set(card, { xPercent: 0, yPercent: 0, transformOrigin: '0% 0%' });
    qx = gsap.quickTo(card, 'x', { duration: 0.55, ease: 'power3.out' });
    qy = gsap.quickTo(card, 'y', { duration: 0.55, ease: 'power3.out' });
    qr = gsap.quickTo(card, 'rotation', { duration: 0.5, ease: 'power3.out' });
  }
  function place(x, y, instant) {
    // 24 px below and right of the pointer; flip to stay on screen.
    let px = x + 24, py = y + 24;
    if (px + W() > innerWidth - 12) px = x - 24 - W();
    if (py + H() > innerHeight - 12) py = y - 24 - H();
    if (gsap) {
      if (instant) { gsap.set(card, { x: px, y: py }); qx(px); qy(py); } else { qx(px); qy(py); }
    } else {
      card.style.transform = `translate(${px}px, ${py}px)`;
    }
  }
  // Above or below the trigger (keyboard and touch).
  function placeAt(word) {
    const r = word.querySelector('.pw__word').getBoundingClientRect();
    const below = r.bottom + 16 + H() < innerHeight - 12;
    const x = Math.min(Math.max(12, r.left), innerWidth - W() - 12);
    const y = below ? r.bottom + 16 : r.top - 16 - H();
    if (gsap) { gsap.set(card, { x, y, rotation: 0 }); qx?.(x); qy?.(y); } else card.style.transform = `translate(${x}px, ${y}px)`;
  }

  /* ---------- Fine pointer ---------- */
  if (fine) {
    let lastX = 0, lastT = 0;
    words.forEach((w) => {
      w.addEventListener('pointerenter', (e) => {
        const first = !visible;
        setContent(w.dataset.preview);
        words.forEach((o) => o.classList.toggle('is-active', o === w));
        if (first) place(e.clientX, e.clientY, true);
        show();
      });
      w.addEventListener('pointerleave', () => { w.classList.remove('is-active'); hide(80); });
    });
    let px = -1, py = -1;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX; py = e.clientY;
      if (!visible) return;
      place(e.clientX, e.clientY);
      // Tilt with horizontal speed, up to 8 degrees.
      const now = performance.now();
      const v = (e.clientX - lastX) / Math.max(8, now - lastT);
      lastX = e.clientX; lastT = now;
      qr?.(Math.max(-8, Math.min(8, v * 6)));
    }, { passive: true });
    // The page moved under the pointer: whatever trigger is under it now decides.
    let queued = false;
    const recheck = () => {
      queued = false;
      if (!visible || px < 0) return;
      const focused = words.find((w) => w.matches(':focus-visible'));
      if (focused) { placeAt(focused); return; }
      const w = document.elementFromPoint(px, py)?.closest('.pw');
      if (!w) { hide(); return; }
      if (w.dataset.preview !== current) {
        setContent(w.dataset.preview);
        words.forEach((o) => o.classList.toggle('is-active', o === w));
      }
    };
    const onScroll = () => { if (!queued && visible) { queued = true; requestAnimationFrame(recheck); } };
    if (lenis) lenis.on('scroll', onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Keyboard ---------- */
  words.forEach((w) => {
    w.addEventListener('focus', () => {
      if (!w.matches(':focus-visible')) return;
      setContent(w.dataset.preview);
      w.classList.add('is-active');
      show();
      requestAnimationFrame(() => placeAt(w));
    });
    w.addEventListener('blur', () => { w.classList.remove('is-active'); hide(60); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && visible && !document.querySelector('dialog[open]')) hide(); });

  /* ---------- Click / tap: first shows the card, second opens it large ---------- */
  function open(key) {
    const it = ITEMS[key];
    hide();
    if (it.kind === 'html') openLightbox({ kind: 'html', template: it.template, caption: it.caption });
    else if (it.kind === 'video') openLightbox({ kind: 'video', video: it.video, src: it.src, alt: it.alt, caption: it.caption });
    else openLightbox({ src: it.full, fallback: it.fallback, alt: it.alt, caption: it.caption });
  }
  words.forEach((w) => {
    w.addEventListener('click', (e) => {
      const key = w.dataset.preview;
      if (fine && e.pointerType !== '') { open(key); return; }
      if (visible && current === key) { open(key); return; }
      setContent(key);
      words.forEach((o) => o.classList.toggle('is-active', o === w));
      show();
      requestAnimationFrame(() => placeAt(w));
    });
  });
  document.addEventListener('pointerdown', (e) => { if (touch && visible && !e.target.closest('.pw')) hide(); });
  // On touch the card is pinned beside its title; once the page scrolls it no longer belongs there.
  if (!fine) window.addEventListener('scroll', () => { if (visible) hide(); }, { passive: true });

  /* ---------- Sweep: the triggers light in turn, once ---------- */
  if (gsap) {
    whenSeen(document.querySelectorAll('[data-sweep]'), (block) => {
      [...block.querySelectorAll('.pw')].forEach((w, i) => {
        gsap.delayedCall(0.25 + i * 0.22, () => w.classList.add('is-swept'));
        gsap.delayedCall(0.25 + i * 0.22 + 0.55, () => w.classList.remove('is-swept'));
      });
    }, '0px 0px -30% 0px');
  }
}
