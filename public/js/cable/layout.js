// The hero cable's resting shape, in frame units.
// The frame is scaled to the hero (wide: by its height, or 64% of its width;
// tall: to fit it) and placed so its `socket` point lands on the centre of the
// hero button's socket. At rest the plug's tip is in the socket, so the cord
// is plugged in on every screen size: the still images and the live cord
// share this shape and this placement (placeFrame below, and the copy of it
// in index.html that places the still before first paint).
// Shared by the physics worker, the WebGL cable and the still-image script.
//
// Points are [x, y, z] with y pointing DOWN and z towards the viewer.
// The path enters top-right (far enough out to start off screen on any
// layout), curls once (the curl crosses in front of itself) and comes back
// to the plug, which lies along plugDir (from its back towards its tip).

const PLUG_LENGTH = 228;   // the plug model's length at plug scale 1 (cable.js)

function plugged(frame) {
  const len = PLUG_LENGTH * frame.plug;
  const [sx, sy] = frame.socket, [dx, dy] = frame.plugDir;
  frame.path.push([sx - dx * len, sy - dy * len, 0]);   // the plug's back: the cord's end
  return frame;
}

export const FRAMES = {
  // 768 px and wider: the copy sits top left; the curl is to the right of the
  // button, level with it, and the cord sweeps under the curl and comes into
  // the plug from the right, lying level.
  wide: plugged({
    w: 900, h: 900,      // scale reference
    radius: 25,          // cable radius: a cord, not a rope
    plug: 0.95,          // plug scale
    socket: [384, 400],
    plugDir: [-1, 0],
    seat: 1,             // points behind the plug held along it at rest
    // The still image's region (scripts/make-cable-still.mjs).
    still: { x0: 330, y0: -260, x1: 1720, y1: 980 },
    path: [
      [1705, -440, 0], [1590, -220, 0], [1475, 0, 0], [1345, 170, 14], [1232, 300, 36],
      [1144, 432, 48],
      [1040, 562, 36], [920, 582, 14], [808, 500, -10], [788, 368, -30],
      [858, 250, -44], [990, 208, -50], [1112, 258, -48], [1174, 380, -36],
      [1152, 522, -16],
      [1138, 640, 6], [1090, 712, 12], [990, 742, 16], [880, 725, 16], [800, 668, 10],
      [748, 590, 4], [716, 505, 0], [690, 438, 0], [650, 402, 0],
    ],
  }),
  // Phones: the copy sits at the bottom and the hero button spans it, so its
  // socket is 52 px in from the right edge on every phone. The curl is at the
  // top right, the cord runs down the right edge and the plug dips into the
  // socket from above.
  tall: plugged({
    w: 390, h: 844,
    radius: 12,
    plug: 0.46,
    socket: [429.6, 757.6],
    plugDir: [-0.259, 0.966],
    seat: 2,
    still: { x0: 200, y0: -40, x1: 620, y1: 900 },
    path: [
      [597, -178, 0], [545, -80, 0], [486, 20, 0], [436, 92, 8], [402, 150, 18],
      [367, 206, 22], [319, 234, 14], [268, 222, 4], [244, 178, -8], [262, 130, -16],
      [310, 108, -20], [357, 125, -20], [381, 167, -14], [380, 224, -6],
      [408, 300, 4], [445, 380, 8], [468, 470, 10], [475, 540, 10], [473, 587, 8],
    ],
  }),
  // The plug end hanging into the top of the footer (rendered once, as a still).
  drop: {
    w: 240, h: 520,
    radius: 12,
    plug: 0.5,
    path: [
      [118, -120, 0], [118, -40, 0], [122, 40, 4], [112, 120, 8], [104, 200, 10],
      [112, 270, 10], [124, 330, 8], [128, 380, 6],
    ],
  },
};

export const SEGMENTS = 55;          // physics points = SEGMENTS + 1

// Wide from 768 px: the hero copy moves to the top left there.
export const WIDE_QUERY = '(min-width: 768px)';

// The socket's centre in the hero, in px, without the transforms the
// entrance, the scroll exit or a hover put on the copy. When the socket is
// hidden (reduced motion shows an arrow instead), where it would be: 28 px in
// from the button's right edge, halfway down.
export function socketIn(hero) {
  const btn = hero.querySelector('.plugin__btn');
  const sock = hero.querySelector('.plugin__socket');
  if (!btn) return null;
  const h = hero.getBoundingClientRect();
  let x, y;
  if (sock && sock.offsetParent) {
    const r = sock.getBoundingClientRect();
    x = r.left + r.width / 2; y = r.top + r.height / 2;
  } else {
    const r = btn.getBoundingClientRect();
    x = r.right - 28; y = r.top + r.height / 2;
  }
  for (let el = (sock && sock.offsetParent) ? sock : btn; el && el !== hero; el = el.parentElement) {
    const t = getComputedStyle(el).transform;
    if (t && t !== 'none') { const m = new DOMMatrixReadOnly(t); x -= m.m41; y -= m.m42; }
  }
  return { x: x - h.left, y: y - h.top };
}

// Scale and offset (px) of the frame in a hero of w × h px whose socket is at
// sock: frame point (fx, fy) is drawn at (ox + fx * s, oy + fy * s).
export function placeFrame(name, w, h, sock) {
  const F = FRAMES[name];
  const s = name === 'wide' ? Math.min(h / F.h, (w * 0.64) / F.w) : Math.min(w / F.w, h / F.h);
  return { s, ox: sock.x - F.socket[0] * s, oy: sock.y - F.socket[1] * s };
}
