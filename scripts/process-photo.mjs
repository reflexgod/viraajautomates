// Processes the founder photo. Run with: npm run photos
// A new portrait can simply replace public/images/viraaj.jpg: when that file is not
// this script's last output, it becomes the new original (moved to source-assets/,
// never deployed, so a phone photo's GPS data stays on this computer).
// From the original it finds the face (skin tones), and writes, with a light grade
// (saturation -10%, slightly warm) and no metadata:
//   public/images/viraaj.jpg        960 x 1200 (4:5) JPEG fallback
//   public/images/viraaj-480.webp   480 x 600, the About preview card
//   public/images/viraaj-960.webp   960 x 1200, the large view
//   public/images/viraaj-face.webp  80 x 56, the 40 x 28 thumbnail after the name (2x)
//   public/images/viraaj-112.webp   112 x 112, the chat header's 24 px circle
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'public/images/';
const SRC = 'source-assets/viraaj-original.jpg';
const LAST = 'source-assets/.viraaj-last.sha1';
const sha = (f) => createHash('sha1').update(readFileSync(f)).digest('hex');

// A new portrait dropped in place of the processed one becomes the original.
mkdirSync('source-assets', { recursive: true });
const dropped = OUT + 'viraaj.jpg';
if (existsSync(dropped) && (!existsSync(LAST) || readFileSync(LAST, 'utf8') !== sha(dropped))) {
  if (!existsSync(LAST) && existsSync(SRC)) {
    // First run of this version: the public file is the old output; keep the original.
  } else {
    copyFileSync(dropped, SRC);
    console.log('new portrait: public/images/viraaj.jpg is now source-assets/viraaj-original.jpg');
  }
}

const { data, info } = await sharp(SRC).rotate().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

// ---------- The face: where the skin tones are, in the upper part of the picture ----------
const SW = 160, SH = Math.round(H * SW / W);
const px = await sharp(data).resize(SW, SH).removeAlpha().raw().toBuffer();
const pts = [];
for (let y = 0; y < SH * 0.8; y++) for (let x = 0; x < SW; x++) {
  const i = (y * SW + x) * 3, r = px[i], g = px[i + 1], b = px[i + 2];
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b, cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > 60) pts.push([x, y]);
}
let face;
if (pts.length > SW * SH * 0.02) {
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]).sort((a, b) => a - b);
  const cx = mean(xs), sx = Math.sqrt(mean(xs.map((v) => (v - cx) ** 2)));
  // The neck pulls the middle down: the face's centre is a third of the way into the skin.
  const cy = ys[Math.floor(ys.length * 0.35)];
  const k = W / SW;
  face = { x: cx * k, y: cy * k, w: Math.min(W, 3.2 * sx * k) };
} else {
  // No clear skin area: assume a centred portrait.
  face = { x: W / 2, y: H * 0.35, w: W * 0.5 };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- 4:5: the face at 40% from the top, or lower when it is big (room for the hair) ----------
let cw = W, ch = Math.round(W * 5 / 4);
if (ch > H) { ch = H; cw = Math.round(H * 4 / 5); }
const left = Math.round(clamp(face.x - cw / 2, 0, W - cw));
const top = Math.round(clamp(Math.min(face.y - ch * 0.4, face.y - face.w * 0.85), 0, H - ch));

// The light grade: saturation -10%, a touch warmer (red up, blue down).
const grade = (img) => img.modulate({ saturation: 0.9 }).linear([1.03, 1, 0.96], [0, 0, 0]);
const portrait = () => grade(sharp(data).extract({ left, top, width: cw, height: ch }));

await portrait().resize(960, 1200).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(OUT + 'viraaj.jpg');
await portrait().resize(480, 600).webp({ quality: 80 }).toFile(OUT + 'viraaj-480.webp');
await portrait().resize(960, 1200).webp({ quality: 78 }).toFile(OUT + 'viraaj-960.webp');

// ---------- The face, 10:7 for the thumbnail and square for the chat circle ----------
const box = (bw, bh, cy) => {
  const w = Math.round(Math.min(bw, W)), h = Math.round(Math.min(bh, H));
  return { left: Math.round(clamp(face.x - w / 2, 0, W - w)), top: Math.round(clamp(cy - h / 2, 0, H - h)), width: w, height: h };
};
const thumb = box(face.w * 1.45, face.w * 1.45 * 0.7, face.y);
await grade(sharp(data).extract(thumb)).resize(80, 56).webp({ quality: 82 }).toFile(OUT + 'viraaj-face.webp');
const sq = box(face.w * 1.25, face.w * 1.25, face.y + face.w * 0.05);
await grade(sharp(data).extract(sq)).resize(112, 112).webp({ quality: 80 }).toFile(OUT + 'viraaj-112.webp');

writeFileSync(LAST, sha(dropped));
console.log(`original ${W}x${H}; face at ${Math.round(face.x)},${Math.round(face.y)} (~${Math.round(face.w)} px wide); 4:5 crop ${cw}x${ch} at ${left},${top}; thumbnail ${JSON.stringify(thumb)}`);
