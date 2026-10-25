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
  // The demo clinic Riya answers on; ?riya=open opens her chat.
  demoUrl: 'https://demo.viraajautomates.tech/',
  riyaUrl: 'https://demo.viraajautomates.tech/?riya=open',
  freeCheckText: "Hi Viraaj, I'd like the free check. Business name: ",
  city: 'Mumbai',
  timeZone: 'Asia/Kolkata',
  // Monday (1) to Saturday (6), 10:00 to 19:00 IST
  hours: { days: [1, 2, 3, 4, 5, 6], open: 10, close: 19 },
};
