// The Plug-in button: the site's one call to action, "Get my free report"
// ("Unlock my free report" under the report teaser). A house button with a
// socket (a circle, two slots) at its right end, and under it a mini WhatsApp
// chat with the message it will send.
//   Fine pointer, hover or focus: in the hero the 3D cord's plug swings to the
//   socket (when the cord is live and its plug on screen; elsewhere a small 2D
//   plug waits beside the socket), and the chat opens below the button, pushing
//   what is under it down: the message types in (0.7 s), then the time and two
//   grey ticks. Leave: it all goes back.
//   Click (or Enter): the plug snaps in, its pins on the slots (0.25 s), one
//   signal-orange ring, the ticks turn blue, "Connected ✓", and 450 ms after the
//   click the page goes to WhatsApp (location.href, so no popup blocker).
//   "Connected ✓" stays; a later click goes straight to WhatsApp.
//   Touch: the first tap opens the chat ("Tap again to send"); the second
//   connects and goes.
//   Reduced motion, or no JS: a plain link with an arrow; the chat shows, in
//   full and without movement, on keyboard focus only.
import { SITE } from './config.js';

const GO_MS = 450;
const TYPE_MS = 700;
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: SITE.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
// The house easing, cubic-bezier(.22, 1, .36, 1), is close to a quintic ease-out.
const ease = (t) => 1 - Math.pow(1 - t, 5);

export function initPlugins({ cable = null } = {}) {
  const plugins = [...document.querySelectorAll('[data-plugin]')];
  if (!plugins.length) return;
  // The chat shows the time in Mumbai now (with reduced motion too).
  const stamp = () => { const t = clock.format(new Date()); document.querySelectorAll('[data-chat-time]').forEach((el) => { el.textContent = t; }); };
  stamp();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced) return;

  const resets = [];
  plugins.forEach((root) => {
    const a = root.querySelector('.plugin__btn');
    const socket = root.querySelector('.plugin__socket');
    const hint = root.querySelector('[data-plugin-hint]');
    const typed = root.querySelector('[data-chat-typed]');
    const rest = root.querySelector('[data-chat-rest]');
    const full = rest ? rest.textContent : '';
    const use3d = root.hasAttribute('data-plugin-3d') && !!cable;
    let armed = false, going = false, connected = false, cord = false, typing = 0, untype = 0;
    root.classList.add('is-live');

    // The message types in: the typed part shows, the rest keeps its place unseen.
    const write = (n) => { typed.textContent = full.slice(0, n); rest.textContent = full.slice(n); };
    const type = () => {
      clearTimeout(untype);
      if (!typed || typing || root.classList.contains('is-typed')) return;
      stamp();
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / TYPE_MS);
        write(Math.round(ease(t) * full.length));
        if (t < 1) typing = requestAnimationFrame(step);
        else { typing = 0; root.classList.add('is-typed'); }
      };
      write(0);
      typing = requestAnimationFrame(step);
    };
    const typeAll = () => { cancelAnimationFrame(typing); typing = 0; if (typed) write(full.length); root.classList.add('is-typed'); };
    // Cleared once the chat has closed (0.45 s), so it never empties in view.
    const clear = () => { cancelAnimationFrame(typing); typing = 0; untype = setTimeout(() => { if (!root.classList.contains('is-open') && typed) { write(0); root.classList.remove('is-typed'); } }, 450); };

    const sock = () => { const r = socket.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    // The 3D plug where it can be seen; the 2D one in the button otherwise.
    const reach = (snap = false) => {
      cord = use3d && cable.live();
      root.classList.toggle('is-cord', cord);
      if (cord) cable.reach(sock(), { snap });
    };
    const open = () => { root.classList.add('is-open'); type(); if (!connected) reach(); };
    const close = () => {
      if (going) return;
      root.classList.remove('is-open', 'is-armed');
      armed = false;
      if (hint) hint.textContent = '';
      if (cord) { cable.reach(null); cord = false; root.classList.remove('is-cord'); }
      if (!connected) clear();
    };
    const connect = () => {
      going = connected = true;
      typeAll();
      root.classList.add('is-open', 'is-snapped', 'is-connected');
      reach(true);
      setTimeout(() => { location.href = a.href; }, GO_MS);
    };

    if (fine) {
      a.addEventListener('pointerenter', open);
      a.addEventListener('pointerleave', () => { if (document.activeElement !== a) close(); });
    }
    a.addEventListener('focus', () => { if (a.matches(':focus-visible')) open(); });
    a.addEventListener('blur', () => { if (!fine || !a.matches(':hover')) close(); });

    a.addEventListener('click', (e) => {
      // New tab, new window: let the browser do it.
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button > 0) return;
      e.preventDefault();
      if (going) return;
      // Connected already: straight to WhatsApp.
      if (connected) { location.href = a.href; return; }
      // Touch: the first tap only shows what will happen.
      if (!fine && !armed && e.detail > 0) {
        armed = true;
        root.classList.add('is-armed');
        open();
        if (hint) hint.textContent = 'Tap again to send';
        if (cord) { cable.glow(1); setTimeout(() => { if (!going) cable.glow(0.35); }, 600); }
        return;
      }
      connect();
    });
    // A tap anywhere else puts it back.
    document.addEventListener('pointerdown', (e) => { if (armed && !root.contains(e.target)) close(); });
    // Back from WhatsApp (page from the cache): "Connected ✓" stays, the chat closes.
    resets.push(() => { going = false; close(); });
  });

  addEventListener('pageshow', (e) => {
    if (e.persisted) resets.forEach((r) => r());
  });
}
