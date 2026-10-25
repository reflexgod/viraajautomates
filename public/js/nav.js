// Full-screen menu: a black panel wipes down from the nav, the links rise.
// Escape closes it; closing plays the opening backwards at 1.6x speed.
// Focus stays inside the nav bar and the menu while it is open.

export function initNav({ gsap, lenis, goTo }) {
  const nav = document.querySelector('[data-nav]');
  const btn = nav.querySelector('[data-menu-btn]');
  const label = nav.querySelector('[data-menu-label]');
  const menu = document.querySelector('[data-menu]');
  const words = menu.querySelectorAll('.menu__word');
  const indexes = menu.querySelectorAll('.menu__index, .menu__arrow');
  const foot = menu.querySelectorAll('[data-menu-foot] > *');
  const root = document.documentElement;
  let isOpen = false;
  let tl = null;

  if (gsap) {
    tl = gsap.timeline({
      paused: true,
      onReverseComplete: () => { menu.hidden = true; },
    });
    tl.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut' }, 0)
      .fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.07, ease: 'power4.out' }, 0.35)
      .fromTo(indexes, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, stagger: 0.035, ease: 'power3.out' }, 0.45)
      .fromTo(foot, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' }, 0.55);
  }

  const focusables = () => [...nav.querySelectorAll('a[href], button'), ...menu.querySelectorAll('a[href]')];

  function open() {
    if (isOpen) return;
    isOpen = true;
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    label.textContent = 'Close menu';
    root.classList.add('menu-open');
    lenis?.stop();
    if (!lenis) root.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    if (tl) tl.timeScale(1).play();
    setTimeout(() => menu.querySelector('a')?.focus({ preventScroll: true }), tl ? 350 : 0);
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    btn.setAttribute('aria-expanded', 'false');
    label.textContent = 'Open menu';
    root.classList.remove('menu-open');
    lenis?.start();
    root.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (tl) tl.timeScale(1.6).reverse();
    else menu.hidden = true;
    if (restoreFocus) btn.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = focusables();
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
  }

  btn.addEventListener('click', () => (isOpen ? close() : open()));

  // A section link closes the menu and jumps there while the panel wipes away.
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    close({ restoreFocus: false });
    goTo(target, { immediate: true });
  });

  // The mark goes back to the top; with the menu open it closes it first.
  nav.querySelector('.nav__mark').addEventListener('click', () => { if (isOpen) close({ restoreFocus: false }); });

  return { close };
}
