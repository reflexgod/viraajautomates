// The hero's free-check composer: one field, one button.
//   Typing fills the preview line under the button and the button's WhatsApp
//   link as you go, so what you see is exactly what gets sent. The button or
//   Enter opens WhatsApp in a new tab; the name is not stored or sent anywhere else.
//   Without JavaScript the field stays hidden (CSS) and the button is a plain
//   WhatsApp link with the usual free-check text.
import { SITE } from './config.js';

// The source tag at the end says which button the message came from.
const message = (name) => `Hi Viraaj, I'd like the free check for ${name || 'my business'}. (hero)`;

export function initCompose() {
  const form = document.querySelector('[data-compose]');
  const field = form?.querySelector('[data-compose-name]');
  const send = form?.querySelector('[data-compose-send]');
  const preview = form?.querySelector('[data-compose-preview]');
  if (!form || !field || !send || !preview) return;

  const render = () => {
    const text = message(field.value.replace(/\s+/g, ' ').trim().slice(0, 60));
    preview.textContent = text;
    send.href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
  };
  field.addEventListener('input', render);
  // Enter (or the phone keyboard's send key) does what the button does.
  form.addEventListener('submit', (e) => { e.preventDefault(); render(); send.click(); });
  render();
}
