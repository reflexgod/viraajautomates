// One scroll loop for everything that follows the scroll position (service and
// process rows, the hero's exit). Lenis moves the page with window.scrollTo, so
// the native scroll event fires for smooth and plain scrolling alike. Each
// callback reads its positions first and writes after, once per frame.
// Much cheaper to start than one ScrollTrigger per row, which kept the phone's
// main thread busy for over a second on first load.
const fns = new Set();
let queued = false;

function run() {
  queued = false;
  fns.forEach((fn) => fn());
}
function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(run);
}
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', queue);

export function onScroll(fn) {
  fns.add(fn);
  queue();
  return () => fns.delete(fn);
}

// Calls fn once, when el comes within `margin` of the viewport (e.g. '0px 0px -10% 0px'
// fires when its top reaches 90% of the viewport). Also fires for an element that
// is already above the screen (a reload half-way down the page).
export function whenSeen(el, fn, margin = '0px 0px -10% 0px') {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting || e.boundingClientRect.bottom < 0) { io.unobserve(e.target); fn(e.target); }
    });
  }, { rootMargin: margin });
  (el.length !== undefined ? [...el] : [el]).forEach((x) => io.observe(x));
  return io;
}
