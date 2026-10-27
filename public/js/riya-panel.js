// Riya, live: the chat panel behind every "Chat with Riya now" link. Loaded
// with css/riya.css once the page is idle (js/core.js), so a click starts it at once.
// Open (0.76 s): the backdrop and a braided cord start on the click, the cord
// draws from the link to a socket on the panel's edge (0.3 s), the plug clicks
// in (the socket glows), and after 60 ms the panel grows out of the socket (a
// circle, 0.4 s); focus goes in, and the cord fades. Close: the panel shrinks back
// into the socket (0.4 s) and the cord retracts to the link. Reduced motion: a
// 0.2 s fade. Talks to the chat webhook with fetch: one POST per message.
const ENDPOINT = 'https://chat.svayra.com/webhook/36a7ae43-365d-4cc8-b5bc-33d197384391/chat';
const WHATSAPP = 'https://wa.me/919653375679?text=Hi%20Viraaj%2C%20saw%20your%20website.%20Can%20I%20get%20the%20free%20report%20for%20my%20business%3F';
const CHIPS = ['Saturday checkup ka slot milega?', 'What are your timings?', 'Kal 2 baje appointment chahiye'];
const TIMEOUT = 20000, GAP = 2000, LIMIT = 30;   // 20 s per reply; one message per 2 s, 30 per visit
const BREAK = 'Riya is taking a break. Message me on WhatsApp instead →';
const DONE = /confirm ho (gayi|chuki)|book ho gayi|schedule ho gaya|\b(is|been) (confirmed|booked|scheduled)/i;
const EASE = 'cubic-bezier(.22, 1, .36, 1)';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

const keep = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } return null; };
let session = keep('va-riya-session');
if (!session) keep('va-riya-session', session = crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
let count = +keep('va-riya-count') || 0;

const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});
const run = (node, frames, o = {}) => node.animate(frames, { duration: 350, easing: EASE, fill: 'both', ...o }).finished;

let root, panel, log, chips, input, send, cord, socket, from = null, lenis = null, open = false, moving = false, busy = false, last = 0, stamped = false;

function build() {
  root = el('div', 'riya');
  root.hidden = true;
  root.innerHTML = `<div class="riya__backdrop"></div>
<section class="riya__panel" role="dialog" aria-modal="true" aria-labelledby="riya-title" aria-describedby="riya-micro" tabindex="-1">
<span class="riya__socket" aria-hidden="true"></span>
<header class="riya__head">
<span class="riya__mask"><span class="riya__label t-tag">Demo · Sample clinic</span></span>
<h2 class="riya__title" id="riya-title"><span class="riya__mask"><span>Riya · AI receptionist</span></span></h2>
<p class="riya__micro" id="riya-micro"><span class="riya__mask"><span>Riya works for a sample clinic, Smile Dental, Pune. Try booking a slot in English, Hindi or Hinglish. Please don't share real medical details.</span></span></p>
<button class="riya__close" type="button" aria-label="Close the chat">✕</button>
</header>
<div class="riya__log" aria-live="polite" data-lenis-prevent><div class="riya__chips"></div></div>
<form class="riya__form"><label class="sr-only" for="riya-input">Message Riya</label><input class="riya__input" id="riya-input" maxlength="500" autocomplete="off" enterkeyhint="send" placeholder="Message Riya…"><button class="riya__send" type="submit" aria-label="Send">→</button></form>
<a class="riya__demo" href="https://demo.svayra.com/" target="_blank" rel="noopener">Open the full demo clinic site ↗</a>
</section>
<svg class="riya__cord" aria-hidden="true"></svg>`;
  document.body.append(root);
  [panel, log, input, send, cord, socket] = ['.riya__panel', '.riya__log', '.riya__input', '.riya__send', '.riya__cord', '.riya__socket'].map((s) => root.querySelector(s));
  chips = log.firstChild;
  CHIPS.forEach((t) => chips.append(Object.assign(el('button', 'riya__chip', t), { type: 'button', onclick: () => say(t) })));
  root.querySelector('form').onsubmit = (e) => { e.preventDefault(); say(input.value); };
  root.querySelector('.riya__close').onclick = close;
  root.firstChild.onclick = close;
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') close();
    if (e.key !== 'Tab') return;
    // Keep focus in the panel.
    const f = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
  });
}

