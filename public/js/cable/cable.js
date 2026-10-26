// The hero object: one thick braided exchange cord, in WebGL.
// Physics runs in cable.worker.js; this file draws the cord, its plug and
// their shadows, and turns pointer input into push, grab and pull.
// Loaded only when motion is allowed and WebGL works; the still image
// underneath is the fallback.
import {
  WebGLRenderer, Scene, OrthographicCamera, Group, Mesh, BufferGeometry, BufferAttribute,
  PlaneGeometry, LatheGeometry, SphereGeometry,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, ShaderMaterial,
  HemisphereLight, DirectionalLight, CanvasTexture, Color, Vector2, Vector3, Matrix4,
  RepeatWrapping, SRGBColorSpace, NeutralToneMapping, VSMShadowMap, DoubleSide,
} from '../vendor/three.hero.js';
import { FRAMES } from './layout.js';
import { N } from './rope3d.js';

const WALL_Z = -90;          // the wall the cord hangs in front of
const GRAB_PX = 36;          // press within 36 px of the cord's centre line to take hold
const PUSH_PX = 160;         // the pointer pushes the cord within 160 px
// A mouse pushes the cord back as it comes near, so the cord settles out of GRAB_PX
// reach; with a mouse a press this close to the cord still takes hold.
const REACH_PX = 96;
const DRAG_PX = 320;         // a held point can be pulled up to 320 px from where it was taken
const LIFT = 1.25;           // entrance/exit: how far above its rest pose the cord hangs, in frame heights
const LONG_PRESS_MS = 260;   // touch: hold this long to take hold of the cord
const STRANDS = 18;          // braid carriers around the cord, each direction
const TILE_ALONG = 9;        // strands crossing one texture tile lengthways

// Light from the top left and in front; a warm rim from behind on the right.
const KEY = new Vector3(-520, 640, 720);
const RIM = new Vector3(760, 160, -380);

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// Setup is split into short tasks (renderer, materials, meshes, shader compile,
// first frame), so a phone's main thread is never blocked for long.
const pause = () => new Promise((res) => setTimeout(res, 0));
const cr = (p0, p1, p2, p3, t) =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

/* ---------- Braid texture: colour and height, drawn once ---------- */
// Two sets of strands spiral round the cord in opposite directions and pass
// over and under each other. All strands are cream, each a slightly
// different shade, so the cord reads as one fine, tight braid.
function braidTextures(size) {
  const W = size / 2, H = size; // W along the cord, H around it
  const colour = document.createElement('canvas');
  const height = document.createElement('canvas');
  colour.width = height.width = W;
  colour.height = height.height = H;
  const c = colour.getContext('2d'), h = height.getContext('2d');
  const ci = c.createImageData(W, H), hi = h.createImageData(W, H);
  const cream = [245, 237, 226], groove = [96, 72, 62];
  // Each strand is a slightly different shade of cream, as dyed yarn is.
  const tint = (lane) => 1 + 0.06 * (((Math.sin((((lane % 6) + 6) % 6) * 12.9898) * 43758.5453) % 1 + 1) % 1 - 0.5);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = x / W, t = y / H;
      const A = s * TILE_ALONG + t * STRANDS, B = s * TILE_ALONG - t * STRANDS;
      const ia = Math.floor(A), ib = Math.floor(B);
      const fa = A - ia, fb = B - ib;
      const aOver = ((ia + ib) & 1) === 0;
      // Each strand is a rounded ridge; along its length it arches over the
      // crossing strand and dips under the next.
      const ridgeA = Math.sin(Math.PI * fa) ** 0.55, ridgeB = Math.sin(Math.PI * fb) ** 0.55;
      const archA = Math.sin(Math.PI * fb), archB = Math.sin(Math.PI * fa);
      const hA = ridgeA * (aOver ? 0.62 + 0.38 * archA : 0.5 - 0.3 * archA);
      const hB = ridgeB * (aOver ? 0.5 - 0.3 * archB : 0.62 + 0.38 * archB);
      const top = hA >= hB;
      const hgt = Math.max(hA, hB);
      // Fine fibres running along each strand.
      const fibre = 0.92 + 0.08 * Math.sin((top ? fa : fb) * Math.PI * 22 + (top ? fb : fa) * 3);
      const lane = top ? ia : ib;
      const base = cream;
      const shade = Math.min(1, (0.55 + 0.45 * hgt) * fibre * tint(lane));
      const i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) ci.data[i + k] = groove[k] + (base[k] - groove[k]) * shade;
      ci.data[i + 3] = 255;
      const v = Math.round(hgt * fibre * 255);
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = v;
      hi.data[i + 3] = 255;
    }
  }
  c.putImageData(ci, 0, 0);
  h.putImageData(hi, 0, 0);
  return { colour, height };
}

