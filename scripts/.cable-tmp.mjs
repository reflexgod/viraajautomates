import sharp from 'sharp';
import { FRAMES } from '../public/js/cable/layout.js';
import { createSim, settle, restShape, N, grab, release } from '../public/js/cable/rope3d.js';
const tiles = [];
for (const name of ['wide', 'tall']) {
  const F = FRAMES[name];
  const rest = restShape(F.path).points;
  const sim = createSim(F); settle(sim, 4);
  const pulled = createSim(F); const m = Math.round(N*0.45); grab(pulled, m, pulled.pos[m*3]-F.w*0.18, pulled.pos[m*3+1]+F.h*0.12); settle(pulled, 1.2);
  const draw = (p, color, op) => {
    const segs = [];
    for (let i = 0; i < N - 1; i++) segs.push({ z: (p[i*3+2] + p[i*3+5]) / 2, d: `M${p[i*3]} ${p[i*3+1]}L${p[i*3+3]} ${p[i*3+4]}` });
    segs.sort((a, b) => a.z - b.z);
    return segs.map(s => `<path d="${s.d}" stroke="#1a0d12" stroke-width="${F.radius*2+4}" stroke-linecap="round" opacity="${op}"/><path d="${s.d}" stroke="${color}" stroke-width="${F.radius*2}" stroke-linecap="round" opacity="${op}"/>`).join('');
  };
  tiles.push({ w: F.w, h: F.h, svg: `<rect width="${F.w}" height="${F.h}" fill="#2E1A22"/>${draw(rest, '#888', .35)}${draw(pulled.pos, '#C0612F', .7)}${draw(sim.pos, '#E9DCC6', 1)}<text x="12" y="24" fill="#FF6A2B" font-size="20" font-family="sans-serif">${name}</text>` });
}
const W = tiles[0].w + tiles[1].w + 40, H = Math.max(tiles[0].h, tiles[1].h);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" fill="none">${tiles.map((t, i) => `<svg x="${i ? tiles[0].w + 40 : 0}" width="${t.w}" height="${t.h}" overflow="hidden">${t.svg}</svg>`).join('')}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(process.env.SCR + '/cable-sim.png');