/* ---------- The conversation ---------- */
function bubble(node) {
  log.append(node);
  log.scrollTop = log.scrollHeight;
  if (!reduced) run(node, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }]);
  return node;
}
const add = (text, who) => bubble(el('p', `riya__msg riya__msg--${who}`, text));
function whatsapp(text = BREAK) {
  const p = el('p', 'riya__msg riya__msg--riya');
  p.append(Object.assign(el('a', '', text), { href: WHATSAPP, target: '_blank', rel: 'noopener' }));
  bubble(p);
}
function stamp() {
  stamped = true;
  const p = bubble(el('p', 'riya__stamp'));
  p.innerHTML = '<svg viewBox="0 0 14 14"><path d="M2 7.5l3.2 3L12 3.5" pathLength="1" stroke-dasharray="1"/></svg><span>Sent to the clinic</span>';
  p.setAttribute('aria-label', '✓ Sent to the clinic');
  if (reduced) return;
  run(p.querySelector('path'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 300, delay: 150 });
  run(p.lastChild, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 650, delay: 380, easing: 'cubic-bezier(.45, 0, .55, 1)' });
}
const ready = () => { send.disabled = busy || count >= LIMIT || Date.now() - last < GAP; };

async function say(text) {
  text = String(text).trim().slice(0, 500);
  if (!text || busy || Date.now() - last < GAP || count >= LIMIT) return;
  busy = true;
  last = Date.now();
  keep('va-riya-count', ++count);
  ready();
  chips.remove();
  add(text, 'you');
  input.value = '';
  const dots = bubble(el('div', 'riya__typing'));
  dots.setAttribute('aria-hidden', 'true');
  dots.innerHTML = '<svg viewBox="0 0 52 14"><line x1="2" y1="7" x2="50" y2="7"/><circle cx="12" cy="7" r="3.2"/><circle cx="26" cy="7" r="3.2"/><circle cx="40" cy="7" r="3.2"/></svg>';
  let reply = null;
  try {
    const stop = new AbortController(), t = setTimeout(() => stop.abort(), TIMEOUT);
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendMessage', sessionId: session, chatInput: text }), signal: stop.signal });
    const data = res.ok ? await res.json() : null;
    clearTimeout(t);
    reply = (Array.isArray(data) ? data[0] : data)?.output || null;
  } catch (e) { /* the break message below */ }
  dots.remove();
  if (reply) {
    add(reply, 'riya');
    if (!stamped && DONE.test(reply) && !/\?\s*$/.test(reply)) stamp();
  } else whatsapp();
  if (count >= LIMIT) { whatsapp('That’s the end of this demo chat. Message me on WhatsApp instead →'); input.disabled = true; }
  busy = false;
  ready();
  setTimeout(ready, GAP);
}

/* ---------- Open and close ---------- */
// The socket: on the panel's left edge level with the link (top edge on a phone).
function place(link) {
  const P = panel.getBoundingClientRect(), L = link.getBoundingClientRect();
  const a = { x: L.right + 20, y: L.top + L.height / 2 };   // the end of the link's plug icon
  const s = P.top > 0
    ? { x: Math.min(Math.max(a.x, P.left + 40), P.right - 40), y: P.top }
    : { x: P.left, y: Math.min(Math.max(a.y, 170), P.bottom - 120) };
  Object.assign(socket.style, { left: `${s.x - P.left}px`, top: `${s.y - P.top}px` });
  return { a, s, P };
}
// The cord hangs a little between the link and the socket; the plug at its end points into the socket.
function drawCord({ a, s }) {
  const dx = s.x - a.x, low = Math.max(a.y, s.y) + 50 + Math.abs(dx) * 0.08;
  let c1 = [a.x + dx * 0.33, low], c2 = [a.x + dx * 0.7, low];
  // Straight up to a phone's sheet: the cord swings out toward the middle and rises into the socket.
  if (Math.abs(dx) < 40) {
    const side = a.x < innerWidth / 2 ? 1 : -1;
    c1 = [a.x + side * 90, low];
    c2 = [s.x + side * 20, s.y + 160];
  }
  const d = `M${a.x} ${a.y}C${c1} ${c2} ${s.x} ${s.y}`;
  const deg = (Math.atan2(s.y - c2[1], s.x - c2[0]) * 180) / Math.PI;
  // The mask in page units: in its default (the path's box) a straight up-and-down cord, a phone's, is 0 wide and hides it all.
  cord.innerHTML = `<defs><mask id="riya-cord" maskUnits="userSpaceOnUse"><path d="${d}" stroke="#fff" stroke-width="12" fill="none" pathLength="1" stroke-dasharray="1 2"/></mask></defs>
<g mask="url(#riya-cord)"><path class="core" d="${d}"/><path class="braid" d="${d}"/></g>
<g class="plug" transform="translate(${s.x} ${s.y}) rotate(${deg})"><g><rect x="-22" y="-5" width="16" height="10" rx="2"/><rect class="pin" x="-6" y="-3.5" width="6" height="2"/><rect class="pin" x="-6" y="1.5" width="6" height="2"/></g></g>`;
  return cord;
}