// still: { x0, y0, x1, y1 } renders that region of the frame once, for the
// fallback image (scripts/make-cable-still.mjs). No input, no loop.
export async function createCable(hero, { frame: name, tier, still = null, lift = 0 }) {
  const F = FRAMES[name];
  const R = F.radius;
  const canvas = hero.querySelector('[data-cable-canvas]');
  const SAMPLES = tier.name === 'high' ? 260 : 180;
  const RADIAL = tier.name === 'high' ? 28 : 18;

  /* ---------- Physics worker ---------- */
  const worker = new Worker(new URL('./cable.worker.js', import.meta.url), { type: 'module' });
  let pos;
  try {
    pos = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('cable worker timed out')), 4000);
      worker.onmessage = (e) => { clearTimeout(t); resolve(e.data); };
      worker.onerror = (e) => { clearTimeout(t); reject(e); };
      worker.postMessage({ type: 'init', frame: name, lift, liftBy: LIFT * F.h });
    });
  } catch (err) {
    worker.terminate();
    throw err;
  }
  worker.onmessage = (e) => { pos = e.data; };

  /* ---------- Renderer and camera ---------- */
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!still });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  if (tier.realShadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
  }

  const scene = new Scene();
  // World units are frame units; world y is up, so y = -frameY.
  // The canvas covers the whole hero; the frame sits at its right edge
  // (and bottom edge on wide screens), scaled to fit.
  const camera = new OrthographicCamera(0, F.w, 0, -F.h, -2000, 2000);
  camera.position.z = 1000;
  const view = { s: 1, ox: 0, oy: 0 };

  function layout() {
    const w = hero.clientWidth, h = hero.clientHeight;
    if (still) {
      Object.assign(camera, { left: still.x0, right: still.x1, top: -still.y0, bottom: -still.y1 });
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      return;
    }
    const s = name === 'wide' ? Math.min(h / F.h, (w * 0.64) / F.w) : Math.min(w / F.w, h / F.h);
    const ox = w - F.w * s;
    const oy = name === 'wide' ? h - F.h * s : 0;
    Object.assign(view, { s, ox, oy });
    worker.postMessage({ type: 'scale', pushRadius: PUSH_PX / s, lift: LIFT * F.h });
    camera.left = -ox / s;
    camera.right = (w - ox) / s;
    camera.top = oy / s;
    camera.bottom = -(h - oy) / s;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  layout();
  await pause();

  /* ---------- Light ---------- */
  const centre = new Vector3(F.w * 0.55, -F.h * 0.5, 0);
  scene.add(new HemisphereLight(token('--cream') || '#F5EDE2', token('--ground') || '#2E1A22', 0.9));
  const key = new DirectionalLight(0xfff0e2, 2.6);
  key.position.copy(centre).add(KEY);
  key.target.position.copy(centre);
  const rim = new DirectionalLight(0xffcfae, 0.9);
  rim.position.copy(centre).add(RIM);
  rim.target.position.copy(centre);
  scene.add(key, key.target, rim, rim.target);

  const shadowTint = new Color(0x0c0407);
  // Shadow offset on the wall per unit of distance in front of it.
  const K = { x: -KEY.x / KEY.z, y: -KEY.y / KEY.z };

  if (tier.realShadows) {
    key.castShadow = true;
    const s = key.shadow;
    s.mapSize.set(tier.shadowMap, tier.shadowMap);
    const ext = Math.max(F.w, F.h) * 1.1;
    Object.assign(s.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 50, far: 3000 });
    s.camera.updateProjectionMatrix();
    s.radius = 16;
    s.blurSamples = 20;
    s.bias = -0.0005;
    const wall = new Mesh(new PlaneGeometry(F.w * 4, F.h * 4), new ShadowMaterial({ color: shadowTint, opacity: 0.55 }));
    wall.position.set(F.w * 0.5, -F.h * 0.5, WALL_Z);
    wall.receiveShadow = true;
    scene.add(wall);
  }

  /* ---------- Materials ---------- */
  const tex = braidTextures(tier.name === 'high' ? 512 : 256);
  const tileLen = (2 * Math.PI * R * TILE_ALONG) / STRANDS; // keeps strands at 45 degrees
  const colourMap = new CanvasTexture(tex.colour);
  colourMap.colorSpace = SRGBColorSpace;
  const heightMap = new CanvasTexture(tex.height);
  for (const t of [colourMap, heightMap]) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  const cordMat = new MeshPhysicalMaterial({
    map: colourMap,
    bumpMap: heightMap,
    bumpScale: 1.6,
    roughness: 0.82,
    sheen: 0.6,
    sheenRoughness: 0.5,
    sheenColor: new Color(0xfff1e0),
  });
  const bakelite = new MeshPhysicalMaterial({ color: 0xeee2cd, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.22 });
  const brass = new MeshStandardMaterial({ color: 0xc89b5c, metalness: 0.45, roughness: 0.3 });
  const collarMat = new MeshStandardMaterial({ color: new Color(token('--graphite') || '#141110'), roughness: 0.45 });
  // The plug's lamp glows cream: the palette is paper, ink and plum only.
  const lamp = new Color(token('--cream') || '#F5EDE2');
  const ledMat = new MeshBasicMaterial({ color: lamp });
  const haloMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: lamp }, uOpacity: { value: 0.8 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main() { float d = length((vUv - 0.5) * 2.0); float a = pow(max(1.0 - d, 0.0), 2.4); gl_FragColor = vec4(uColor, a * uOpacity); }`,
  });

  await pause();

  /* ---------- Cord ---------- */
  const ring = RADIAL + 1;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(SAMPLES * ring * 3), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(SAMPLES * ring * 3), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(SAMPLES * ring * 2), 2));
  const index = [];
  for (let s = 0; s < SAMPLES - 1; s++) {
    for (let r = 0; r < RADIAL; r++) {
      const a = s * ring + r, b = a + 1;
      index.push(a, b, a + ring, b, b + ring, a + ring);
    }
  }
  geo.setIndex(index);
  const cord = new Mesh(geo, cordMat);
  cord.castShadow = true;
  cord.frustumCulled = false;
  scene.add(cord);

  /* ---------- Plug: brass tip, dark collar, bakelite body, tapered boot ---------- */
  // Built along +Y from the tip; scaled to the cord.
  const k = F.plug ?? (R / 30) * 0.8;
  const profile = (pts) => pts.map(([r, y]) => new Vector2(r * k, y * k));
  const plug = new Group();
  const tip = new Mesh(new LatheGeometry(profile([[0, 0], [6, 2], [8, 10], [8, 38], [10, 40], [10, 46], [0, 46]]), 40), brass);
  const collar = new Mesh(new LatheGeometry(profile([[0, 46], [15, 46], [16, 48], [16, 58], [15, 60], [0, 60]]), 40), collarMat);
  const body = new Mesh(new LatheGeometry(profile([[0, 60], [21, 60], [24, 66], [25, 80], [25, 150], [23, 160], [0, 160]]), 48), bakelite);
  const boot = new Mesh(new LatheGeometry(profile([[0, 160], [21, 160], [17, 190], [R / k + 1, 228], [0, 228]]), 40), bakelite);
  const led = new Mesh(new SphereGeometry(3.4 * k, 16, 12), ledMat);
  led.position.set(0, 120 * k, 25 * k);
  const halo = new Mesh(new PlaneGeometry(46 * k, 46 * k), haloMat);
  halo.position.set(0, 120 * k, 27 * k);
  [tip, collar, body, boot].forEach((m) => { m.castShadow = true; plug.add(m); });
  plug.add(led, halo);
  plug.matrixAutoUpdate = false;
  scene.add(plug);
  const PLUG_LEN = 228 * k;

  /* ---------- Soft shadows for the cheaper tier ---------- */
  let ribbon = null, plugShadow = null;
  if (!tier.realShadows) {
    const rg = new BufferGeometry();
    rg.setAttribute('position', new BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3));
    const side = new Float32Array(SAMPLES * 2);
    for (let s = 0; s < SAMPLES; s++) { side[s * 2] = -1; side[s * 2 + 1] = 1; }
    rg.setAttribute('side', new BufferAttribute(side, 1));
    const ri = [];
    for (let s = 0; s < SAMPLES - 1; s++) { const a = s * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    rg.setIndex(ri);
    const softMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: { uColor: { value: shadowTint }, uOpacity: { value: 0.42 } },
      vertexShader: 'attribute float side; varying float vSide; void main() { vSide = side; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vSide;
        void main() { float a = 1.0 - smoothstep(0.0, 1.0, abs(vSide)); gl_FragColor = vec4(uColor, a * a * uOpacity); }`,
    });
    ribbon = new Mesh(rg, softMat);
    ribbon.frustumCulled = false;
    ribbon.renderOrder = -1;
    scene.add(ribbon);
    plugShadow = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: shadowTint }, uOpacity: { value: 0.4 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
        void main() { float d = length((vUv - 0.5) * 2.0); float a = 1.0 - smoothstep(0.2, 1.0, d); gl_FragColor = vec4(uColor, a * uOpacity); }`,
    }));
    plugShadow.renderOrder = -1;
    scene.add(plugShadow);
  }

  /* ---------- Per-frame geometry ---------- */
  const S = new Float32Array(SAMPLES * 3);
  const L = new Float32Array(SAMPLES);
  const T = new Vector3(), Nn = new Vector3(), B = new Vector3(), Z = new Vector3(0, 0, 1);

  function sample() {
    for (let s = 0; s < SAMPLES; s++) {
      const f = (s / (SAMPLES - 1)) * (N - 1);
      const i = Math.min(Math.floor(f), N - 2), t = f - i;
      const i0 = Math.max(i - 1, 0) * 3, i1 = i * 3, i2 = (i + 1) * 3, i3 = Math.min(i + 2, N - 1) * 3;
      S[s * 3] = cr(pos[i0], pos[i1], pos[i2], pos[i3], t);
      S[s * 3 + 1] = -cr(pos[i0 + 1], pos[i1 + 1], pos[i2 + 1], pos[i3 + 1], t);
      S[s * 3 + 2] = cr(pos[i0 + 2], pos[i1 + 2], pos[i2 + 2], pos[i3 + 2], t);
      L[s] = s ? L[s - 1] + Math.hypot(S[s * 3] - S[s * 3 - 3], S[s * 3 + 1] - S[s * 3 - 2], S[s * 3 + 2] - S[s * 3 - 1]) : 0;
    }
  }

  const tangent = (s, out) => {
    const a = Math.max(s - 1, 0) * 3, b = Math.min(s + 1, SAMPLES - 1) * 3;
    return out.set(S[b] - S[a], S[b + 1] - S[a + 1], S[b + 2] - S[a + 2]).normalize();
  };

  function buildCord() {
    const P = geo.attributes.position.array, Nm = geo.attributes.normal.array, U = geo.attributes.uv.array;
    // Parallel-transport frames, so the braid never twists or swims.
    tangent(0, T);
    Nn.crossVectors(T, Z).normalize();
    for (let s = 0; s < SAMPLES; s++) {
      tangent(s, T);
      Nn.addScaledVector(T, -T.dot(Nn)).normalize();
      B.crossVectors(T, Nn);
      const u = L[s] / tileLen;
      for (let r = 0; r <= RADIAL; r++) {
        const a = (r / RADIAL) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const nx = Nn.x * ca + B.x * sa, ny = Nn.y * ca + B.y * sa, nz = Nn.z * ca + B.z * sa;
        const v = (s * ring + r) * 3;
        P[v] = S[s * 3] + nx * R; P[v + 1] = S[s * 3 + 1] + ny * R; P[v + 2] = S[s * 3 + 2] + nz * R;
        Nm[v] = nx; Nm[v + 1] = ny; Nm[v + 2] = nz;
        U[(s * ring + r) * 2] = u;
        U[(s * ring + r) * 2 + 1] = r / RADIAL;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
  }

  // The plug's back sits at the cord's end; its body points away from the cord.
  const m4 = new Matrix4(), X = new Vector3(), Y = new Vector3(), Zp = new Vector3();
  const plugSpan = { x: 0, y: 0, dx: 0, dy: 0 }; // cord end and direction to the tip, frame units
  function placePlug(now) {
    const e = (SAMPLES - 1) * 3, b = (SAMPLES - 7) * 3;
    Y.set(S[b] - S[e], S[b + 1] - S[e + 1], S[b + 2] - S[e + 2]).normalize(); // tip -> cord
    X.crossVectors(Y, Z).normalize();
    Zp.crossVectors(X, Y);                                                    // faces the viewer
    const ox = S[e] - Y.x * PLUG_LEN, oy = S[e + 1] - Y.y * PLUG_LEN, oz = S[e + 2] - Y.z * PLUG_LEN;
    m4.makeBasis(X, Y, Zp).setPosition(ox, oy, oz);
    Object.assign(plugSpan, { x: S[e], y: -S[e + 1], dx: -Y.x, dy: Y.y });
    plug.matrix.copy(m4);
    plug.matrixWorldNeedsUpdate = true;
    // The light breathes slowly, like a line waiting; reaching for a socket, it brightens.
    glowNow += (glowTarget - glowNow) * 0.12;
    const breath = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(now / 1000 * Math.PI));
    haloMat.uniforms.uOpacity.value = breath + (1.6 - breath) * glowNow;
    halo.scale.setScalar(1 + 0.7 * glowNow);
    if (plugShadow) {
      const cx = ox + Y.x * PLUG_LEN / 2, cy = oy + Y.y * PLUG_LEN / 2, d = oz + Y.z * PLUG_LEN / 2 - WALL_Z;
      plugShadow.position.set(cx + d * K.x, cy + d * K.y, WALL_Z + 1);
      plugShadow.rotation.z = Math.atan2(Y.y, Y.x) - Math.PI / 2;
      plugShadow.scale.set(70 * k + d * 0.4, PLUG_LEN * 1.15 + d * 0.4, 1);
    }
  }

  function buildRibbon() {
    const P = ribbon.geometry.attributes.position.array;
    for (let s = 0; s < SAMPLES; s++) {
      tangent(s, T);
      const d = S[s * 3 + 2] - WALL_Z;
      const half = R * 1.25 + d * 0.22;
      let nx = T.y, ny = -T.x;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      const cx = S[s * 3] + d * K.x, cy = S[s * 3 + 1] + d * K.y, v = s * 6;
      P[v] = cx - nx * half; P[v + 1] = cy - ny * half; P[v + 2] = WALL_Z + 1;
      P[v + 3] = cx + nx * half; P[v + 4] = cy + ny * half; P[v + 5] = WALL_Z + 1;
    }
    ribbon.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------- Reaching for a socket (the hero's Plug-in button) ---------- */
  // The page asks the plug to swing to a point on screen: the cord's end is
  // held and its target eases there (0.6 s, or 0.25 s for the final snap).
  // The plug lies level and points left, so its tip arrives at the socket from
  // the right; before the snap it waits APPROACH px short of it.
  let glowNow = 0, glowTarget = 0;
  const APPROACH = 34;
  const reaching = { on: false, t0: 0, dur: 600, from: null, at: null, sock: null, snap: false };
  const easeIn = (t) => 1 - (1 - t) ** 3;
  const easeSnap = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));   // expo.out
  function reachGoal() {
    const s = toFrame({ clientX: reaching.sock.x, clientY: reaching.sock.y });
    return { x: s.x + PLUG_LEN + (reaching.snap ? 0 : APPROACH / view.s), y: s.y };
  }
  function stepReach(now) {
    if (!reaching.on) return;
    const t = Math.min(1, (now - reaching.t0) / reaching.dur);
    const g = reachGoal(), e = (reaching.snap ? easeSnap : easeIn)(t);
    reaching.at = { x: reaching.from.x + (g.x - reaching.from.x) * e, y: reaching.from.y + (g.y - reaching.from.y) * e };
    worker.postMessage({ type: 'grab', i: N - 1, x: reaching.at.x, y: reaching.at.y, level: reaching.snap ? 1 : e });
  }
  // sock: { x, y } in client px, or null to let go (the cord swings back on its own).
  function reach(sock, { snap = false } = {}) {
    if (held >= 0) return;
    if (!sock) {
      if (reaching.on) worker.postMessage({ type: 'release' });
      reaching.on = false;
      glowTarget = 0;
      return;
    }
    const from = reaching.on && reaching.at ? reaching.at : { x: plugSpan.x, y: plugSpan.y };
    Object.assign(reaching, { on: true, t0: performance.now(), dur: snap ? 250 : 600, from, sock, snap });
    glowTarget = 1;
    if (!running) draw(performance.now());
  }
  // A short brighten of the lamp (a tap on a phone).
  function glow(v = 1) { glowTarget = v; }
  // Is the plug on screen (and the cord drawn live)?
  function plugInView() {
    if (!running) return false;
    const r = hero.getBoundingClientRect();
    const x = r.left + view.ox + plugSpan.x * view.s, y = r.top + view.oy + plugSpan.y * view.s;
    return x > 0 && x < innerWidth && y > 0 && y < innerHeight;
  }

  function draw(now) {
    stepReach(now);
    sample();
    buildCord();
    placePlug(now);
    if (ribbon) buildRibbon();
    renderer.render(scene, camera);
  }

  /* ---------- Pointer: push, grab, pull ---------- */
  const toFrame = (e) => {
    const r = hero.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s };
  };
  // What is under p: the plug (held by its end, keeping the offset so it
  // doesn't jump) or the nearest point of the cord. Null if neither.
  function hit(p, reach = GRAB_PX) {
    const dx = plugSpan.dx, dy = plugSpan.dy;
    const along = (p.x - plugSpan.x) * dx + (p.y - plugSpan.y) * dy;
    if (along > -R && along < PLUG_LEN) {
      const across = Math.abs((p.x - plugSpan.x) * dy - (p.y - plugSpan.y) * dx);
      if (across < 34 * k) return { i: N - 1, ox: p.x - plugSpan.x, oy: p.y - plugSpan.y };
    }
    let best = -1, bestD = Math.max(R, reach / view.s);
    for (let i = 1; i < N; i++) {
      const d = Math.hypot(p.x - pos[i * 3], p.y - pos[i * 3 + 1]);
      if (d < bestD) { bestD = d; best = i; }
    }
    // Held where it is, so it does not jump to the pointer.
    return best < 0 ? null : { i: best, ox: p.x - pos[best * 3], oy: p.y - pos[best * 3 + 1] };
  }

  let held = -1, off = { x: 0, y: 0 }, longPress = 0, pressAt = null, pointerId = null, from = { x: 0, y: 0 };
  // A held point can travel at most DRAG_PX (screen) from where it was taken.
  const clampDrag = (p) => {
    const max = DRAG_PX / view.s, dx = p.x - from.x, dy = p.y - from.y, d = Math.hypot(dx, dy);
    return d <= max ? p : { x: from.x + (dx / d) * max, y: from.y + (dy / d) * max };
  };
  const setCursor = (word) => { if (word) hero.dataset.cursor = word; else delete hero.dataset.cursor; };
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onControl = (e) => e.target.closest('a, button, input, summary');

  function take(h, p, e) {
    held = h.i;
    off = { x: h.ox, y: h.oy };
    from = { x: p.x, y: p.y };
    setCursor('Pull');
    pointerId = e.pointerId;
    hero.classList.add('is-holding');
    try { hero.setPointerCapture(e.pointerId); } catch (err) { /* pointer gone */ }
    worker.postMessage({ type: 'pointer', x: 0, y: 0, active: false });
    worker.postMessage({ type: 'grab', i: held, x: p.x - off.x, y: p.y - off.y });
  }

  function onDown(e) {
    if (onControl(e)) return;
    const p = toFrame(e), h = hit(p, e.pointerType === 'mouse' ? REACH_PX : GRAB_PX);
    if (!h) return;
    if (e.pointerType === 'touch') {
      // A long press takes hold, so ordinary swipes still scroll the page.
      pressAt = { x: e.clientX, y: e.clientY };
      clearTimeout(longPress);
      longPress = setTimeout(() => { longPress = 0; take(h, p, e); navigator.vibrate?.(8); }, LONG_PRESS_MS);
    } else if (e.button === 0) {
      e.preventDefault();
      take(h, p, e);
    }
  }

  function onMove(e) {
    const p = toFrame(e);
    if (held >= 0) { const q = clampDrag(p); worker.postMessage({ type: 'grab', i: held, x: q.x - off.x, y: q.y - off.y }); return; }
    if (longPress && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 10) { clearTimeout(longPress); longPress = 0; }
    if (e.pointerType === 'mouse') {
      worker.postMessage({ type: 'pointer', x: p.x, y: p.y, active: true });
      if (fine) {
        const over = !onControl(e) && !!hit(p, REACH_PX);
        hero.classList.toggle('is-over-cable', over);
        setCursor(over ? 'Grab' : null);
      }
    }
  }

  function onUp() {
    clearTimeout(longPress);
    longPress = 0;
    if (held < 0) return;
    held = -1;
    hero.classList.remove('is-holding');
    setCursor(hero.classList.contains('is-over-cable') ? 'Grab' : null);
    try { hero.releasePointerCapture(pointerId); } catch (err) { /* already released */ }
    worker.postMessage({ type: 'release' });
  }

  const onLeave = () => {
    if (held >= 0) return;
    worker.postMessage({ type: 'pointer', x: 0, y: 0, active: false });
    hero.classList.remove('is-over-cable');
    setCursor(null);
  };
  const onTouchMove = (e) => { if (held >= 0) e.preventDefault(); };
  const onContext = (e) => { if (held >= 0 || longPress) e.preventDefault(); };

  if (!still) {
    hero.addEventListener('pointerdown', onDown);
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerup', onUp);
    hero.addEventListener('pointercancel', onUp);
    hero.addEventListener('pointerleave', onLeave);
    hero.addEventListener('touchmove', onTouchMove, { passive: false });
    hero.addEventListener('contextmenu', onContext);
  }

  /* ---------- Loop; pause when off screen ---------- */
  let raf = 0, running = false, visible = false;
  let fpsEl = null, frames = 0, fpsT = performance.now();
  if (new URLSearchParams(location.search).has('fps')) {
    fpsEl = document.createElement('div');
    fpsEl.className = 'cable-fps';
    hero.appendChild(fpsEl);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    draw(now);
    if (fpsEl) {
      frames++;
      if (now - fpsT > 1000) { fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps · ${tier.name}`; frames = 0; fpsT = now; }
    }
  }

  function update() {
    const should = visible && !document.hidden;
    if (should === running) return;
    running = should;
    if (running) { worker.postMessage({ type: 'run' }); raf = requestAnimationFrame(frame); }
    else { cancelAnimationFrame(raf); worker.postMessage({ type: 'pause' }); }
  }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); });
  const ro = new ResizeObserver(() => { layout(); if (!running) draw(performance.now()); });
  if (!still) {
    io.observe(hero);
    document.addEventListener('visibilitychange', update);
    ro.observe(hero);
  }

  // Warm up the shaders one mesh per task: render the real scene with only that
  // mesh shown (the canvas is still transparent), so each program compiles and
  // links in its own short task instead of all at once in the first frame.
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const shown = meshes.map((m) => m.visible);
  const seenMats = new Set();
  for (const m of meshes) {
    if (seenMats.has(m.material)) continue;
    seenMats.add(m.material);
    await pause();
    meshes.forEach((o) => { o.visible = o === m; });
    try { renderer.render(scene, camera); } catch (err) { /* the first real frame compiles it */ }
  }
  meshes.forEach((o, i) => { o.visible = shown[i]; });
  await pause();
  draw(performance.now());
  hero.classList.add('is-live');

  function destroy() {
    cancelAnimationFrame(raf);
    running = false;
    worker.terminate();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', update);
    hero.removeEventListener('pointerdown', onDown);
    hero.removeEventListener('pointermove', onMove);
    hero.removeEventListener('pointerup', onUp);
    hero.removeEventListener('pointercancel', onUp);
    hero.removeEventListener('pointerleave', onLeave);
    hero.removeEventListener('touchmove', onTouchMove);
    hero.removeEventListener('contextmenu', onContext);
    hero.classList.remove('is-live', 'is-holding', 'is-over-cable');
    fpsEl?.remove();
    scene.traverse((o) => {
      o.geometry?.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose());
    });
    colourMap.dispose();
    heightMap.dispose();
    renderer.dispose();
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); destroy(); }, { once: true });

  function setLift(v) { worker.postMessage({ type: 'lift', v }); }

  return { destroy, canvas, view, setLift, reach, glow, plugInView };
}
