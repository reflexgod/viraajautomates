// Processes the founder photo (spec 10.5).
// Reads the untouched original from source-assets/ (never deployed) and writes:
//   public/images/viraaj.jpg        960 x 1200 JPEG fallback
//   public/images/viraaj-480.webp   480 x 600
//   public/images/viraaj-960.webp   960 x 1200
//   public/images/viraaj-112.webp   112 x 112 square, for the 56 px hero circle (2x)
// sharp drops all metadata (including GPS) unless told to keep it.
// Run with: npm run photo
import sharp from 'sharp';

const SRC = 'source-assets/viraaj-original.jpg';
const OUT = 'public/images/';

// Where the crop window sits vertically: 0 = top, 1 = bottom.
// The spec suggests 0.35; this selfie has the face at the very top, so 0 keeps the hair in frame.
const FOCUS_Y = 0;

const meta = await sharp(SRC).rotate().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = meta.info;

// Largest 4:5 window that fits, centred horizontally.
let cw = w, ch = Math.round(w * 5 / 4);
if (ch > h) { ch = h; cw = Math.round(h * 4 / 5); }
const left = Math.round((w - cw) / 2);
const top = Math.round((h - ch) * FOCUS_Y);

const base = () => sharp(meta.data)
  .extract({ left, top, width: cw, height: ch })
  .modulate({ saturation: 0.85 }); // saturation -15%

await base().resize(960, 1200).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(OUT + 'viraaj.jpg');
await base().resize(480, 600).webp({ quality: 78 }).toFile(OUT + 'viraaj-480.webp');
await base().resize(960, 1200).webp({ quality: 78 }).toFile(OUT + 'viraaj-960.webp');

// Square crop for the hero circle, centred on the face (measured on the original).
const sq = Math.round(w * 0.9);
await sharp(meta.data)
  .extract({ left: Math.round((w - sq) / 2 + w * 0.03), top: Math.round(h * 0.02), width: sq, height: sq })
  .modulate({ saturation: 0.85 })
  .resize(112, 112)
  .webp({ quality: 80 })
  .toFile(OUT + 'viraaj-112.webp');

console.log(`source ${w}x${h}, crop ${cw}x${ch} at ${left},${top}`);
