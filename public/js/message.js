// Every free-check button shows its WhatsApp message before it opens (C1).
//   Fine pointer: a small WhatsApp-style bubble rises above the button on hover
//   or keyboard focus (0.45 s, house curve) with the exact message.
//   Touch: the first tap shows the bubble, the second opens WhatsApp. Once a
//   bubble has been seen in this session, one tap opens WhatsApp straight away.
//   Screen readers: the message is in an aria-describedby text.
//   Reduced motion: no rise. Without JS: plain links.
const SEEN = 'va-wa-seen';
const WA_MARK = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false"><path fill="#25D366" d="M8 1.2a6.7 6.7 0 0 0-5.8 10.1L1.3 14.7l3.5-.9A6.7 6.7 0 1 0 8 1.2z"/><path fill="#fff" d="M11.4 9.6c-.2-.1-1.1-.5-1.3-.6-.2-.1-.3-.1-.4.1l-.6.7c-.1.1-.2.1-.4 0a4.6 4.6 0 0 1-2.3-2c-.2-.3.2-.3.5-1 .1-.1 0-.2 0-.3l-.6-1.4c-.1-.4-.3-.3-.4-.3h-.3a.7.7 0 0 0-.5.2 2 2 0 0 0-.6 1.5 3.5 3.5 0 0 0 .7 1.8 7.9 7.9 0 0 0 3 2.7c1.1.5 1.6.5 2.1.4.4 0 1.1-.5 1.3-.9.1-.4.1-.8.1-.9l-.3-.1z"/></svg>';
let n = 0;

export function initMessages() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem(SEEN) === '1'; } catch (e) { /* private mode */ }
  const markSeen = () => { seen = true; try { sessionStorage.setItem(SEEN, '1'); } catch (e) { /* private mode */ } };

  const items = [];

  document.querySelectorAll('a[data-wa-preview]').forEach((a) => {
    let url;
    try { url = new URL(a.href); } catch (e) { return; }
    const base = url.searchParams.get('text') || '';
    if (!base) return;
    const wrap = document.createElement('span');
    wrap.className = 'wa-anchor';
    a.replaceWith(wrap);
    wrap.appendChild(a);
    const bubble = document.createElement('span');
    bubble.className = 'wa-bubble';
    bubble.setAttribute('aria-hidden', 'true');
    bubble.innerHTML = `<span class="wa-bubble__head">${WA_MARK}WhatsApp · to Viraaj</span>`
      + '<span class="wa-bubble__msg"><span class="wa-bubble__text"></span><span class="wa-bubble__tick">✓✓</span></span>'
      + '<span class="wa-bubble__hint">Opens WhatsApp. You press send.</span>';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.id = `wa-msg-${++n}`;
    wrap.append(bubble, sr);
    a.setAttribute('aria-describedby', sr.id);
    bubble.querySelector('.wa-bubble__text').textContent = `${base}…`;
    sr.textContent = `Opens WhatsApp with the message: ${base}`;
    const item = { wrap };
    items.push(item);

    const open = () => {
      if (wrap.classList.contains('is-open')) return;
      items.forEach((o) => { if (o !== item) o.wrap.classList.remove('is-open'); });
      wrap.classList.add('is-open');
      markSeen();
    };
    const close = () => wrap.classList.remove('is-open');
    item.close = close;

    if (fine) {
      a.addEventListener('pointerenter', open);
      wrap.addEventListener('pointerleave', () => { if (document.activeElement !== a) close(); });
      a.addEventListener('blur', () => { if (!wrap.matches(':hover')) close(); });
    } else {
      // First tap: show the message; second tap (or any tap once seen): WhatsApp.
      a.addEventListener('click', (e) => {
        if (wrap.classList.contains('is-open') || seen) return;
        e.preventDefault();
        open();
      });
    }
    a.addEventListener('focus', () => { if (a.matches(':focus-visible')) open(); });
  });

  // A tap or click anywhere else closes an open bubble.
  document.addEventListener('pointerdown', (e) => {
    items.forEach((o) => { if (!o.wrap.contains(e.target)) o.close(); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') items.forEach((o) => o.close()); });
}
