// ============================================================
// SITE SETTINGS: the values the scripts use.
// The same values are hard-coded in the HTML links (so they work
// without JavaScript); docs/build-notes.md lists every place.
// ============================================================
export const SITE = {
  domain: 'https://viraajautomates.tech',
  email: 'viraaj.automates@gmail.com',
  whatsapp: '919653375679',
  whatsappDisplay: '+91 96533 75679',
  // "Ask me for a live demo" opens WhatsApp with this; the demo site itself is never linked.
  liveDemoText: 'Hi Viraaj, I saw the demo on your website. Can you show me how it would work for my business?',
  // Every "Get my free report" button and the nav's "Free report" link open WhatsApp with this.
  freeReportText: 'Hi Viraaj, saw your website. Can I get the free report for my business?',
  city: 'Mumbai',
  timeZone: 'Asia/Kolkata',
  // Monday (1) to Saturday (6), 10:00 to 19:00 IST
  hours: { days: [1, 2, 3, 4, 5, 6], open: 10, close: 19 },
};
