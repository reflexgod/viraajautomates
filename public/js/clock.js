// Live Mumbai clock, the open/closed dot, and the footer's live line.
// The HTML ships "--:--" and the hours; this fills in the time and status every 15 s.
// Live line, from real working hours (Mon-Sat 10:00-19:00 IST):
//   open   "Lines open · replies today · Message me"
//   closed "It's 22:12 in Mumbai. I'll reply in the morning. Message me"
//          ("on Monday morning" when the next working day is not tomorrow)
import { SITE } from './config.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: SITE.timeZone,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function lineStatus(date = new Date()) {
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const day = DAYS.indexOf(parts.weekday);
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  const { days, open, close } = SITE.hours;
  const workday = days.includes(day);
  const isOpen = workday && mins >= open * 60 && mins < close * 60;
  const opens = `${String(open).padStart(2, '0')}:00 IST`;
  const time = `${parts.hour}:${parts.minute}`;

  if (isOpen) return { open: true, time, text: `Open now · ${SITE.city} ${time} IST`, reply: '' };
  // Before opening on a working day: back today. After closing: the next working day.
  if (workday && mins < open * 60) return { open: false, time, text: `Closed · back today ${opens}`, reply: 'in the morning' };
  let next = (day + 1) % 7;
  while (!days.includes(next)) next = (next + 1) % 7;
  const when = next === (day + 1) % 7 ? 'tomorrow' : DAYS[next];
  const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const reply = when === 'tomorrow' ? 'in the morning' : `on ${FULL[next]} morning`;
  return { open: false, time, text: `Closed · back ${when} ${opens}`, reply };
}

export function initClock() {
  const statuses = document.querySelectorAll('[data-status]');
  const clocks = document.querySelectorAll('[data-clock]');
  const lives = document.querySelectorAll('[data-live-text]');
  const wa = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent('Hi Viraaj, I found your website and have a question.')}`;
  const link = (label) => `<a href="${wa}" target="_blank" rel="noopener" title="Opens WhatsApp" data-cursor="Chat">${label}<span class="sr-only"> (opens WhatsApp)</span></a>`;
  let lastLive = '';
  const update = () => {
    const s = lineStatus();
    clocks.forEach((el) => { el.textContent = s.time; });
    statuses.forEach((el) => {
      el.dataset.open = String(s.open);
      const t = el.querySelector('[data-status-text]');
      if (t) t.textContent = s.text;
    });
    // Rebuilt only when the sentence changes, so a focused link keeps focus; the time ticks in place.
    const shape = s.open ? 'open' : s.reply;
    if (shape !== lastLive) {
      const html = s.open
        ? `Lines open · replies today · ${link('Message me')}`
        : `It's <span data-live-time></span> in ${SITE.city}. I'll reply ${s.reply}. ${link('Message me')}`;
      lives.forEach((el) => { el.innerHTML = html; });
      lastLive = shape;
    }
    lives.forEach((el) => { const t = el.querySelector('[data-live-time]'); if (t) t.textContent = s.time; });
  };
  update();
  setInterval(update, 15000);
}
