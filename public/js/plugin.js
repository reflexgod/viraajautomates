// The Plug-in button: the site's one call to action, "Get my free report"
// ("Unlock my free report" under the report teaser). A house button with a
// socket (a circle, two slots) at its right end, and under it a mini WhatsApp
// chat with the message it will send.
//   In the hero the 3D cord rests with its plug in the socket (the still image
//   too); elsewhere the socket is empty. Only one socket ever shows.
//   Fine pointer, hover or focus: the hero cord's lamp brightens, and the chat
//   opens below the button, pushing what is under it down: the message types
//   in (0.7 s), then the time and two grey ticks. Leave: it all goes back.
//   Click (or Enter): outside the hero a small 2D plug snaps into the socket,
//   its pins on the slots (0.25 s); one signal-orange ring, the ticks turn
//   blue, and 450 ms after the click the page goes to WhatsApp (location.href,
//   so no popup blocker). A later click goes straight to WhatsApp.
//   The button's text never changes. The hero's "plugged" state (a soft glow
//   on the socket) comes from the cord itself, not from a click (js/hero.js).
//   Touch: the first tap opens the chat ("Tap again to send"), and when the chat
//   would reach past the bottom of the screen the page glides up just enough to
//   show it (0.6 s); the second tap connects and goes.
//   Reduced motion, or no JS: a plain link with an arrow; the chat shows, in
//   full and without movement, on keyboard focus only.
import { mumbai } from './clock.js';

const GO_MS = 450;
const TYPE_MS = 700;
// The house easing, cubic-bezier(.22, 1, .36, 1), is close to a quintic ease-out.
const ease = (t) => 1 - Math.pow(1 - t, 5);

export function initPlugins({ cable = null, lenis = null } = {}) {
  const plugins = [...document.querySelectorAll('[data-plugin]')];
  if (!plugins.length) return;
  // The chat shows the time in Mumbai now (with reduced motion too).
  const stamp = () => { const t = mumbai().time; document.querySelectorAll('[data-chat-time]').forEach((el) => { el.textContent = t; }); };
  stamp();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced) return;

  const resets = [];
  plugins.forEach((root) => {
    const a = root.querySelector('.plugin__btn');
    const hint = root.querySelector('[data-plugin-hint]');
    const typed = root.querySelector('[data-chat-typed]');
    const rest = root.querySelector('[data-chat-rest]');
    const full = rest ? rest.textContent : '';
    const use3d = root.hasAttribute('data-plugin-3d') && !!cable;
    let armed = false, going = false, sent = false, typing = 0, untype = 0;
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

    // The hero cord's lamp (the cord rests in this socket).
    const glow = (v) => { if (use3d) cable.glow(v); };
    // The hero listens, so its copy does not fade while the chat is open.
    const toggled = () => root.dispatchEvent(new CustomEvent('plugin-toggle', { bubbles: true }));
    const open = () => { root.classList.add('is-open'); type(); if (!sent) glow(1); toggled(); };
    const close = () => {
      if (going) return;
      root.classList.remove('is-open', 'is-armed');
      toggled();
      armed = false;
      if (hint) hint.textContent = '';
      if (!sent) { glow(0); clear(); }
    };
    const connect = () => {
      going = sent = true;
      typeAll();
      root.classList.add('is-open', 'is-snapped', 'is-sent');
      glow(1);
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
      // Sent already: straight to WhatsApp.
      if (sent) { location.href = a.href; return; }
      // Touch: the first tap only shows what will happen.
      if (!fine && !armed && e.detail > 0) {
        armed = true;
        root.classList.add('is-armed');
        open();
        if (hint) hint.textContent = 'Tap again to send';
        // The whole chat on screen: glide up by what it reaches past the bottom.
        const inner = root.querySelector('.plugin__chat-in');
        const dy = inner ? Math.ceil(a.getBoundingClientRect().bottom + inner.scrollHeight + 12 - innerHeight) : 0;
        if (dy > 0) {
          if (lenis) lenis.scrollTo(scrollY + dy, { duration: 0.6 }); else scrollBy({ top: dy, behavior: 'smooth' });
        }
        setTimeout(() => { if (!going) glow(0.35); }, 600);
        return;
      }
      connect();
    });
    // A tap anywhere else puts it back.
    document.addEventListener('pointerdown', (e) => { if (armed && !root.contains(e.target)) close(); });
    // Back from WhatsApp (page from the cache): the chat closes and the 2D plug comes out.
    resets.push(() => { going = false; root.classList.remove('is-snapped'); close(); });
  });

  addEventListener('pageshow', (e) => {
    if (e.persisted) resets.forEach((r) => r());
  });
}
