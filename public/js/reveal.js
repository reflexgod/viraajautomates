// One reveal grammar for the whole page; every element animates once, and only
// the first block of each section fades (not every element). Triggers are
// IntersectionObservers, so starting them costs next to nothing.
//   [data-reveal="fade"]   opacity 0 -> 1 when its top reaches 90% of the viewport;
//                          0.6 s power3.out, no delay, so it is fully there before it
//                          reaches 75% (opacity, not visibility, so screen readers and
//                          keyboard focus still reach it). A block already on screen
//                          when the script starts is simply shown.
//   [data-reveal="lines"]  masked lines rise, yPercent 110 -> 0, 1.1 s power4.out, stagger 0.1
//   footer                 title lines at 90% of the viewport, details 0.1 s later
import { whenSeen } from './scroll.js';

export function initReveals({ gsap }) {
  whenSeen(document.querySelectorAll('[data-reveal="fade"]'), (el) => {
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power3.out', overwrite: true });
  });

  whenSeen(document.querySelectorAll('[data-reveal="lines"]'), (el) => {
    gsap.fromTo(el.querySelectorAll('.line-mask > span'), { yPercent: 110, y: 0 }, { yPercent: 0, y: 0, duration: 1.1, stagger: 0.1, ease: 'power4.out' });
  });

  // C6: the pen stroke under "fixed in writing" draws once, as the line comes up.
  whenSeen(document.querySelectorAll('[data-pen]'), (el) => setTimeout(() => el.classList.add('is-drawn'), 350), '0px 0px -25% 0px');

  const footer = document.querySelector('[data-footer]');
  if (footer) {
    whenSeen(footer.querySelector('[data-footer-lines]') || footer, () => {
      gsap.timeline()
        .fromTo(footer.querySelectorAll('[data-footer-lines] .line-mask > span'), { yPercent: 110, y: 0 }, { yPercent: 0, y: 0, duration: 1.1, stagger: 0.1, ease: 'power4.out' }, 0)
        .fromTo(footer.querySelectorAll('[data-footer-fade]'), { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.06, ease: 'power3.out' }, 0.1);
    });
  }
}
