// Cable physics on its own thread, stepped at a fixed 120 Hz.
// Sends the cable's points to the page after each tick.
// (GitHub Pages cannot send the headers SharedArrayBuffer needs, so
// positions travel by postMessage with a transferred buffer.)
import { FRAMES } from './layout.js';
import { createSim, advance, settle, grab, release } from './rope3d.js';

let sim = null;
let timer = 0;
let last = 0;

function post() {
  const out = sim.pos.slice();
  postMessage(out, [out.buffer]);
}

function tick() {
  const now = performance.now();
  advance(sim, (now - last) / 1000);
  last = now;
  post();
}

onmessage = ({ data: m }) => {
  switch (m.type) {
    case 'init':
      sim = createSim(FRAMES[m.frame]);
      // Start where the page says: at rest, or lifted out of view for the drop-in.
      sim.liftBy = m.liftBy ?? sim.liftBy;
      sim.lift = m.lift ?? 0;
      for (let i = 1; i < sim.pos.length; i += 3) { sim.pos[i] -= sim.lift * sim.liftBy; sim.prev[i] = sim.pos[i]; }
      settle(sim, 2);
      post();
      break;
    case 'run':
      if (!timer) { last = performance.now(); timer = setInterval(tick, 1000 / 120); }
      break;
    case 'pause':
      clearInterval(timer);
      timer = 0;
      break;
    case 'pointer':
      sim.pointer.x = m.x;
      sim.pointer.y = m.y;
      sim.pointer.active = m.active;
      break;
    case 'scale':
      sim.pushRadius = m.pushRadius;
      sim.liftBy = m.lift;
      break;
    case 'lift':
      sim.lift = m.v;
      break;
    case 'grab':
      grab(sim, m.i, m.x, m.y);
      break;
    case 'release':
      release(sim);
      break;
  }
};
