// The Plug-in button: the site's one call to action, "Check my business".
// A cream house button with a small socket at its right end.
//   Fine pointer, hover or focus: in the hero the 3D cord's plug swings to the
//   socket (when the cord is live and its plug on screen; elsewhere a small 2D
//   plug slides up to the socket), its lamp brightens, and a WhatsApp-style
//   bubble rises above the button with the exact message. Leave: it all goes back.
//   Click (or Enter): the plug snaps in (0.25 s), one signal-orange ring pulses
//   from the socket, the label rises to "Connected ✓", and 450 ms after the
//   click the page goes to WhatsApp (location.href, so no popup blocker).
//   Touch: the first tap shows the bubble, pulses the lamp and says "Tap again
//   to open WhatsApp"; the second tap connects and goes.
//   Reduced motion, or no JS: a plain link "Check my business →"; the bubble
//   shows (without movement) on keyboard focus only.
const GO_MS = 450;

export function initPlugins({ cable = null } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const plugins = [...document.querySelectorAll('[data-plugin]')];
  if (!plugins.length || reduced) return;

  const resets = [];
  plugins.forEach((root) => {
    const a = root.querySelector('a');
    const socket = root.querySelector('.plugin__socket');
    const hint = root.querySelector('[data-plugin-hint]');
    const use3d = root.hasAttribute('data-plugin-3d') && !!cable;
    let armed = false, going = false, cord = false;

    const sock = () => { const r = socket.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    // The 3D plug where it can be seen; the 2D one in the button otherwise.
    const reach = (snap = false) => {
      cord = use3d && cable.live();
      root.classList.toggle('is-cord', cord);
      if (cord) cable.reach(sock(), { snap });
    };
    const open = () => { root.classList.add('is-open'); reach(); };
    const close = () => {
      if (going) return;
      root.classList.remove('is-open', 'is-armed');
      armed = false;
      if (hint) hint.textContent = '';
      if (cord) cable.reach(null);
    };
    const connect = () => {
      going = true;
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
      // Touch: the first tap only shows what will happen.
      if (!fine && !armed && e.detail > 0) {
        armed = true;
        root.classList.add('is-open', 'is-armed');
        if (hint) hint.textContent = 'Tap again to open WhatsApp';
        reach();
        if (cord) { cable.glow(1); setTimeout(() => { if (!going) cable.glow(0.35); }, 600); }
        return;
      }
      connect();
    });
    // A tap anywhere else puts it back.
    document.addEventListener('pointerdown', (e) => { if (armed && !root.contains(e.target)) close(); });
    resets.push(() => { going = false; root.classList.remove('is-snapped', 'is-connected', 'is-cord'); close(); });
  });

  // Coming back from WhatsApp (back button, page from the cache): start fresh.
  addEventListener('pageshow', (e) => {
    if (e.persisted) resets.forEach((r) => r());
  });
}