export async function openRiya(link, opts = {}) {
  if (!root) build();
  if (open || moving) return;
  moving = true;
  from = link;
  lenis = opts.lenis || null;
  root.hidden = false;
  const back = root.firstChild, g = place(link);
  // The backdrop and the cord (or the fade) start first, in this frame; then the page stops scrolling.
  let opened;
  if (reduced) {
    opened = Promise.all([back, panel].map((n) => run(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear' })));
  } else {
    const at = `at ${g.s.x - g.P.left}px ${g.s.y - g.P.top}px`, r = Math.hypot(g.P.width, g.P.height) * 1.05;
    panel.style.clipPath = `circle(0px ${at})`;
    // One timeline, all started now: the cord (0.3 s), a 60 ms pause, the panel (0.4 s).
    const CORD = 300, GROW = CORD + 60;
    run(back, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    const c = drawCord(g);
    // The plug clicks in as the cord arrives: a small bump, and the socket glows.
    run(c.querySelector('mask path'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: CORD }).then(() => root.classList.add('is-plugged'));
    run(c.querySelector('.plug > g'), [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'scale(1.18)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { duration: 200, delay: CORD });
    opened = run(panel, [{ clipPath: `circle(0px ${at})` }, { clipPath: `circle(${r}px ${at})` }], { duration: 400, delay: GROW });
    // Inside: the header lines rise (50 ms apart), then the suggestions drop in one by one.
    root.querySelectorAll('.riya__mask > span').forEach((n, i) => run(n, [{ transform: 'translateY(110%)' }, { transform: 'none' }], { duration: 420, delay: GROW + 60 + i * 50 }));
    [...chips.children].forEach((n, i) => run(n, [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: GROW + 160 + i * 60 }));
    opened.then(() => run(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }));
  }
  lenis?.stop();
  document.documentElement.style.overflow = 'hidden';
  await opened;
  root.classList.add('is-plugged');
  open = true;
  moving = false;
  (fine ? input : panel).focus({ preventScroll: true });
}

async function close() {
  if (!open || moving) return;
  moving = true;
  open = false;
  const back = root.firstChild;
  if (reduced) {
    await Promise.all([back, panel].map((n) => run(n, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'linear' })));
  } else {
    const g = place(from), at = `at ${g.s.x - g.P.left}px ${g.s.y - g.P.top}px`, r = Math.hypot(g.P.width, g.P.height) * 1.05;
    const c = drawCord(g);
    run(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    run(back, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 200 });
    await run(panel, [{ clipPath: `circle(${r}px ${at})` }, { clipPath: `circle(0px ${at})` }], { duration: 400 });
    root.classList.remove('is-plugged');
    // The cord retracts to the link, the plug first.
    run(c.querySelector('.plug'), [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
    await run(c.querySelector('mask path'), [{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }], { duration: 380 });
  }
  root.classList.remove('is-plugged');
  root.hidden = true;
  cord.innerHTML = '';
  document.documentElement.style.overflow = '';
  lenis?.start();
  moving = false;
  from?.focus({ preventScroll: true });
}
