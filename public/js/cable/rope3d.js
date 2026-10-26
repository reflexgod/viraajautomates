// Verlet physics for one thick cable, in 3D.
// Pure maths, no DOM: runs in the Web Worker and in Node scripts.
//
// The cable remembers its resting curl: besides keeping each segment's
// length, it keeps the distance between points two and four apart, which
// gives it the stiffness of a heavy braided cord, and a soft spring draws
// every point back towards where it rests, so the composition holds while
// the cable sways, gives way to the pointer and can be pulled.
// Point 0 is fixed off screen; the last point is the plug, resting near
// the bottom.

import { SEGMENTS } from './layout.js';

export const N = SEGMENTS + 1;
export const PHYS = {
  dt: 1 / 120,       // fixed 120 Hz step
  maxSteps: 4,
  gravity: 260,      // weight, felt mostly when the cable is pulled
  home: 0.012,       // pull back towards the resting shape, per step
  damping: 0.988,
  passes: 10,
  bend2: 0.8,        // stiffness between points two apart
  bend4: 0.35,       // and four apart
  pushRadius: 170,  // frame units; the page sends 160 px converted at the current scale
  pushStrength: 0.55,
  breeze: 1600,     // sideways sway, frame units / s^2 at its strongest
};

// The house easing, cubic-bezier(.22, 1, .36, 1), solved numerically.
export function houseEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const bx = (s) => 3 * 0.22 * s * (1 - s) ** 2 + 3 * 0.36 * s * s * (1 - s) + s ** 3;
  const by = (s) => 3 * s * (1 - s) ** 2 + 3 * s * s * (1 - s) + s ** 3;
  let lo = 0, hi = 1, s = t;
  for (let i = 0; i < 20; i++) { s = (lo + hi) / 2; if (bx(s) < t) lo = s; else hi = s; }
  return by(s);
}

const cr = (p0, p1, p2, p3, t) =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

// Resample the authored path into N points spaced evenly along its length.
export function restShape(path) {
  const dense = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[Math.max(i - 1, 0)], p1 = path[i], p2 = path[i + 1], p3 = path[Math.min(i + 2, path.length - 1)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24;
      dense.push([0, 1, 2].map((a) => cr(p0[a], p1[a], p2[a], p3[a], t)));
    }
  }
  dense.push(path[path.length - 1]);
  const acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(...[0, 1, 2].map((a) => dense[i][a] - dense[i - 1][a])));
  const total = acc[acc.length - 1];
  const out = new Float32Array(N * 3);
  let j = 0;
  for (let k = 0; k < N; k++) {
    const target = (total * k) / (N - 1);
    while (j < acc.length - 2 && acc[j + 1] < target) j++;
    const f = (target - acc[j]) / (acc[j + 1] - acc[j] || 1);
    for (let a = 0; a < 3; a++) out[k * 3 + a] = dense[j][a] + (dense[j + 1][a] - dense[j][a]) * f;
  }
  return { points: out, length: total };
}

const dist = (p, i, j) => Math.hypot(p[j * 3] - p[i * 3], p[j * 3 + 1] - p[i * 3 + 1], p[j * 3 + 2] - p[i * 3 + 2]);

export function createSim(frame) {
  const { points } = restShape(frame.path);
  const rest1 = [], rest2 = [], rest4 = [];
  for (let i = 0; i < N - 1; i++) rest1.push(dist(points, i, i + 1));
  for (let i = 0; i < N - 2; i++) rest2.push(dist(points, i, i + 2));
  for (let i = 0; i < N - 4; i++) rest4.push(dist(points, i, i + 4));
  const last = (N - 1) * 3;
  return {
    home: points,
    pos: points.slice(),
    prev: points.slice(),
    rest1, rest2, rest4,
    anchor: [points[0], points[1], points[2]],
    plugHome: [points[last], points[last + 1], points[last + 2]],
    plug: [points[last], points[last + 1], points[last + 2]],
    plugAnim: null,      // { from, t, dur } while the plug returns home
    held: -1,            // index of the point being held, or -1
    hold: [0, 0],
    level: 0,            // 0..1: the plug's end lies level, pointing left (the Plug-in button)
    pointer: { x: 0, y: 0, active: false },
    pushRadius: PHYS.pushRadius,
    lift: 0,          // 0 = at rest, 1 = hanging LIFT above it (entrance and exit)
    liftBy: 1000,     // frame units for lift = 1
    t: 0,
    acc: 0,
  };
}

function solve(p, i, j, rest, k, wi, wj) {
  const a = i * 3, b = j * 3;
  const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
  const d = Math.hypot(dx, dy, dz) || 0.0001;
  const w = wi + wj;
  if (!w) return;
  const s = ((d - rest) / d) * k / w;
  if (wi) { p[a] += dx * s * wi; p[a + 1] += dy * s * wi; p[a + 2] += dz * s * wi; }
  if (wj) { p[b] -= dx * s * wj; p[b + 1] -= dy * s * wj; p[b + 2] -= dz * s * wj; }
}

