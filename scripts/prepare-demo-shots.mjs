// Crops the raw demo screenshots into clean images for the site. Every name in
// them is replaced with a clearly fictional "Sample" name (owner, 26 Oct 2026):
// re-set in the screenshot's own font where it can be fitted exactly (the
// sheet, the email body), or cut out of the line with the screenshot's own
// pixels where it can't (the email subject, the calendar title).
// Reads photos/raw/ (copies of the owner's screenshots, never committed) and
// writes photos/<name>.png; then `npm run shots` makes the web sizes.
// Coordinates are in the screenshots' own pixels (all taken at 100% zoom).
//   riya-chat      Screenshot 2026-10-25 193319.png
//   demo-calendar  Screenshot 2026-10-25 193308.png
//   demo-inbox     Screenshot 2026-10-25 193653.png
//   demo-sheet     Screenshot 2026-10-25 193958.png  (newest version: the last row's phone already masked)
//   demo-nri-planner Screenshot 2026-10-25 184104.png
//   demo-treatments  frame at 0.5 s of "Video Project 1.mp4" (photos/raw/treatments-frame.png)
//   enquiry-list(-narrow), riya-confirm: cut from the clean images above
// Run with: node scripts/prepare-demo-shots.mjs
import sharp from 'sharp';
import { retype, closeRetype } from './lib/retype.mjs';

const RAW = 'photos/raw/';
const OUT = 'photos/';

// Blur a rectangle hard enough that no digit survives.
async function blur(input, boxes) {
  let img = sharp(input);
  const parts = [];
  for (const b of boxes) {
    const patch = await sharp(input).extract(b).blur(9).toBuffer();
    parts.push({ input: patch, left: b.left, top: b.top });
  }
  return img.composite(parts).png().toBuffer();
}
const crop = (input, r) => sharp(input).extract(r).png().toBuffer();
// Stack strips vertically on a flat background with even padding.
async function stack(strips, { pad = 32, gap = 24, background }) {
  const metas = await Promise.all(strips.map((s) => sharp(s).metadata()));
  const width = Math.max(...metas.map((m) => m.width)) + pad * 2;
  const height = metas.reduce((h, m) => h + m.height, 0) + gap * (strips.length - 1) + pad * 2;
  let top = pad;
  const layers = strips.map((s, i) => { const l = { input: s, left: pad, top }; top += metas[i].height + gap; return l; });
  return sharp({ create: { width, height, channels: 3, background } }).composite(layers).png().toBuffer();
}

// b) Calendar: the event card only (title, date and time, calendar name).
//    The header illustration, action icons, sidebar and "Created by" line are left out.
{
  const card = await crop(RAW + 'calendar.png', { left: 748, top: 500, width: 712, height: 198 });
  // The calendar icon beside the calendar name would be cut in half by the crop: cover it.
  const cover = await sharp({ create: { width: 56, height: 30, channels: 3, background: '#F1F4F9' } }).png().toBuffer();
  const clean = await sharp(card).composite([{ input: cover, left: 0, top: 168 }]).png().toBuffer();
  const framed = await sharp(clean).extend({ top: 8, bottom: 22, left: 0, right: 0, background: '#F1F4F9' }).png().toBuffer();
  // Title line 1 reads "Dental appointment - <name> - Pain in": keep the
  // pixels up to "appointment " and from the second "-" on, so it reads
  // "Dental appointment - Pain in" (word edges measured on the image).
  const band = { top: 18, height: 51 };
  const left = await sharp(framed).extract({ left: 0, top: band.top, width: 380, height: band.height }).toBuffer();
  const right = await sharp(framed).extract({ left: 567, top: band.top, width: 712 - 567, height: band.height }).toBuffer();
  const line = await sharp({ create: { width: 712, height: band.height, channels: 3, background: '#F1F4F9' } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: 380, top: 0 }]).png().toBuffer();
  await sharp(framed).composite([{ input: line, left: 0, top: band.top }]).toFile(OUT + 'demo-calendar.png');
}

// c) Inbox: subject and body only. The phone number is re-set as "99999 XXX99"
//    in the email's own font (fitted against the line itself), and the
//    "Email: N/A" line is left out (the lines above and below close up, at the
//    same line spacing).
{
  // Subject "New Appointment Booked - <name>": the " - name" part is covered
  // with the email's white, so it reads "New Appointment Booked".
  const subjectRaw = await crop(RAW + 'inbox.png', { left: 210, top: 198, width: 592, height: 50 });
  const white = await sharp({ create: { width: 192, height: 50, channels: 3, background: '#FFFFFF' } }).png().toBuffer();
  const subject = await sharp(subjectRaw).composite([{ input: white, left: 400, top: 0 }]).png().toBuffer();
  let bodyRaw = await crop(RAW + 'inbox.png', { left: 210, top: 344, width: 262, height: 176 });
  bodyRaw = await retype(bodyRaw, [{
    fixed: { font: 'Arial', size: 19.5, x: 6, y: 21.5 },
    cover: { x: 0, y: 2, w: 262, h: 27 },
    text: 'Name: Asha Sample',
  }, {
    ref: { x: 0, y: 31, w: 180, h: 27, text: 'Phone: 999999999' },
    fonts: ['Arial'], sizes: [17, 24], maxX: 12,
    cover: { x: 0, y: 31, w: 262, h: 27 },
    text: 'Phone: 99999 XXX99',
  }]);
  const nameAndPhone = await crop(bodyRaw, { left: 0, top: 0, width: 262, height: 59 });
  const problemToTime = await crop(bodyRaw, { left: 0, top: 88, width: 262, height: 88 });
  const body = await stack([nameAndPhone, problemToTime], { pad: 0, gap: 0, background: '#FFFFFF' });
  await sharp(await stack([subject, body], { pad: 36, gap: 28, background: '#FFFFFF' })).toFile(OUT + 'demo-inbox.png');
}