function stepOnce(sim) {
  const { dt, gravity, damping, passes, bend2, bend4, pushStrength, home, breeze } = PHYS;
  const { pos: p, prev: q, pushRadius } = sim;
  const g = gravity * dt * dt;
  const last = N - 1;
  const ptr = sim.pointer;
  sim.t += dt;
  // Breeze: two slow sine waves (14 s and 33 s) so the sway never visibly loops.
  const wind = breeze * dt * dt * (0.6 * Math.sin((sim.t * 2 * Math.PI) / 14) + 0.4 * Math.sin((sim.t * 2 * Math.PI) / 33 + 1.3));
  const up = sim.lift * sim.liftBy;

  if (sim.plugAnim) {
    const a = sim.plugAnim;
    a.t = Math.min(a.t + dt, a.dur);
    const e = houseEase(a.t / a.dur);
    for (let k = 0; k < 3; k++) sim.plug[k] = a.from[k] + (sim.plugHome[k] - a.from[k]) * e;
    if (a.t >= a.dur) sim.plugAnim = null;
  }

  for (let i = 1; i < last; i++) {
    const a = i * 3;
    for (let k = 0; k < 3; k++) {
      const v = (p[a + k] - q[a + k]) * damping;
      q[a + k] = p[a + k];
      p[a + k] += v;
    }
    p[a + 1] += g;
    p[a] += wind * Math.sin((Math.PI * i) / last);
    p[a] += (sim.home[a] - p[a]) * home;
    p[a + 1] += (sim.home[a + 1] - up - p[a + 1]) * home;
    p[a + 2] += (sim.home[a + 2] - p[a + 2]) * home;
    if (ptr.active) {
      const dx = p[a] - ptr.x, dy = p[a + 1] - ptr.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001 && d < pushRadius) {
        const f = (1 - d / pushRadius) ** 2 * pushStrength;
        p[a] += (dx / d) * f;
        p[a + 1] += (dy / d) * f;
      }
    }
  }

  const pin = () => {
    p[0] = sim.anchor[0]; p[1] = sim.anchor[1] - up; p[2] = sim.anchor[2];
    const l = last * 3;
    if (sim.held === last) { p[l] = sim.hold[0]; p[l + 1] = sim.hold[1]; }
    else { p[l] = sim.plug[0]; p[l + 1] = sim.plug[1] - up; p[l + 2] = sim.plug[2]; }
    // Level: the three points behind the plug lie in a line to its right, so the
    // plug points left, into a socket. Blended in by sim.level.
    if (sim.held === last && sim.level > 0) {
      for (let j = 1; j <= 3; j++) {
        const a = (last - j) * 3;
        p[a] += (sim.hold[0] + sim.rest1[last - j] * j - p[a]) * sim.level;
        p[a + 1] += (sim.hold[1] - p[a + 1]) * sim.level;
      }
    }
    if (sim.held > 0 && sim.held < last) {
      const h = sim.held * 3;
      p[h] = sim.hold[0]; p[h + 1] = sim.hold[1];
    }
  };
  // Pinned points have zero weight in the constraints.
  const w = (i) => (i === 0 || i === last || i === sim.held || (sim.level >= 1 && sim.held === last && i >= last - 3) ? 0 : 1);

  for (let pass = 0; pass < passes; pass++) {
    pin();
    for (let i = 0; i < N - 1; i++) solve(p, i, i + 1, sim.rest1[i], 1, w(i), w(i + 1));
    for (let i = 0; i < N - 2; i++) solve(p, i, i + 2, sim.rest2[i], bend2, w(i), w(i + 2));
    for (let i = 0; i < N - 4; i++) solve(p, i, i + 4, sim.rest4[i], bend4, w(i), w(i + 4));
  }
  pin();
}

export function advance(sim, elapsed) {
  sim.acc = Math.min(sim.acc + elapsed, PHYS.dt * PHYS.maxSteps);
  while (sim.acc >= PHYS.dt) { stepOnce(sim); sim.acc -= PHYS.dt; }
}

export function settle(sim, seconds = 3) {
  for (let i = 0, n = Math.round(seconds / PHYS.dt); i < n; i++) stepOnce(sim);
}

// Hold the cable at point i and pull it to (x, y).
export function grab(sim, i, x, y, level = 0) {
  sim.held = i;
  sim.level = level;
  sim.hold[0] = x;
  sim.hold[1] = y;
  sim.plugAnim = null;
}

// Let go. A held plug glides back to where it rests.
export function release(sim, dur = 0.6) {
  const last = N - 1;
  if (sim.held === last) {
    const l = last * 3;
    sim.plug = [sim.pos[l], sim.pos[l + 1], sim.pos[l + 2]];
    sim.plugAnim = { from: sim.plug.slice(), t: 0, dur };
  }
  sim.held = -1;
  sim.level = 0;
}