// d) Sheet: header row and the fully visible rows 4-13, columns A-G.
//    The menu, toolbar, formula bar, column letters, row numbers, the half row
//    under the header and column H are left out.
{
  const header = await crop(RAW + 'sheet.png', { left: 70, top: 288, width: 1578, height: 46 });
  const rows = await crop(RAW + 'sheet.png', { left: 70, top: 353, width: 1578, height: 450 });
  const sheet = await stack([header, rows], { pad: 0, gap: 0, background: '#FFFFFF' });
  // Every name becomes a clearly fictional "Sample" name and the three
  // part-masked emails read "Not provided", in the sheet's own font.
  // The last row (the booking followed on this site), re-set in the same font:
  // the phone in the same masked format as every other row ("99999 XXX99"),
  // and "Pain in lower teeth" with the capitals used everywhere else.
  const fixed = await retype(sheet, [
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 74.5 }, cover: { x: 3, y: 50, w: 163, h: 37 }, text: 'Kabir Sample' },
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 119.5 }, cover: { x: 3, y: 95, w: 163, h: 37 }, text: 'Isha Sample' },
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 164.5 }, cover: { x: 3, y: 140, w: 163, h: 37 }, text: 'Tara Sample' },
    { fixed: { font: 'Roboto', size: 20, x: 333, y: 164.5 }, cover: { x: 327, y: 140, w: 213, h: 37 }, text: 'Not provided' },
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 209.5 }, cover: { x: 3, y: 185, w: 163, h: 37 }, text: 'Rohan Sample' },
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 254.5 }, cover: { x: 3, y: 230, w: 163, h: 37 }, text: 'Nikhil Sample' },
    { fixed: { font: 'Roboto', size: 20, x: 333, y: 254.5 }, cover: { x: 327, y: 230, w: 213, h: 37 }, text: 'Not provided' },
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 299.5 }, cover: { x: 3, y: 275, w: 163, h: 37 }, text: 'Pooja Sample' },
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 344.5 }, cover: { x: 3, y: 320, w: 163, h: 37 }, text: 'Aman Sample' },
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 389.5 }, cover: { x: 3, y: 365, w: 163, h: 37 }, text: 'Zara Sample' },
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 434.5 }, cover: { x: 3, y: 410, w: 163, h: 37 }, text: 'Kunal Sample' },
    { fixed: { font: 'Roboto', size: 20, x: 333, y: 434.5 }, cover: { x: 327, y: 410, w: 213, h: 37 }, text: 'Not provided' },
    { fixed: { font: 'Roboto', size: 20, x: 11, y: 479.5 }, cover: { x: 3, y: 455, w: 163, h: 37 }, text: 'Asha Sample' },
    { ref: { x: 176, y: 457, w: 125, h: 30, text: '99999XX99' }, fonts: ['Roboto', 'Arial'], sizes: [16, 24], maxX: 12, cover: { x: 176, y: 455, w: 152, h: 34 }, text: '99999 XXX99' },
    { ref: { x: 543, y: 457, w: 190, h: 30, text: 'Pain in Lower Teeth' }, fonts: ['Roboto', 'Arial'], sizes: [16, 24], maxX: 12, cover: { x: 543, y: 455, w: 210, h: 34 }, text: 'Pain in lower teeth' },
  ]);
  await sharp(fixed).toFile(OUT + 'demo-sheet.png');
}

// e) Treatments page: a frame from the owner's screen recording, video edges removed.
//    Cut above Riya's greeting: the recording's own frame cuts her widget off at
//    the bottom, so it is left out completely rather than shown cut in half.
await sharp(RAW + 'treatments-frame.png').extract({ left: 0, top: 0, width: 1920, height: 880 }).png().toFile(OUT + 'demo-treatments.png');

// f) Visit planner: the owner's screenshot as it is (it has no browser edges).
await sharp(RAW + 'nri-planner.png').png().toFile(OUT + 'demo-nri-planner.png');

// g) Enquiry list for "How it works" and the case study: the header and the last
//    four rows, with only the columns that read at
//    tile size. Columns are hidden the way you would hide them in the sheet;
//    nothing is moved within a column. Coordinates are in photos/demo-sheet.png.
//      wide   Name, Phone, Problem   (Email, Time and the two Preferred columns hidden)
//      narrow Name, Problem          (phones)
{
  const SHEET = OUT + 'demo-sheet.png';
  const band = (left, width) => [
    { left, top: 0, width, height: 46 },     // header
    { left, top: 316, width, height: 180 },  // rows 7-10
  ];
  async function columns(cols) {
    const parts = [];
    for (const [left, width] of cols) {
      const [h, r] = band(left, width);
      parts.push(await stack([await crop(SHEET, h), await crop(SHEET, r)], { pad: 0, gap: 0, background: '#FFFFFF' }));
    }
    const metas = await Promise.all(parts.map((p) => sharp(p).metadata()));
    let x = 0;
    const layers = parts.map((p, i) => { const l = { input: p, left: x, top: 0 }; x += metas[i].width; return l; });
    return sharp({ create: { width: x, height: metas[0].height, channels: 3, background: '#FFFFFF' } }).composite(layers).png().toBuffer();
  }
  await sharp(await columns([[0, 320], [535, 383]])).toFile(OUT + 'enquiry-list.png');
  await sharp(await columns([[0, 168], [535, 383]])).toFile(OUT + 'enquiry-list-narrow.png');
}


await closeRetype();
console.log('Prepared demo shots in photos/');
