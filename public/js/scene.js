// Three.js scene: sky with clouds, a Roman column wrapped in a grapevine, grape clusters at every stop.
// The camera position is a pure function of scroll progress (0..1), see cameraAt().
import * as THREE from 'three';
import { buildRome } from './rome.js';
import { BG_LAYER } from './layers.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ---------- dimensions (world units) ----------
const SHAFT_H = 16;          // shaft from y=0 to y=16
const SHAFT_R = 1.0;
const TAPER = 0.07;          // entasis: shaft gets 7% thinner towards the top
const FLUTES = 20;
const FLUTE_DEPTH = 0.045;
const BASE_Y = -1.5;         // bottom of plinth
const VINE_TOP = 15.2;
const VINE_BOTTOM = 0.7;
const VINE_TURNS = 4.25;
const VINE_THETA0 = Math.PI * 0.5;
const SKY_Y = 85; // starting camera height: high enough that the intro shows only sky
const CAM_LEAD = 0.85;   // camera angle relative to a cluster (radians); positive puts the cluster on the right edge

// Scroll phases as fractions of total progress. main.js recomputes them from screen heights (setPhases).
export const PHASE = { introEnd: 0.02, descentEnd: 0.1, stopsEnd: 0.92 };
const DWELL = 0.15; // share of each stop's scroll range during which the camera stays still (pages snap to each stop)

let taper = TAPER; // set to 0 for loaded models, whose stretched shafts are straight
const shaftRadius = (y) => SHAFT_R * (1 - taper * THREE.MathUtils.clamp(y / SHAFT_H, 0, 1));
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = THREE.MathUtils.lerp;

// Vine helix, t=0 at the top, t=1 at the bottom.
function vineAngle(t) { return VINE_THETA0 + t * VINE_TURNS * Math.PI * 2; }
function vineY(t) { return lerp(VINE_TOP, VINE_BOTTOM, t) + 0.12 * Math.sin(t * 31); }
function vinePoint(t, out = new THREE.Vector3(), extra = 0) {
  const y = vineY(t);
  const r = shaftRadius(y) + 0.055 + extra + 0.02 * Math.sin(t * 57);
  const a = vineAngle(t);
  return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
}

export function stopParams(count) {
  // Stops spread along the vine, leaving room above the first and below the last.
  return Array.from({ length: count }, (_, i) => 0.05 + (i * 0.9) / Math.max(1, count - 1));
}

// ---------- fonts: the same four styles as the page (see :root in style.css) ----------
const FONT = {
  regular: '"Cormorant Garamond", Georgia, serif',
  bold: '"Prata", "Cormorant Garamond", Georgia, serif',
  italic: '"EB Garamond", "Cormorant Garamond", Georgia, serif',
  script: '"Script Caps", "Great Vibes", "Cormorant Garamond", cursive', // «А» from Arizonia (style.css)
};
const FONTS_READY = document.fonts
  ? Promise.all(['16px Prata', 'italic 600 16px "EB Garamond"', 'italic 400 16px "EB Garamond"', 'italic 500 16px "EB Garamond"', '16px "Great Vibes"', '16px "Script Caps"', '16px "Cormorant Garamond"']
    .map((f) => document.fonts.load(f, 'АаZz').catch(() => {}))).then(() => document.fonts.ready)
  : Promise.resolve();

// ---------- procedural textures ----------
function marbleTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#efe6d3';
  g.fillRect(0, 0, 512, 512);
  // soft blotches
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 10 + Math.random() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = Math.random() < 0.5 ? '214,200,170' : '250,246,236';
    grd.addColorStop(0, `rgba(${tone},${0.10 + Math.random() * 0.12})`);
    grd.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // faint veins and cracks
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    g.strokeStyle = `rgba(150,130,100,${0.12 + Math.random() * 0.15})`;
    g.lineWidth = 0.6 + Math.random() * 1.2;
    g.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    g.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      x += (Math.random() - 0.5) * 50; y += 10 + Math.random() * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  const puffs = 9 + Math.floor(Math.random() * 5);
  for (let i = 0; i < puffs; i++) {
    const x = 50 + Math.random() * 156, y = 70 + (Math.random() - 0.3) * 40, r = 28 + Math.random() * 34;
    const grd = g.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.6, 'rgba(250,252,255,0.75)');
    grd.addColorStop(1, 'rgba(235,242,250,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- column ----------
function buildColumn(marble) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: marble, roughness: 0.82, metalness: 0 });

  // Fluted, slightly tapered shaft
  const shaft = new THREE.CylinderGeometry(SHAFT_R, SHAFT_R, SHAFT_H, FLUTES * 8, 24, true);
  const p = shaft.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i) + SHAFT_H / 2;
    const a = Math.atan2(z, x);
    const groove = Math.pow(0.5 + 0.5 * Math.cos(a * FLUTES), 0.7);
    const r = shaftRadius(y) - FLUTE_DEPTH * groove;
    p.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
  }
  shaft.computeVertexNormals();
  const uv = shaft.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 6);
  group.add(new THREE.Mesh(shaft, mat));

  const ring = (r, tube, y) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 16, 96), mat);
    m.rotation.x = Math.PI / 2; m.position.y = y; return m;
  };
  const box = (w, h, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat); m.position.y = y; return m;
  };

  // Base: two tori + plinth
  group.add(ring(SHAFT_R + 0.04, 0.09, 0.12));
  group.add(ring(SHAFT_R + 0.14, 0.16, -0.18));
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_R + 0.28, SHAFT_R + 0.3, 0.3, 64), mat).translateY(-0.45));
  group.add(box(2.9, 0.9, BASE_Y + 0.45));

  // Capital: astragal, flared bell, acanthus-like leaves, volutes, abacus
  const topR = shaftRadius(SHAFT_H);
  group.add(ring(topR + 0.03, 0.07, SHAFT_H + 0.05));
  const bellPts = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    bellPts.push(new THREE.Vector2(topR + 0.02 + 0.35 * k * k, SHAFT_H + 0.1 + k * 1.3));
  }
  group.add(new THREE.Mesh(new THREE.LatheGeometry(bellPts, 64), mat));

  const leafGeo = new THREE.SphereGeometry(1, 16, 12);
  for (let row = 0; row < 2; row++) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (row ? Math.PI / n : 0);
      const leaf = new THREE.Mesh(leafGeo, mat);
      const r = topR + 0.12 + row * 0.12;
      leaf.scale.set(0.16, 0.42 + row * 0.1, 0.08);
      leaf.position.set(Math.cos(a) * r, SHAFT_H + 0.45 + row * 0.42, Math.sin(a) * r);
      leaf.lookAt(leaf.position.x * 3, leaf.position.y, leaf.position.z * 3);
      leaf.rotateX(-0.35);
      group.add(leaf);
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const vol = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 12, 32), mat);
    vol.position.set(Math.cos(a) * 1.28, SHAFT_H + 1.25, Math.sin(a) * 1.28);
    vol.lookAt(0, vol.position.y, 0);
    vol.rotateY(Math.PI / 2);
    group.add(vol);
  }
  group.add(box(3.0, 0.38, SHAFT_H + 1.62));
  group.add(box(2.7, 0.1, SHAFT_H + 1.86));

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

// ---------- vine, leaves, grapes ----------
function leafShape() {
  // Simplified grape leaf: pointed tip, two side lobes, notch at the stem.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-0.25, 0.05, -0.55, 0.25, -0.45, 0.55);
  s.bezierCurveTo(-0.38, 0.62, -0.32, 0.6, -0.3, 0.72);
  s.bezierCurveTo(-0.22, 0.9, -0.08, 0.95, 0, 1.1);
  s.bezierCurveTo(0.08, 0.95, 0.22, 0.9, 0.3, 0.72);
  s.bezierCurveTo(0.32, 0.6, 0.38, 0.62, 0.45, 0.55);
  s.bezierCurveTo(0.55, 0.25, 0.25, 0.05, 0, 0);
  return s;
}

function buildVine(stopTs) {
  const group = new THREE.Group();

  // Main stem
  const pts = [];
  const N = 420;
  for (let i = 0; i <= N; i++) pts.push(vinePoint(-0.03 + (i / N) * 1.05));
  const curve = new THREE.CatmullRomCurve3(pts);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.9 });
  const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 1400, 0.05, 8, false), stemMat);
  stem.castShadow = true;
  group.add(stem);

  // Thin green shoot twisting around the stem
  const shootPts = [];
  for (let i = 0; i <= N; i++) {
    const t = -0.03 + (i / N) * 1.05;
    const base = vinePoint(t);
    const a = t * 260;
    shootPts.push(base.add(new THREE.Vector3(Math.cos(a) * 0.07, Math.sin(a) * 0.07, Math.sin(a) * 0.05)));
  }
  const shoot = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shootPts), 2000, 0.018, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x7d9a3c, roughness: 0.8 }),
  );
  shoot.castShadow = true;
  group.add(shoot);

  // Leaves (instanced)
  const leafGeo = new THREE.ShapeGeometry(leafShape(), 6);
  leafGeo.translate(0, 0, 0);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide, vertexColors: false });
  const LEAVES = 120;
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, LEAVES);
  leaves.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const color = new THREE.Color();
  const greens = [0x6f8f2f, 0x7fa23a, 0x5d7a26, 0x8fae4a, 0x9a9f3c];
  const obj = new THREE.Object3D();
  for (let i = 0; i < LEAVES; i++) {
    const t = (i + Math.random() * 0.6) / LEAVES;
    vinePoint(t, pos, 0.04);
    const a = vineAngle(t);
    obj.position.copy(pos);
    // face outward from the column, tilt up/down alternately, random twist
    obj.lookAt(pos.x * 4, pos.y, pos.z * 4);
    obj.rotateZ((i % 2 ? 1 : -1) * (0.9 + Math.random() * 0.9));
    obj.rotateX(-0.5 + Math.random() * 0.6);
    const s = 0.28 + Math.random() * 0.16;
    obj.scale.set(s, s, s);
    obj.updateMatrix();
    leaves.setMatrixAt(i, obj.matrix);
    leaves.setColorAt(i, color.set(greens[i % greens.length]));
    void a;
  }
  group.add(leaves);

  // Grape clusters: one big cluster per stop + a few small decorative ones
  const grapeGeo = new THREE.SphereGeometry(1, 10, 8);
  const grapeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 });
  const decorTs = [];
  for (let i = 0; i < stopTs.length - 1; i++) decorTs.push((stopTs[i] + stopTs[i + 1]) / 2 + 0.02);
  const clusters = [...stopTs.map((t) => ({ t, big: true })), ...decorTs.map((t) => ({ t, big: false }))];
  const PER_BIG = 30, PER_SMALL = 12;
  const total = clusters.reduce((n, c) => n + (c.big ? PER_BIG : PER_SMALL), 0);
  const grapes = new THREE.InstancedMesh(grapeGeo, grapeMat, total);
  grapes.castShadow = true;
  const grapeColors = [0x5a2e5e, 0x4a2350, 0x6b3a6e, 0x52284f];
  const anchors = [];
  let k = 0;
  for (const c of clusters) {
    const top = vinePoint(c.t, new THREE.Vector3(), 0.14);
    const out = new THREE.Vector3(top.x, 0, top.z).normalize();
    const count = c.big ? PER_BIG : PER_SMALL;
    const len = c.big ? 0.75 : 0.4;
    const width = c.big ? 0.26 : 0.15;
    for (let i = 0; i < count; i++) {
      const f = i / count; // 0 = top of cluster, 1 = tip
      const r = width * (1 - f * 0.8) * Math.sqrt(Math.random());
      const ang = Math.random() * Math.PI * 2;
      pos.set(
        top.x + out.x * 0.12 + Math.cos(ang) * r,
        top.y - 0.05 - f * len,
        top.z + out.z * 0.12 + Math.sin(ang) * r,
      );
      const s = (c.big ? 0.075 : 0.06) * (0.85 + Math.random() * 0.3);
      m.compose(pos, q.identity(), sc.set(s, s * 1.08, s));
      grapes.setMatrixAt(k, m);
      grapes.setColorAt(k, color.set(grapeColors[(Math.random() * grapeColors.length) | 0]));
      k++;
    }
    if (c.big) {
      // anchor for the HTML tag: the middle of the cluster, slightly outward
      anchors.push({ pos: new THREE.Vector3(top.x + out.x * 0.2, top.y - len * 0.35, top.z + out.z * 0.2), out });
    }
  }
  group.add(grapes);
  return { group, anchors };
}

// ---------- clouds ----------
function buildClouds() {
  const group = new THREE.Group();
  const textures = Array.from({ length: 4 }, cloudTexture);
  // near: distance at which a cloud has fully faded out as the camera approaches it
  const add = (x, y, z, s, opacity = 1, near = 6) => {
    const mat = new THREE.SpriteMaterial({ map: textures[(Math.random() * 4) | 0], transparent: true, depthWrite: false, opacity, fog: false });
    const sp = new THREE.Sprite(mat);
    sp.position.set(x, y, z);
    sp.scale.set(s * 1.6, s, 1);
    sp.userData.baseOpacity = opacity;
    sp.userData.near = near;
    group.add(sp);
  };
  group.userData.add = add;
  // sky clouds around the starting camera
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 30;
    add(Math.cos(a) * r, SKY_Y - 14 + Math.random() * 16, Math.sin(a) * r, 6 + Math.random() * 10, 0.9);
  }
  return group;
}

// Volumetric cloud from lit, noise-displaced spheres. ~2.6 units wide, flat-ish bottom at y≈0.
function buildPuffyCloud(seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const geo = new THREE.SphereGeometry(1, 16, 12); // indexed → smooth normals after displacement
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.06 * Math.sin(v.x * 4.1 + v.y * 3.3) * Math.cos(v.z * 3.7 - v.y * 2.3);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, metalness: 0,
    emissive: 0xd6e2f0, emissiveIntensity: 0.55, // soft bluish undersides instead of dark shadows
    fog: false,
  });
  const group = new THREE.Group();
  const puffs = [
    // x, y, z, radius — a big central mound, shoulders on both sides, a flat skirt along the bottom
    [0, 0.42, 0, 0.62], [-0.55, 0.3, 0.1, 0.5], [0.58, 0.32, -0.05, 0.52], [-0.2, 0.62, -0.15, 0.45],
    [0.3, 0.66, 0.1, 0.42], [-1.0, 0.16, 0, 0.36], [1.02, 0.18, 0.05, 0.38], [-1.32, 0.04, -0.05, 0.24],
    [1.34, 0.06, 0, 0.25], [-0.3, 0.1, 0.35, 0.4], [0.35, 0.12, 0.38, 0.4], [0, 0.18, -0.35, 0.45],
  ];
  // small billows scattered over the upper surface make it fluffy instead of blobby
  for (let i = 0; i < 22; i++) {
    const [bx, by, bz, br] = puffs[(rnd() * 5) | 0];
    const a = rnd() * Math.PI * 2, el = 0.25 + rnd() * 1.0;
    puffs.push([bx + Math.cos(a) * Math.cos(el) * br, by + Math.sin(el) * br * 0.8, bz + Math.sin(a) * Math.cos(el) * br, 0.14 + rnd() * 0.14]);
  }
  for (const [x, y, z, r] of puffs) {
    const m = new THREE.Mesh(geo, mat);
    const j = 0.85 + rnd() * 0.3;
    m.position.set(x + (rnd() - 0.5) * 0.12, y, z);
    m.scale.set(r * j * 1.15, r * j * 0.85, r * j);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    group.add(m);
  }
  return group;
}

// ---------- countdown: solid rounded digits wrapped in cloud puffs ----------
// Each character = a bevelled 3D glyph (crisp, readable shape) + small cloud puffs along its outline.
// Units: 1 = digit height.
const FONT_URL = '/vendor/three/examples/fonts/helvetiker_bold.typeface.json';
const TITLE_FONT_URL = 'assets/fonts/cloud-title.typeface.json'; // Nunito Black, Cyrillic (tools/make-cloud-font.mjs)

function buildCloudCountdown(onReady) {
  const MAX_PUFFS = 2600, MAX_CHARS = 40;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, emissive: 0x9fb4cf, emissiveIntensity: 0.22, fog: false,
  });
  const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mat, MAX_PUFFS);
  puffs.count = 0;
  puffs.frustumCulled = false;
  const group = new THREE.Group();
  const inner = new THREE.Group(); // shifted so the block's bottom is at y=0
  inner.add(puffs);
  group.add(inner);
  const cores = Array.from({ length: MAX_CHARS }, () => {
    const m = new THREE.Mesh(undefined, mat);
    m.visible = false;
    inner.add(m);
    return m;
  });

  let font = null, titleFont = null, lastKey = '', pending = null;
  const glyphs = new Map();
  const layout = { labels: [], top: 0, height: 0 };

  function glyph(ch, title = false) {
    const key = (title ? 't:' : 'd:') + ch;
    if (glyphs.has(key)) return glyphs.get(key);
    const f = title ? titleFont : font;
    const DIGIT_H = 0.72; // cap height at size 1
    const size = 1 / DIGIT_H;
    const depth = 0.22;
    const geo = new TextGeometry(ch, { font: f, size, depth, curveSegments: 4, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.045, bevelSegments: 2 });
    geo.translate(0, 0, -depth / 2);
    // puff positions along the outline (outer contours and holes)
    const pts = [];
    for (const shape of f.generateShapes(ch, size)) {
      for (const path of [shape, ...shape.holes]) {
        const n = Math.max(6, Math.round(path.getLength() / 0.12));
        path.getSpacedPoints(n).slice(0, -1).forEach((p) => pts.push(p));
      }
    }
    const g = { geo, pts, advance: (f.data.glyphs[ch]?.ha ?? 600) / f.data.resolution * size + (title ? 0.02 : 0.06) };
    glyphs.set(key, g);
    return g;
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), tint = new THREE.Color();
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // rows: [{ groups: [{ text, label }], size }] top to bottom
  function set(rows, gap) {
    if (!font || !titleFont) { pending = [rows, gap]; return false; }
    const key = JSON.stringify(rows);
    if (key === lastKey) return false;
    lastKey = key;
    let n = 0, ci = 0, y = 0;
    layout.labels = [];
    for (const row of rows) {
      const S = row.size;
      const isTitle = typeof row.text === 'string';
      const pieces = [];
      if (isTitle) for (const ch of row.text) pieces.push({ ch, title: true });
      else row.groups.forEach((gr, gi) => {
        if (gi > 0) pieces.push({ ch: ':' });
        for (const ch of gr.text) pieces.push({ ch, group: gi });
      });
      const width = pieces.reduce((w, p) => w + glyph(p.ch, p.title).advance * S, 0);
      let x = -width / 2;
      y -= S;
      const span = (row.groups || []).map(() => ({ min: Infinity, max: -Infinity }));
      for (const p of pieces) {
        const gl = glyph(p.ch, p.title);
        const core = cores[ci++];
        if (core) {
          core.geometry = gl.geo;
          core.position.set(x, y, 0);
          core.scale.setScalar(S);
          core.visible = true;
        }
        seed = p.ch.charCodeAt(0) * 7919 + 1;
        for (const pt of gl.pts) {
          if (n >= MAX_PUFFS) break;
          const r = S * (0.075 + rnd() * 0.05);
          v.set(x + pt.x * S, y + pt.y * S, (rnd() - 0.5) * 0.12 * S);
          puffs.setMatrixAt(n, m4.compose(v, q, sc.set(r, r, r)));
          puffs.setColorAt(n++, tint.setHSL(0.6, 0.2, 0.86 + rnd() * 0.14));
        }
        if (p.group !== undefined) {
          span[p.group].min = Math.min(span[p.group].min, x);
          span[p.group].max = Math.max(span[p.group].max, x + gl.advance * S);
        }
        x += gl.advance * S;
      }
      (row.groups || []).forEach((gr, gi) => {
        layout.labels.push({ text: gr.label, pos: new THREE.Vector3((span[gi].min + span[gi].max) / 2, y - S * 0.2, 0) });
      });
      y -= row.gap ?? gap; // a row may set its own spacing below it
    }
    for (; ci < cores.length; ci++) cores[ci].visible = false;
    layout.height = -y - gap;
    puffs.count = n;
    puffs.instanceMatrix.needsUpdate = true;
    if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true;
    inner.position.y = layout.height;
    layout.labels.forEach((l) => { l.pos.y += layout.height; });
    layout.top = layout.height;
    return true;
  }

  const loader = new FontLoader();
  Promise.all([loader.loadAsync(FONT_URL), loader.loadAsync(TITLE_FONT_URL)]).then(([f, tf]) => {
    font = f; titleFont = tf;
    if (pending) { const [r, g] = pending; pending = null; set(r, g); onReady?.(); }
  }).catch((err) => console.warn('Countdown font failed to load:', err));

  return { group, set, layout };
}

// ---------- schedule clock hanging on the column ----------
// A flat wall clock with a bronze case, hung on two chains from a nail in the column. Its hand turns
// from event hour to event hour while scrolling; the current time and stage are written on the face.
const CLOCK_R = 0.8;     // face radius (world units)
const CLOCK_DEPTH = 0.09;

const hourAngle = (time) => ((parseInt(time, 10) % 12) / 12) * Math.PI * 2; // clockwise from 12 o'clock
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

function drawClockFace(canvas, items, motto) {
  const S = canvas.width, c = S / 2, R = S * 0.5;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, S, S);
  const P = (a, r) => [c + Math.sin(a) * r, c - Math.cos(a) * r]; // a: clockwise from 12 o'clock
  // enamel face
  const grd = g.createRadialGradient(c * 0.8, c * 0.7, R * 0.05, c, c, R);
  grd.addColorStop(0, '#fffaf0'); grd.addColorStop(0.75, '#f3ead6'); grd.addColorStop(1, '#e0d2b1');
  g.fillStyle = grd; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
  // engraved sunburst (guilloche) in the centre
  g.strokeStyle = 'rgba(176,141,60,.18)'; g.lineWidth = 1.2;
  for (let i = 0; i < 120; i++) { const a = (i / 120) * Math.PI * 2; g.beginPath(); g.moveTo(...P(a, R * 0.06)); g.lineTo(...P(a, R * 0.5)); g.stroke(); }
  for (let r = R * 0.12; r < R * 0.5; r += R * 0.045) { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
  // minute track
  const ring = (r, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); };
  ring(R * 0.94, 3, '#8a6a2a'); ring(R * 0.86, 2, '#8a6a2a');
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
    g.strokeStyle = big ? '#3b2a14' : '#6b5a3e'; g.lineWidth = big ? 5 : 2;
    g.beginPath(); g.moveTo(...P(a, R * (big ? 0.85 : 0.88))); g.lineTo(...P(a, R * 0.94)); g.stroke();
  }
  // numerals: event hours in gold, larger, with laurel accents
  const events = new Set(items.map((it) => parseInt(it.time, 10) % 12));
  ROMAN.forEach((num, h) => {
    const a = (h / 12) * Math.PI * 2, ev = events.has(h);
    const [x, y] = P(a, R * 0.74);
    g.save(); g.translate(x, y); // upright numerals: easier to read than ones turned around the dial
    g.font = `${S * (ev ? 0.07 : 0.055)}px ${FONT.bold}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (ev) { g.fillStyle = '#5c430e'; g.fillText(num, 2, 3); g.fillStyle = '#c99a3a'; }
    else g.fillStyle = '#3b2a14';
    g.fillText(num, 0, 0);
    if (ev) { // two little laurel leaves under the numeral
      g.fillStyle = '#7f9a45';
      for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * S * 0.03, S * 0.045, S * 0.016, S * 0.006, sd * 0.5, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  });
  // central rosette
  g.fillStyle = '#b89a5e'; g.beginPath(); g.arc(c, c, R * 0.06, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.ellipse(...P(a, R * 0.085), R * 0.03, R * 0.014, a, 0, Math.PI * 2); g.fill(); }
}

function drawClockText(canvas, item) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${H * 0.38}px ${FONT.bold}`;
  g.fillStyle = '#5f6f2c'; g.fillText(item.time, W / 2, H * 0.3);
  g.font = `${H * 0.36}px ${FONT.script}`;
  g.fillStyle = '#3b2a14'; g.fillText(item.title, W / 2, H * 0.74);
}

function buildHangingClock(cfg) {
  const bronze = new THREE.MeshStandardMaterial({ color: 0xa27a38, metalness: 0.75, roughness: 0.32 });
  const darkBronze = new THREE.MeshStandardMaterial({ color: 0x6e5126, metalness: 0.7, roughness: 0.4 });
  const clock = new THREE.Group(); // face looks along +z, 12 o'clock along +y

  // case and bezel
  const body = new THREE.Mesh(new THREE.CylinderGeometry(CLOCK_R * 1.06, CLOCK_R * 1.1, CLOCK_DEPTH, 96), darkBronze);
  body.rotation.x = Math.PI / 2; body.position.z = -CLOCK_DEPTH / 2;
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(CLOCK_R * 1.03, 0.05, 16, 120), bronze);
  bezel.position.z = 0.012;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(CLOCK_R * 0.985, 0.014, 8, 120), bronze);
  lip.position.z = 0.008;
  clock.add(body, bezel, lip);
  const stud = new THREE.SphereGeometry(0.03, 12, 8);
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2, m = new THREE.Mesh(stud, bronze);
    m.position.set(Math.sin(a) * CLOCK_R * 1.03, Math.cos(a) * CLOCK_R * 1.03, 0.055);
    clock.add(m);
  }

  // enamel face
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = 1024;
  drawClockFace(faceCanvas, cfg.items, cfg.motto);
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 8;
  const face = new THREE.Mesh(new THREE.CircleGeometry(CLOCK_R, 96), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.45 }));
  face.position.z = 0.002;
  clock.add(face);

  // current time + stage, written on the face (redrawn only when the stage changes)
  const textCanvas = document.createElement('canvas');
  textCanvas.width = 512; textCanvas.height = 256;
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.colorSpace = THREE.SRGBColorSpace; textTex.anisotropy = 8;
  const text = new THREE.Mesh(new THREE.PlaneGeometry(CLOCK_R * 1.05, CLOCK_R * 0.525), new THREE.MeshBasicMaterial({ map: textTex, transparent: true, toneMapped: false }));
  text.position.z = 0.006;
  clock.add(text);

  // ornate hand: slim spear with a diamond near the tip and a round counterweight
  const hs = new THREE.Shape();
  const L = CLOCK_R * 0.72;
  hs.moveTo(-0.016, -0.07); hs.lineTo(-0.012, L * 0.68); hs.lineTo(-0.06, L * 0.78); hs.lineTo(0, L); hs.lineTo(0.06, L * 0.78);
  hs.lineTo(0.012, L * 0.68); hs.lineTo(0.016, -0.07); hs.closePath();
  const handGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
  const hand = new THREE.Group();
  const handMesh = new THREE.Mesh(handGeo, darkBronze);
  hand.add(handMesh);
  hand.position.z = 0.03;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), bronze);
  cap.scale.z = 0.6; cap.position.z = 0.045;
  clock.add(hand, cap);

  // hanger: two chains up to a nail in the column
  const nail = new THREE.Vector3(0, CLOCK_R * 1.1 + 0.3, -0.13);
  const chainGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 6);
  for (const sx of [-1, 1]) {
    const from = new THREE.Vector3(sx * CLOCK_R * 0.55, CLOCK_R * 0.86, -0.02);
    const chain = new THREE.Mesh(chainGeo, darkBronze);
    chain.position.copy(from).add(nail).multiplyScalar(0.5);
    chain.scale.y = from.distanceTo(nail);
    chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nail.clone().sub(from).normalize());
    clock.add(chain);
  }
  const nailHead = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16), bronze);
  nailHead.rotation.x = Math.PI / 2; nailHead.position.copy(nail).setZ(nail.z + 0.02);
  clock.add(nailHead);

  clock.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  text.castShadow = false;

  // the event hours, unwrapped so the hand always turns clockwise
  const angles = [];
  cfg.items.forEach((it, i) => {
    let a = hourAngle(it.time);
    while (i > 0 && a <= angles[i - 1]) a += Math.PI * 2;
    angles.push(a);
  });
  let shownItem = -1;
  const showItem = (i) => {
    if (i === shownItem) return;
    shownItem = i;
    drawClockText(textCanvas, cfg.items[i]);
    textTex.needsUpdate = true;
    // write it on the half of the face the hand is NOT covering
    const a = angles[i] % (Math.PI * 2);
    const handDown = Math.cos(a) < 0.2; // hand points sideways or downwards
    text.position.y = handDown ? CLOCK_R * 0.38 : -CLOCK_R * 0.36;
  };
  FONTS_READY.then(() => {
    drawClockFace(faceCanvas, cfg.items, cfg.motto); faceTex.needsUpdate = true;
    const i = shownItem; shownItem = -1; showItem(Math.max(0, i));
  });
  showItem(0);

  const group = new THREE.Group();
  group.add(clock);
  return {
    group,
    clock,
    // pos: 0 ... items-1, fractional while the hand travels between two hours
    setHand(pos) {
      const i = Math.min(angles.length - 2, Math.max(0, Math.floor(pos)));
      hand.rotation.z = -lerp(angles[i], angles[i + 1], clamp01(pos - i));
      showItem(Math.round(Math.min(angles.length - 1, Math.max(0, pos))));
    },
  };
}

// ---------- venue signpost: carved arrow boards nailed to the column ----------
// The column acts as the post. Each board's face is ONE high-resolution canvas (wood, carving, lettering)
// mapped onto the extruded arrow, so the text is crisp and nothing floats in front of the board.
const SIGN_PX = 512; // canvas pixels per world unit


function arrowPoints(len, h, dir, inset = 0) {
  const tip = h * 0.45;
  // inset the outline (for the carved border groove); good enough for these convex arrows
  let pts = [[inset, -h / 2 + inset], [len - tip - inset * 0.4, -h / 2 + inset], [len - inset * 2.2, 0], [len - tip - inset * 0.4, h / 2 - inset], [inset, h / 2 - inset]];
  if (dir < 0) pts = pts.map(([x, y]) => [-x, y]).reverse(); // mirror, keeping the winding
  return pts;
}
function arrowShape(len, h, dir) {
  const s = new THREE.Shape();
  arrowPoints(len, h, dir).forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

// Paints the board face: weathered wood (or chipped green paint), a carved groove, carved lettering, ornaments.
function paintBoard(canvas, b) {
  const W = canvas.width, H = canvas.height, S = SIGN_PX;
  const g = canvas.getContext('2d');
  const minX = b.dir > 0 ? 0 : -b.len;
  const toPx = ([x, y]) => [(x - minX) * S, (b.h / 2 - y) * S];
  const path = (pts) => { g.beginPath(); pts.map(toPx).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  let seed = Math.round(b.len * 1000 + b.h * 77);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  g.clearRect(0, 0, W, H);
  g.save();
  path(arrowPoints(b.len, b.h, b.dir));
  g.clip();
  // --- wood base
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#d2a771'); base.addColorStop(0.5, '#c6995f'); base.addColorStop(1, '#b4854f');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < Math.round(H / 5); i++) { // grain along the board
    const y = rnd() * H;
    g.strokeStyle = `rgba(${95 + rnd() * 40},${58 + rnd() * 25},${28 + rnd() * 15},${0.12 + rnd() * 0.22})`;
    g.lineWidth = 0.8 + rnd() * 2.2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.012 + i) * 4 + (rnd() - 0.5) * 2);
    g.stroke();
  }
  for (let k = 0; k < Math.max(1, Math.round(b.len)); k++) { // knots
    const x = rnd() * W, y = H * (0.2 + rnd() * 0.6);
    g.fillStyle = 'rgba(105,62,28,.35)'; g.beginPath(); g.ellipse(x, y, 9, 5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(95,55,25,.35)'; g.lineWidth = 2;
    for (let r = 9; r < 34; r += 6) { g.beginPath(); g.ellipse(x, y, r * 1.9, r * 0.75, 0, 0, Math.PI * 2); g.stroke(); }
  }
  for (let k = 0; k < 3; k++) { // fine cracks
    const x = rnd() * W, y = rnd() * H;
    g.strokeStyle = 'rgba(60,32,14,.45)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + rnd() * 90, y + (rnd() - 0.5) * 8); g.stroke();
  }
  // --- chipped green paint for the map board
  if (b.map) {
    g.fillStyle = '#56682a'; g.fillRect(0, 0, W, H);
    const shade = g.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(255,255,255,.08)'); shade.addColorStop(1, 'rgba(0,0,0,.12)');
    g.fillStyle = shade; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 26; k++) { // chips showing the wood underneath, mostly near the edges
      const edge = rnd() < 0.7;
      const x = rnd() * W, y = edge ? (rnd() < 0.5 ? rnd() * H * 0.15 : H - rnd() * H * 0.15) : rnd() * H;
      g.fillStyle = `rgba(${190 + rnd() * 20},${150 + rnd() * 15},${100 + rnd() * 10},.85)`;
      g.beginPath();
      const r = 3 + rnd() * 9;
      for (let a = 0; a < 6; a++) g.lineTo(x + Math.cos(a) * r * (0.6 + rnd() * 0.6), y + Math.sin(a) * r * (0.6 + rnd() * 0.6));
      g.fill();
    }
  }
  // --- weathering: darker towards the edges
  path(arrowPoints(b.len, b.h, b.dir));
  g.lineWidth = S * 0.09; g.strokeStyle = b.map ? 'rgba(25,35,8,.35)' : 'rgba(85,48,18,.32)'; g.stroke();
  g.lineWidth = S * 0.03; g.strokeStyle = b.map ? 'rgba(20,28,6,.4)' : 'rgba(70,38,14,.4)'; g.stroke();
  // --- carved border groove (dark cut + light lower lip)
  const inset = Math.min(0.055, b.h * 0.12);
  g.save(); g.translate(1.5, 2);
  path(arrowPoints(b.len, b.h, b.dir, inset)); g.lineWidth = 3; g.strokeStyle = b.map ? 'rgba(200,215,150,.35)' : 'rgba(255,232,190,.5)'; g.stroke();
  g.restore();
  path(arrowPoints(b.len, b.h, b.dir, inset)); g.lineWidth = 3.5; g.strokeStyle = b.map ? '#c8a24a' : 'rgba(70,38,14,.75)'; g.stroke();

  // --- lettering area: the body of the arrow, away from the tip and the iron strap
  const bodyStart = 0.2, bodyEnd = b.len - b.h * 0.45 - 0.04;
  const bodyMid = (bodyStart + bodyEnd) / 2;
  const cx = ((b.dir > 0 ? bodyMid : -bodyMid) - minX) * S;
  const maxW = (bodyEnd - bodyStart) * S * 0.9;
  const n = b.lines.length;
  const lineH = (b.h - inset * 2) / n;
  b.lines.forEach((ln, i) => {
    const y = (inset + lineH * (i + 0.5)) * S + (n > 1 ? (i === 0 ? S * 0.01 : -S * 0.01) : 0);
    let size = ln.size * S;
    // italic lines in the italic face, the rest in the bold face (one weight only)
    const font = () => (ln.font.includes('italic') ? `italic 600 ${size}px ${FONT.italic}` : `${size * 0.9}px ${FONT.bold}`);
    g.font = font();
    while (g.measureText(ln.text).width > maxW && size > 10) { size -= 2; g.font = font(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (b.map) {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(ln.text, cx + 2, y + 3);
      g.fillStyle = '#fbf2dc'; g.fillText(ln.text, cx, y);
    } else {
      g.fillStyle = 'rgba(255,236,200,.55)'; g.fillText(ln.text, cx + 1, y + 2.5); // light lower lip of the cut
      g.fillStyle = '#2a1509'; g.fillText(ln.text, cx, y);                        // the cut itself
      g.lineWidth = 1; g.strokeStyle = 'rgba(20,8,2,.6)'; g.strokeText(ln.text, cx, y);
    }
    // ornaments around the main title
    if (ln.laurels) {
      const tw = g.measureText(ln.text).width;
      for (const sd of [-1, 1]) {
        const x0 = cx + sd * (tw / 2 + size * 0.45);
        g.strokeStyle = '#3a2010'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x0, y + size * 0.25); g.quadraticCurveTo(x0 + sd * size * 0.15, y - size * 0.05, x0, y - size * 0.35); g.stroke();
        g.fillStyle = 'rgba(58,32,16,.85)';
        for (let k = 0; k < 4; k++) {
          const ly = y + size * 0.2 - k * size * 0.16;
          g.save(); g.translate(x0 - sd * size * 0.06, ly); g.rotate(-sd * 0.7);
          g.beginPath(); g.ellipse(-sd * size * 0.1, 0, size * 0.1, size * 0.04, 0, 0, Math.PI * 2); g.fill(); g.restore();
        }
      }
    }
    if (ln.diamonds && i === 0 && n > 1) { // small carved diamonds between the address lines
      const yy = (inset + lineH) * S;
      g.fillStyle = 'rgba(58,32,16,.7)';
      for (const dx of [-0.32, 0, 0.32]) {
        g.save(); g.translate(cx + dx * maxW, yy); g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore();
      }
    }
  });
  g.restore();
}

function buildSignpost(venue) {
  const DEPTH = 0.07;
  const SIDE = new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.9 });        // end grain / edges
  const SIDE_GREEN = new THREE.MeshStandardMaterial({ color: 0x3f4d1c, roughness: 0.8 });
  const IRON = new THREE.MeshStandardMaterial({ color: 0x3e3630, metalness: 0.65, roughness: 0.45 });
  const boards = [
    // top board: the title, carved and painted like the others, pointing right (the grapes hang on the left)
    ...(venue.title ? [{ dir: 1, from: -0.25, len: 1.9, h: 0.36, y: 1.62, rot: 0.03, lines: [{ text: venue.title, font: 'italic 700', size: 0.2 }] }] : []),
    { dir: -1, from: 0.45, len: 1.95, h: 0.34, y: 1.0, rot: 0.05, lines: [{ text: 'ROMA · MMCD km', font: '700', size: 0.18 }] },
    { dir: 1, from: -0.85, len: 2.8, h: 0.66, y: 0.42, rot: -0.025, lines: [
      { text: venue.name ?? 'УСАДЬБА ГРЕБНЕВО', font: '700', size: 0.24, laurels: true },
      { text: venue.hall ?? 'банкетный зал «Лермонтов»', font: 'italic 700', size: 0.19 },
    ] },
    { dir: -1, from: 0.85, len: 2.8, h: 0.56, y: -0.26, rot: 0.03, lines: [
      { text: venue.addressLine1 ?? '', font: '700', size: 0.16, diamonds: true },
      { text: venue.addressLine2 ?? '', font: '700', size: 0.16 },
    ] },
    { dir: 1, from: -0.45, len: 2.05, h: 0.44, y: -0.9, rot: -0.04, map: true, lines: [{ text: 'На картах  →', font: '700', size: 0.21 }] },
  ];
  const group = new THREE.Group(); // boards in the xy plane, facing +z
  let mapCorners = null;
  for (const b of boards) {
    const board = new THREE.Group();
    const geo = new THREE.ExtrudeGeometry(arrowShape(b.len, b.h, b.dir), { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 3 });
    // map the face canvas over the arrow's bounding box (caps are group 0)
    const minX = b.dir > 0 ? 0 : -b.len;
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - minX) / b.len, (pos.getY(i) + b.h / 2) / b.h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(b.len * SIGN_PX); canvas.height = Math.round(b.h * SIGN_PX);
    paintBoard(canvas, b);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    FONTS_READY.then(() => { paintBoard(canvas, b); tex.needsUpdate = true; });
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: b.map ? 0.65 : 0.85 });
    const mesh = new THREE.Mesh(geo, [face, b.map ? SIDE_GREEN : SIDE]);
    mesh.castShadow = mesh.receiveShadow = true;
    board.add(mesh);
    // forged iron strap where the board meets the column, with two rivets
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.075, b.h + 0.05, DEPTH + 0.05), IRON);
    strap.position.set(b.dir * 0.11, 0, DEPTH / 2);
    board.add(strap);
    for (const ry of [-b.h * 0.3, b.h * 0.3]) {
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 6), IRON);
      rivet.scale.z = 0.6;
      rivet.position.set(b.dir * 0.11, ry, DEPTH + 0.03);
      board.add(rivet);
    }
    board.position.set(b.from, b.y, 0);
    board.rotation.z = b.rot;
    group.add(board);
    if (b.map) {
      board.updateMatrix();
      mapCorners = [[0, -b.h / 2], [b.len, -b.h / 2], [b.len, b.h / 2], [0, b.h / 2]]
        .map(([x, y]) => new THREE.Vector3(x * b.dir, y, DEPTH).applyMatrix4(board.matrix));
    }
  }
  return { group, mapCorners };
}

// ---------- dress code: silk ribbons tied around the column ----------
// Six satin ribbons (the palette) wrap the shaft, a bow in front, fluttering tails, and a paper tag with the text.
const TAG_PX = 512;

function wrapLines(g, text, maxW) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function paintPaper(g, W, H, S) {
  const r = S * 0.06, m = S * 0.02;
  // card with slightly rounded corners and a punched hole at the top
  g.beginPath(); g.roundRect(m, m, W - 2 * m, H - 2 * m, r);
  const paper = g.createLinearGradient(0, 0, W, H);
  paper.addColorStop(0, '#fffaf0'); paper.addColorStop(1, '#f1e6cf');
  g.fillStyle = paper; g.fill();
  g.lineWidth = 3; g.strokeStyle = '#d6c39b'; g.stroke();
  g.beginPath(); g.roundRect(m + S * 0.05, m + S * 0.05, W - 2 * m - S * 0.1, H - 2 * m - S * 0.1, r * 0.6);
  g.lineWidth = 2.5; g.strokeStyle = '#c4a463'; g.stroke();
  g.fillStyle = 'rgba(160,130,90,.08)';
  for (let i = 0; i < 900; i++) g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); // paper fibre
  g.beginPath(); g.arc(W / 2, m + S * 0.11, S * 0.035, 0, Math.PI * 2);
  g.fillStyle = '#c9b48b'; g.fill();
  g.beginPath(); g.arc(W / 2, m + S * 0.11, S * 0.022, 0, Math.PI * 2);
  g.globalCompositeOperation = 'destination-out'; g.fill(); g.globalCompositeOperation = 'source-over';
}

// Paints the paper tag; returns the button area («Примеры образов») in tag units for the HTML link.
function paintTag(canvas, d, looksOpen = false) {
  const W = canvas.width, H = canvas.height, S = TAG_PX;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  const m = S * 0.02;
  paintPaper(g, W, H, S);

  const cx = W / 2, maxW = W - S * 0.32;
  let y = S * 0.3;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#3b2a14'; g.font = `${S * 0.18}px ${FONT.script}`;
  g.fillText(d.title, cx, y); y += S * 0.16;
  g.fillStyle = '#6b5a3e'; g.font = `italic 600 ${S * 0.078}px ${FONT.italic}`;
  for (const ln of wrapLines(g, 'Просим вас соблюсти цветовую гамму', maxW)) { g.fillText(ln, cx, y); y += S * 0.088; }
  // palette dots
  y += S * 0.05;
  const n = d.colors.length, dot = S * 0.065, gap = S * 0.035, row = n * dot * 2 + (n - 1) * gap;
  d.colors.forEach((c, i) => {
    const x = cx - row / 2 + dot + i * (dot * 2 + gap);
    g.beginPath(); g.arc(x, y, dot, 0, Math.PI * 2); g.fillStyle = c; g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(60,40,20,.25)'; g.stroke();
  });
  y += S * 0.16;
  const block = (label, text) => {
    g.textAlign = 'center';
    g.fillStyle = '#3b2a14'; g.font = `${S * 0.125}px ${FONT.script}`;
    g.fillText(label, cx, y); y += S * 0.1;
    g.fillStyle = '#2f2010'; g.font = `${S * 0.064}px ${FONT.bold}`;
    for (const ln of wrapLines(g, text, maxW)) { g.fillText(ln, cx, y); y += S * 0.08; }
    y += S * 0.045;
  };
  block('Девушки', d.women);
  block('Мужчины', d.men);
  // button
  const bw = S * 0.78, bh = S * 0.15, bx = cx - bw / 2, by = H - m - S * 0.06 - bh - S * 0.02;
  g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.fillStyle = '#5f6f2c'; g.fill();
  g.fillStyle = '#fff8e6'; g.font = `${S * 0.066}px ${FONT.bold}`;
  g.fillText(looksOpen ? '←  Скрыть примеры' : 'Примеры образов  →', cx, by + bh / 2 + 1);
  return { x: bx / S, y: by / S, w: bw / S, h: bh / S };
}

// The second card: example looks, drawn right onto the paper (photos load in as they arrive).
function paintLooks(canvas, d, images) {
  const W = canvas.width, H = canvas.height, S = TAG_PX;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  paintPaper(g, W, H, S);
  const cx = W / 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#3b2a14'; g.font = `${S * 0.155}px ${FONT.script}`;
  g.fillText('Примеры образов', cx, S * 0.27);
  const photo = (img, x, y, w, h) => {
    g.save();
    g.beginPath(); g.roundRect(x, y, w, h, S * 0.025); g.clip();
    if (img?.complete && img.naturalWidth) { // cover-fit
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
      g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    } else {
      g.fillStyle = '#efe4cc'; g.fillRect(x, y, w, h);
      g.fillStyle = '#a08a5e'; g.font = `italic ${S * 0.05}px ${FONT.italic}`;
      g.fillText('фото скоро', x + w / 2, y + h / 2);
    }
    g.restore();
    g.lineWidth = 2; g.strokeStyle = 'rgba(160,130,80,.5)';
    g.beginPath(); g.roundRect(x, y, w, h, S * 0.025); g.stroke();
  };
  const row = (label, imgs, y, h) => {
    g.fillStyle = '#3b2a14'; g.font = `${S * 0.115}px ${FONT.script}`;
    g.fillText(label, cx, y);
    const n = imgs.length, gap = S * 0.04, inner = W - S * 0.3;
    const w = (inner - gap * (n - 1)) / n;
    imgs.forEach((img, i) => photo(img, S * 0.15 + i * (w + gap), y + S * 0.07, w, h));
  };
  row('Девушки', images.women, S * 0.47, S * 0.55);
  row('Мужчины', images.men, S * 1.2, S * 0.5);
  g.fillStyle = '#8a7350'; g.font = `italic ${S * 0.045}px ${FONT.italic}`;
  g.fillText('нажмите на карточку, чтобы закрыть', cx, S * 1.82);
}

// One bow loop: a flat ribbon folded into a teardrop. The ribbon's face looks at the viewer; it is pinched
// at the knot, widest in the middle, and puffs out towards the viewer (z) so light slides over it.
function bowLoopGeometry(side) {
  const U = 48, V = 6;
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.22, 0.2, 0), new THREE.Vector3(0.48, 0.24, 0),
    new THREE.Vector3(0.6, 0.06, 0), new THREE.Vector3(0.5, -0.14, 0), new THREE.Vector3(0.24, -0.12, 0),
    new THREE.Vector3(0, 0, 0),
  ], false, 'centripetal');
  const centre = new THREE.Vector3(0.32, 0.04, 0);
  const pos = [], idx = [];
  for (let i = 0; i <= U; i++) {
    const u = i / U, p = path.getPoint(u);
    const bulge = Math.sin(Math.PI * u);
    const w = 0.15 * (0.3 + 0.7 * bulge);                  // pinched at the knot
    const inward = centre.clone().sub(p).setZ(0).normalize();
    for (let j = 0; j <= V; j++) {
      const v = j / V;                                       // 0 = outer edge, 1 = inner edge
      const q = p.clone().addScaledVector(inward, v * w);
      q.z = bulge * (0.16 - v * 0.08) + Math.sin(v * Math.PI) * 0.015 * bulge; // puffed, slightly cupped
      pos.push(q.x * side, q.y, q.z);
    }
  }
  for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
    const a = i * (V + 1) + j, b = a + V + 1;
    if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// A ribbon strip hanging from the top, with a swallowtail (V) cut at the free end.
function ribbonTailGeometry(width, len, segs) {
  const geo = new THREE.PlaneGeometry(width, len, 2, segs);
  geo.translate(0, -len / 2, 0);
  const pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) {
    if (Math.abs(pos.getY(k) + len) < 1e-4 && Math.abs(pos.getX(k)) < 1e-4) pos.setY(k, -len + width * 0.9); // the notch
  }
  return geo;
}

function satin(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.18, side: THREE.DoubleSide });
}

function buildRibbons(d) {
  const group = new THREE.Group(); // local frame: +z out of the column, +y up; origin at the bow's knot
  const colors = d.colors;
  // ribbon bands are built around the column axis, so they live in a separate group placed by the scene
  const bands = new THREE.Group();
  colors.forEach((c, i) => {
    const R = SHAFT_R + 0.014 + i * 0.003;
    const geo = new THREE.CylinderGeometry(R, R, 0.1, 128, 1, true);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) { // gentle wave so the bands look tied by hand
      const a = Math.atan2(pos.getZ(k), pos.getX(k));
      pos.setY(k, pos.getY(k) + (2.5 - i) * 0.105 + Math.sin(a * 2 + i * 0.7) * 0.035);
    }
    geo.computeVertexNormals();
    const band = new THREE.Mesh(geo, satin(c));
    band.receiveShadow = true;
    bands.add(band);
  });

  // bow: two flattened loops + knot, in champagne satin
  const bowMat = satin(colors[colors.length - 1]);
  for (const sd of [-1, 1]) {
    const loop = new THREE.Mesh(bowLoopGeometry(sd), bowMat);
    loop.position.set(sd * 0.04, 0.02, 0.06);
    loop.rotation.z = sd * 0.08;
    loop.castShadow = true;
    group.add(loop);
  }
  // knot: a short band of ribbon wrapped around the middle, with a crease
  const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.17, 24, 1), bowMat);
  knot.scale.z = 0.62; knot.position.set(0, 0.01, 0.17);
  const crease = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 24, Math.PI), satin('#5a1c06'));
  crease.rotation.z = Math.PI / 2; crease.scale.set(1, 1, 0.6); crease.position.set(0.0, 0.01, 0.2);
  group.add(knot, crease);
  // two bow tails with swallowtail ends
  for (const sd of [-1, 1]) {
    const t = new THREE.Mesh(ribbonTailGeometry(0.13, 0.55, 6), bowMat);
    t.position.set(sd * 0.03, -0.04, 0.16);
    t.rotation.set(0.25, sd * 0.2, sd * 0.32);
    t.castShadow = true;
    group.add(t);
  }

  // fluttering tails, one per colour, fanning out to both sides of the tag
  const tails = [];
  colors.forEach((c, i) => {
    const side = i % 2 === 0 ? -1 : 1, k = Math.floor(i / 2);
    const len = 1.5 + k * 0.28, segs = 28;
    const geo = ribbonTailGeometry(0.1, len, segs);
    const base = geo.attributes.position.array.slice();
    const tail = new THREE.Mesh(geo, satin(c));
    tail.position.set(side * (0.08 + k * 0.05), -0.02, 0.07 - k * 0.012);
    tail.rotation.z = side * (0.5 + k * 0.17);
    tail.castShadow = true;
    group.add(tail);
    tails.push({ mesh: tail, base, phase: i * 1.3, len });
  });

  // paper tag on a string below the knot
  const TW = 1.5, TH = 1.62;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(TW * TAG_PX); canvas.height = Math.round(TH * TAG_PX);
  let button = paintTag(canvas, d);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  FONTS_READY.then(() => { button = paintTag(canvas, d, false); tex.needsUpdate = true; });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide }));
  const tagHolder = new THREE.Group();
  tag.position.y = -TH / 2;
  tagHolder.add(tag);
  tagHolder.position.set(0, -0.32, 0.2);
  tagHolder.rotation.z = 0.04;
  group.add(tagHolder);

  // the looks card waits right behind the tag, like the back card of a hand
  const LW = 1.5, LH = 1.86;
  const looksCanvas = document.createElement('canvas');
  looksCanvas.width = Math.round(LW * TAG_PX); looksCanvas.height = Math.round(LH * TAG_PX);
  const images = { women: [], men: [] };
  const looksTex = new THREE.CanvasTexture(looksCanvas);
  looksTex.colorSpace = THREE.SRGBColorSpace; looksTex.anisotropy = 8;
  const repaintLooks = () => { paintLooks(looksCanvas, d, images); looksTex.needsUpdate = true; };
  let photosRequested = false;
  const loadPhotos = () => { // only when a guest actually opens the card: saves 1–3 MB for everyone else
    if (photosRequested) return;
    photosRequested = true;
    for (const [key, list] of [['women', d.womenImages || []], ['men', d.menImages || []]]) {
      for (const src of list) {
        const img = new Image();
        img.onload = repaintLooks;
        img.src = src;
        images[key].push(img);
      }
    }
  };
  repaintLooks();
  FONTS_READY.then(repaintLooks);
  const looks = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH), new THREE.MeshStandardMaterial({ map: looksTex, transparent: true, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide }));
  looks.position.y = -LH / 2;
  const looksHolder = new THREE.Group();
  looksHolder.add(looks);
  group.add(looksHolder);
  const shuffle = { open: false, t: 0, from: 0, start: 0 };
  let narrow = false; // phones: no room for the two cards side by side
  const placeCards = (e) => {
    if (narrow) {
      // the looks card comes out to the right, then swings in front of the tag; the tag slides away to the left
      tagHolder.position.set(lerp(0, -1.7, e), -0.32, 0.2);
      tagHolder.rotation.z = lerp(0.04, 0.12, e);
      looksHolder.position.set(Math.sin(Math.PI * e) * 1.1, -0.34 - Math.sin(Math.PI * e) * 0.1, lerp(0.17, 0.26, e));
      looksHolder.rotation.z = lerp(0.04, 0.0, e) - Math.sin(Math.PI * e) * 0.1;
    } else {
      // front tag slides a little left; the back card comes out to the right with a small dip and a turn,
      // staying behind the front card the whole time
      tagHolder.position.set(lerp(0, -0.55, e), -0.32, 0.2);
      tagHolder.rotation.z = lerp(0.04, 0.08, e);
      looksHolder.position.set(lerp(0, 0.88, e), -0.34 - Math.sin(Math.PI * e) * 0.12 + e * 0.04, 0.17);
      looksHolder.rotation.z = lerp(0.04, -0.1, e);
    }
    looksHolder.visible = e > 0.001;
  };
  placeCards(0);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a3a }));
  string.position.set(0, -0.17, 0.18);
  group.add(string);

  return {
    group, bands, tag, tagSize: { w: TW, h: TH }, getButton: () => button,
    isLooksOpen: () => shuffle.open,
    setNarrow(v) { narrow = v; placeCards(smooth(shuffle.t)); },
    isNarrow: () => narrow,
    looks, looksSize: { w: LW, h: LH },
    setLooksOpen(open) {
      if (open === shuffle.open) return;
      if (open) loadPhotos();
      shuffle.open = open;
      shuffle.from = shuffle.t;
      shuffle.start = performance.now();
      button = paintTag(canvas, d, open);
      tex.needsUpdate = true;
    },
    flutter(time) {
      // card shuffle (0.7 s, eased)
      const target = shuffle.open ? 1 : 0;
      if (shuffle.t !== target) {
        const k = Math.min(1, (performance.now() - shuffle.start) / 700);
        shuffle.t = lerp(shuffle.from, target, k);
        placeCards(smooth(shuffle.t));
      }
      for (const t of tails) {
        const arr = t.mesh.geometry.attributes.position.array;
        for (let v = 0; v < arr.length; v += 3) {
          const along = -t.base[v + 1] / t.len; // 0 at the bow, 1 at the free end
          const w = Math.sin(time * 2.2 + along * 6 + t.phase);
          arr[v] = t.base[v] + w * 0.05 * along;
          arr[v + 2] = t.base[v + 2] + Math.sin(time * 1.7 + along * 5 + t.phase) * 0.12 * along;
        }
        t.mesh.geometry.attributes.position.needsUpdate = true;
        t.mesh.geometry.computeVertexNormals();
      }
    },
  };
}

// ---------- details: a trattoria chalkboard hanging on the column ----------
// Slate board in a wooden frame, hung on a rope; grainy chalk lettering with icons; yellow chalk contacts.
const CHALK_PX = 512;
const CHALK_FONT = FONT.script;

// draws chalk-textured content: paint(ctx) on a scratch canvas, then eat away specks so it looks grainy
function chalkLayer(W, H, paint, grain = 0.32) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  paint(g);
  g.globalCompositeOperation = 'destination-out';
  const n = Math.round(W * H * 0.012);
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(0,0,0,${grain + Math.random() * 0.5})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
  }
  return c;
}

function chalkIcon(g, kind, x, y, s) {
  g.lineWidth = s * 0.09; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  if (kind === 'envelope') {
    g.rect(x - s * 0.5, y - s * 0.33, s, s * 0.66);
    g.moveTo(x - s * 0.5, y - s * 0.33); g.lineTo(x, y + s * 0.05); g.lineTo(x + s * 0.5, y - s * 0.33);
  } else if (kind === 'coins') {
    for (let k = 0; k < 3; k++) g.ellipse(x, y + s * 0.25 - k * s * 0.2, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
  } else if (kind === 'hush') {
    g.arc(x, y, s * 0.45, 0, Math.PI * 2);
    g.moveTo(x - s * 0.32, y - s * 0.32); g.lineTo(x + s * 0.32, y + s * 0.32);
  } else if (kind === 'music') {
    g.ellipse(x - s * 0.22, y + s * 0.3, s * 0.16, s * 0.12, -0.4, 0, Math.PI * 2);
    g.moveTo(x - s * 0.08, y + s * 0.28); g.lineTo(x - s * 0.08, y - s * 0.42); g.lineTo(x + s * 0.38, y - s * 0.3);
  }
  g.stroke();
}

// Paints the slate; returns tappable areas (board units, from the top-left) for the phone and Telegram.
function paintChalkboard(canvas, d) {
  const W = canvas.width, H = canvas.height, S = CHALK_PX;
  const g = canvas.getContext('2d');
  // slate with soft dust, erased smears and a lighter centre
  const bg = g.createRadialGradient(W * 0.45, H * 0.4, S * 0.1, W / 2, H / 2, Math.max(W, H) * 0.7);
  bg.addColorStop(0, '#3a4640'); bg.addColorStop(1, '#232b27');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { // wiped-off smears
    g.strokeStyle = `rgba(220,225,215,${0.025 + Math.random() * 0.04})`;
    g.lineWidth = S * (0.08 + Math.random() * 0.12); g.lineCap = 'round';
    g.beginPath();
    const x = Math.random() * W, y = Math.random() * H;
    g.moveTo(x, y); g.bezierCurveTo(x + S * 0.3, y - S * 0.2, x + S * 0.5, y + S * 0.2, x + S * (0.6 + Math.random() * 0.4), y + (Math.random() - 0.5) * S * 0.3);
    g.stroke();
  }
  for (let i = 0; i < W * H * 0.004; i++) { // dust
    g.fillStyle = `rgba(230,232,225,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }

  const WHITE = '#f1efe6', YELLOW = '#f0d27a';
  const pad = S * 0.12, maxW = W - pad * 2 - S * 0.2;
  const areas = {};
  const layer = chalkLayer(W, H, (c) => {
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(240,240,230,.45)'; c.shadowBlur = 2; // chalk dust halo
    // heading
    c.fillStyle = WHITE; c.strokeStyle = WHITE;
    c.textAlign = 'center';
    c.font = `${S * 0.2}px ${CHALK_FONT}`;
    c.fillText(d.title, W / 2, S * 0.24);
    c.lineWidth = S * 0.012;
    c.beginPath(); c.moveTo(W / 2 - S * 0.42, S * 0.37); c.quadraticCurveTo(W / 2, S * 0.4, W / 2 + S * 0.42, S * 0.35); c.stroke();
    // notes with icons
    // the list shrinks until it fits between the title and the contacts block
    const wrap = (text) => {
      let line = '';
      const lines = [];
      for (const w of text.split(' ')) { const t = line ? `${line} ${w}` : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
      lines.push(line);
      return lines;
    };
    const top = S * 0.68, bottom = H - S * 0.66; // top: below the title and the corner photo
    let fs = S * 0.078, laid;
    for (;;) {
      c.font = `italic 500 ${fs}px ${FONT.italic}`; // small lines: italic, script is too thin to read here
      laid = d.chalk.map((item) => wrap(item.text));
      const h = laid.reduce((sum, ls) => sum + ls.length * fs * 1.36, 0) + (laid.length - 1) * fs * 0.9;
      if (top + h <= bottom || fs < S * 0.05) break;
      fs -= S * 0.003;
    }
    let y = top;
    c.textAlign = 'left';
    d.chalk.forEach((item, k) => {
      c.strokeStyle = WHITE;
      chalkIcon(c, item.icon, pad + S * 0.08, y + S * 0.02, S * 0.13);
      laid[k].forEach((ln, i) => c.fillText(ln, pad + S * 0.22, y + i * fs * 1.36));
      y += laid[k].length * fs * 1.36 + fs * 0.9;
    });
    y = Math.max(y, bottom - fs * 0.2);
    // dashed chalk divider
    c.setLineDash([S * 0.03, S * 0.03]); c.lineWidth = S * 0.008; c.strokeStyle = WHITE;
    c.beginPath(); c.moveTo(pad, y); c.lineTo(W - pad, y); c.stroke(); c.setLineDash([]);
    // contacts in yellow chalk, with two outlined "buttons"
    y += S * 0.13;
    c.fillStyle = YELLOW; c.strokeStyle = YELLOW; c.textAlign = 'center';
    c.font = `${S * 0.12}px ${CHALK_FONT}`;
    c.fillText(`Организатор — ${d.organizer.name}`, W / 2, y);
    y += S * 0.16;
    const bw = (W - pad * 2 - S * 0.12) / 2, bh = S * 0.15;
    const buttons = [
      { key: 'phone', label: '☎ позвонить', x: pad },
      { key: 'telegram', label: '✈ Telegram', x: pad + bw + S * 0.12 },
    ];
    c.lineWidth = S * 0.012;
    c.font = `italic 600 ${S * 0.072}px ${FONT.italic}`;
    for (const b of buttons) {
      c.beginPath(); c.roundRect(b.x, y - bh / 2, bw, bh, bh * 0.35); c.stroke();
      c.fillText(b.label, b.x + bw / 2, y + 2);
      areas[b.key] = { x: b.x / S, y: (y - bh / 2) / S, w: bw / S, h: bh / S };
    }
    // a chalk pointer to the questionnaire below the column
    y += S * 0.2;
    c.font = `italic 600 ${S * 0.072}px ${FONT.italic}`;
    c.fillText('↓  Ниже — анкета гостя  ↓', W / 2, y);
  });
  g.drawImage(layer, 0, 0);
  return areas;
}

function buildChalkboard(d) {
  const BW = 1.75, BH = 2.3, F = 0.11, DEPTH = 0.06;
  const group = new THREE.Group(); // faces +z; origin at the board centre
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.8 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3e3630, metalness: 0.65, roughness: 0.45 });

  // frame: a rectangle with a hole, bevelled
  const outer = new THREE.Shape();
  outer.moveTo(-BW / 2 - F, -BH / 2 - F); outer.lineTo(BW / 2 + F, -BH / 2 - F); outer.lineTo(BW / 2 + F, BH / 2 + F); outer.lineTo(-BW / 2 - F, BH / 2 + F); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-BW / 2, -BH / 2); hole.lineTo(-BW / 2, BH / 2); hole.lineTo(BW / 2, BH / 2); hole.lineTo(BW / 2, -BH / 2); hole.closePath();
  outer.holes.push(hole);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }), wood);
  frame.castShadow = frame.receiveShadow = true;
  group.add(frame);

  // slate
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(BW * CHALK_PX); canvas.height = Math.round(BH * CHALK_PX);
  let areas = paintChalkboard(canvas, d);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  FONTS_READY.then(() => { areas = paintChalkboard(canvas, d); tex.needsUpdate = true; });
  const slate = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  slate.position.z = DEPTH * 0.4;
  slate.receiveShadow = true;
  group.add(slate);

  // chalk ledge with a stick of chalk and a felt eraser
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(BW * 0.9, 0.05, 0.14), darkWood);
  ledge.position.set(0, -BH / 2 - F - 0.01, DEPTH + 0.06);
  const chalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 1 }));
  chalk.rotation.z = Math.PI / 2 + 0.15; chalk.position.set(-0.45, -BH / 2 - F + 0.03, DEPTH + 0.08);
  const eraser = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.1), darkWood);
  eraser.position.set(0.45, -BH / 2 - F + 0.05, DEPTH + 0.07);
  const felt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.1), new THREE.MeshStandardMaterial({ color: 0x8f8a82, roughness: 1 }));
  felt.position.set(0.45, -BH / 2 - F + 0.003, DEPTH + 0.07);
  group.add(ledge, chalk, eraser, felt);

  // rope from two screw eyes on the top of the frame up to a nail in the column
  const nail = new THREE.Vector3(0, BH / 2 + F + 0.5, -0.12);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb08a55, roughness: 1 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 16), iron);
    eye.position.set(sx * BW * 0.32, BH / 2 + F + 0.03, DEPTH / 2);
    group.add(eye);
    const from = eye.position.clone();
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), ropeMat);
    rope.position.copy(from).add(nail).multiplyScalar(0.5);
    rope.scale.y = from.distanceTo(nail);
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nail.clone().sub(from).normalize());
    group.add(rope);
  }
  const nailHead = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), iron);
  nailHead.rotation.x = Math.PI / 2; nailHead.position.copy(nail).setZ(nail.z + 0.02);
  group.add(nailHead);

  group.traverse((o) => { if (o.isMesh && o !== slate) o.castShadow = true; });
  return { group, slate, size: { w: BW, h: BH }, getAreas: () => areas };
}

// ---------- small photos at the stops: a gilded frame and polaroids ----------
// The texture starts as a drawn placeholder and swaps to the real picture as soon as the file exists.
function photoTexture(src, aspect) {
  const c = document.createElement('canvas');
  c.width = 384; c.height = Math.round(384 / aspect);
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#efe4cc'); bg.addColorStop(1, '#ddcca8');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c9b48b'; // two silhouettes
  for (const [x, s] of [[0.38, 1], [0.62, 0.92]]) {
    g.beginPath(); g.arc(W * x, H * 0.42, H * 0.13 * s, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(W * x, H * 0.9, H * 0.24 * s, H * 0.3 * s, 0, Math.PI, 0); g.fill();
  }
  g.fillStyle = '#8a6a3a'; g.font = `italic ${H * 0.1}px ${FONT.italic}`; g.textAlign = 'center';
  g.fillText('фото', W / 2, H * 0.16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (src) {
    new THREE.TextureLoader().load(src, (t) => {
      // cover-fit the real photo into the frame's aspect
      const ia = t.image.width / t.image.height;
      if (ia > aspect) { t.repeat.set(aspect / ia, 1); t.offset.set((1 - aspect / ia) / 2, 0); } else { t.repeat.set(1, ia / aspect); t.offset.set(0, (1 - ia / aspect) / 2); }
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      mat.map = t; mat.needsUpdate = true;
    }, undefined, () => {});
  }
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  return mat;
}

// Small gilded picture frame (rounded rectangle) with a ring on top to hang it. w x h = the visible photo.
function buildFramedPhoto(src, w, h) {
  const g = new THREE.Group();
  const B = 0.05; // frame width
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.8, roughness: 0.3 });
  const rr = (shape, x, y, W, H, r) => {
    shape.moveTo(x + r, y); shape.lineTo(x + W - r, y); shape.quadraticCurveTo(x + W, y, x + W, y + r);
    shape.lineTo(x + W, y + H - r); shape.quadraticCurveTo(x + W, y + H, x + W - r, y + H);
    shape.lineTo(x + r, y + H); shape.quadraticCurveTo(x, y + H, x, y + H - r);
    shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  };
  const outer = rr(new THREE.Shape(), -w / 2 - B, -h / 2 - B, w + 2 * B, h + 2 * B, 0.06);
  outer.holes.push(rr(new THREE.Path(), -w / 2, -h / 2, w, h, 0.03));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 }), gold);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), photoTexture(src, w / h));
  photo.position.z = 0.012;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w + 2 * B, h + 2 * B), new THREE.MeshStandardMaterial({ color: 0x6e5126, metalness: 0.5, roughness: 0.5 }));
  back.position.z = -0.002;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20), gold);
  ring.position.set(0, h / 2 + B + 0.04, 0.02);
  g.add(back, photo, frame, ring);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.top = h / 2 + B + 0.08;
  g.userData.edge = h / 2 + B; // top edge of the frame
  g.userData.ring = ring;
  return g;
}

// Polaroid: white card with the photo, attached with a strip of tape or a brass pin.
function buildPolaroid(src, w, h, attach = 'tape') {
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.9 }));
  const pw = w * 0.86, ph = pw; // square photo, wider white strip at the bottom
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoTexture(src, 1));
  photo.position.set(0, h / 2 - (w - pw) / 2 - ph / 2, 0.0075);
  g.add(card, photo);
  if (attach === 'tape') {
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.45, 0.09), new THREE.MeshStandardMaterial({ color: 0xf0e2b8, transparent: true, opacity: 0.75, roughness: 0.8 }));
    tape.position.set(0, h / 2 - 0.01, 0.012);
    tape.rotation.z = 0.08;
    g.add(tape);
  } else {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshStandardMaterial({ color: 0xb08d3c, metalness: 0.8, roughness: 0.3 }));
    pin.position.set(0, h / 2 - 0.06, 0.025);
    g.add(pin);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Engraved plaque (bronze or wood) with one line of text.
function buildPlaque(text, w, h, style) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = Math.round(w * S); c.height = Math.round(h * S);
  const paint = () => {
    const g = c.getContext('2d'), W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    g.beginPath(); g.roundRect(2, 2, W - 4, H - 4, H * 0.28);
    let grd;
    if (style === 'bronze') {
      grd = g.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, '#f0d48a'); grd.addColorStop(0.45, '#b8913f'); grd.addColorStop(0.6, '#e3c06a'); grd.addColorStop(1, '#9a7428');
    } else {
      grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#d2a771'); grd.addColorStop(1, '#b4854f');
    }
    g.fillStyle = grd; g.fill();
    if (style !== 'bronze') { // wood grain
      for (let i = 0; i < 22; i++) {
        g.strokeStyle = `rgba(95,58,28,${0.1 + Math.random() * 0.18})`; g.lineWidth = 1 + Math.random() * 2;
        const y = Math.random() * H;
        g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3); g.stroke();
      }
    }
    // inner shading: darker edges, lighter middle, so the board reads as carved rather than flat
    g.save(); g.clip();
    const sh = g.createLinearGradient(0, 0, 0, H);
    sh.addColorStop(0, 'rgba(255,240,210,.18)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(40,20,5,.35)');
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
    const sv = g.createLinearGradient(0, 0, W, 0);
    sv.addColorStop(0, 'rgba(40,20,5,.3)'); sv.addColorStop(0.08, 'rgba(0,0,0,0)'); sv.addColorStop(0.92, 'rgba(0,0,0,0)'); sv.addColorStop(1, 'rgba(40,20,5,.3)');
    g.fillStyle = sv; g.fillRect(0, 0, W, H);
    g.restore();
    g.lineWidth = 3; g.strokeStyle = style === 'bronze' ? 'rgba(90,60,15,.6)' : 'rgba(70,38,14,.6)';
    g.beginPath(); g.roundRect(H * 0.12, H * 0.12, W - H * 0.24, H - H * 0.24, H * 0.18); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = H * 0.4; // engraved in the bold face: thin script doesn't read on metal or wood
    g.font = `${size}px ${FONT.bold}`;
    while (g.measureText(text).width > W * 0.84 && size > 10) { size -= 2; g.font = `${size}px ${FONT.bold}`; }
    g.fillStyle = style === 'bronze' ? 'rgba(255,240,200,.7)' : 'rgba(255,232,195,.6)';
    g.fillText(text, W / 2 + 1, H / 2 + 3);
    g.fillStyle = style === 'bronze' ? '#4a3208' : '#2a1509';
    g.fillText(text, W / 2, H / 2 + 1);
  };
  paint();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  FONTS_READY.then(() => { paint(); tex.needsUpdate = true; });
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: style === 'bronze' ? 0.35 : 0.85, metalness: style === 'bronze' ? 0.6 : 0 });
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.position.z = 0.018;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w * 0.97, h * 0.92, 0.03), new THREE.MeshStandardMaterial({ color: style === 'bronze' ? 0x8a6419 : 0x7a5530, metalness: style === 'bronze' ? 0.6 : 0, roughness: 0.6 }));
  // soft shadow on the column behind the plaque
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 96;
  const sg = sc.getContext('2d');
  sg.filter = 'blur(10px)'; sg.fillStyle = 'rgba(30,15,5,.55)'; sg.fillRect(22, 18, 212, 60);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, h * 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.position.set(0.04, -0.06, -0.025);
  g.add(shadow, body, face);
  if (style !== 'bronze') { // iron rivets, like on the other signpost boards
    const iron = new THREE.MeshStandardMaterial({ color: 0x3e3630, metalness: 0.65, roughness: 0.45 });
    for (const x of [-w / 2 + 0.09, w / 2 - 0.09]) {
      const rv = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), iron);
      rv.position.set(x, 0, 0.03);
      g.add(rv);
    }
  }
  g.traverse((o) => { if (o.isMesh && o !== shadow) o.castShadow = true; });
  return g;
}

// ---------- loaded column model ----------
// Bakes every mesh into world space, scales the model so the shaft radius matches SHAFT_R,
// stretches the shaft to y=0..SHAFT_H and moves the parts above/below it along with its ends.
function fitColumnModel(root, shaftName, stretchBand) {
  root.updateMatrixWorld(true);
  const parts = [];
  // Optimised models store vertices as small integers (KHR_mesh_quantization): turn every attribute back into
  // plain floats first, otherwise baking the world transform into them would clip the values.
  const toFloat = (geo) => {
    for (const [name, a] of Object.entries(geo.attributes)) {
      if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
      const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
      geo.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
    }
    return geo;
  };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geo = toFloat(o.geometry.clone()).applyMatrix4(o.matrixWorld);
    geo.computeBoundingBox();
    parts.push({ name: o.name, geo, material: o.material });
  });
  const shaft = shaftName && parts.find((p) => p.name.includes(shaftName));
  const out = new THREE.Group();

  if (stretchBand) {
    // Single-mesh models: stretch only a horizontal band (fractions of the model height) to the shaft height.
    const all = new THREE.Box3();
    parts.forEach((p) => all.union(p.geo.boundingBox));
    const y0 = lerp(all.min.y, all.max.y, stretchBand[0]), y1 = lerp(all.min.y, all.max.y, stretchBand[1]);
    let cx = 0, cz = 0, n = 0;
    const inBand = [];
    for (const p of parts) {
      const pos = p.geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y >= y0 && y <= y1) { cx += pos.getX(i); cz += pos.getZ(i); n++; inBand.push([pos.getX(i), pos.getZ(i)]); }
      }
    }
    cx /= n; cz /= n;
    const radii = inBand.map(([x, z]) => Math.hypot(x - cx, z - cz)).sort((a, b) => a - b);
    const s = SHAFT_R / radii[Math.floor(radii.length * 0.9)];
    const bandH = (y1 - y0) * s, k = SHAFT_H / bandH;
    for (const p of parts) {
      const pos = p.geo.attributes.position, nor = p.geo.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const yy = (pos.getY(i) - y0) * s;
        const inside = yy >= 0 && yy <= bandH;
        pos.setXYZ(i, (pos.getX(i) - cx) * s, yy < 0 ? yy : inside ? yy * k : SHAFT_H + yy - bandH, (pos.getZ(i) - cz) * s);
        if (nor && inside) {
          const v = new THREE.Vector3(nor.getX(i), nor.getY(i) / k, nor.getZ(i)).normalize();
          nor.setXYZ(i, v.x, v.y, v.z);
        }
      }
      pos.needsUpdate = true;
    }
  } else if (!shaft) {
    // No shaft given: uniform fit to the full column height, centred on the axis.
    const box = new THREE.Box3();
    parts.forEach((p) => box.union(p.geo.boundingBox));
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const s = (SHAFT_H + 1.91 - BASE_Y) / size.y;
    parts.forEach((p) => p.geo.translate(-c.x, -box.min.y, -c.z).scale(s, s, s).translate(0, BASE_Y, 0));
  } else {
    const sb = shaft.geo.boundingBox;
    const c = sb.getCenter(new THREE.Vector3());
    const radius = (sb.max.x - sb.min.x + sb.max.z - sb.min.z) / 4;
    const s = SHAFT_R / radius;
    const bottom = sb.min.y, top = sb.max.y, mid = c.y;
    const stretch = SHAFT_H / ((top - bottom) * s);
    for (const p of parts) {
      p.geo.translate(-c.x, 0, -c.z).scale(s, s, s);
      if (p === shaft) {
        p.geo.translate(0, -bottom * s, 0).scale(1, stretch, 1);
      } else {
        p.geo.computeBoundingBox();
        const below = p.geo.boundingBox.getCenter(new THREE.Vector3()).y < mid * s;
        // parts below follow the shaft's bottom end, parts above follow its (stretched) top end
        p.geo.translate(0, below ? -bottom * s : SHAFT_H - top * s, 0);
      }
    }
  }
  for (const p of parts) {
    p.geo.computeBoundingBox();
    p.geo.computeBoundingSphere();
    const m = new THREE.Mesh(p.geo, p.material);
    m.name = p.name;
    m.castShadow = m.receiveShadow = true;
    out.add(m);
  }
  return out;
}

// ---------- scene ----------
// stops: [{ kind: 'vine' | 'dial', weight, dial? }] — one entry per stop after the countdown
export function createScene(canvas, { stops, columnModel, colosseumModel, statueModel }) {
  const stopCount = stops.length;
  if (columnModel?.shaft || columnModel?.stretchBand) taper = 0;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // sun and casters never move: shadows are re-drawn only when a model loads
  renderer.shadowMap.needsUpdate = true;
  // Background blur ("lens focused on the column") — switched off; set to true to bring it back.
  const BACKGROUND_BLUR = false;
  let blur = null; // the blur module is only downloaded when switched on
  if (BACKGROUND_BLUR) import('./blur.js').then(({ createBlurPipeline }) => { blur = createBlurPipeline(renderer); blur.setSize(); });

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdcecf7, 60, 420); // atmospheric haze over the distant city and hills

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);
  camera.layers.enableAll(); // sees background and foreground layers in a single pass

  const hemi = new THREE.HemisphereLight(0xe6f0ff, 0xb39b6c, 1.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
  sun.position.set(6, 26, 9);
  sun.target.position.set(0, 8, 0);
  sun.castShadow = true;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 13, bottom: -13, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  // soft fill light that follows the camera, so the side we look at is never in deep shadow
  const fill = new THREE.DirectionalLight(0xfff6e8, 0.9);
  scene.add(fill, fill.target);
  [hemi, sun, fill].forEach((l) => l.layers.enableAll()); // lights affect both the background and foreground passes

  const stopTs = stopParams(stopCount);
  const column = buildColumn(marbleTexture());
  scene.add(column);
  const { group: vine, anchors } = buildVine(stopTs);

  // The sundial sits beside its stop's grape cluster, centred between two turns of the vine
  // (so the vine frames it above and below).
  const dialIndex = stops.findIndex((st) => st.kind === 'dial');
  let dial = null;
  if (dialIndex >= 0) {
    const t = stopTs[dialIndex];
    const angle = vineAngle(t) + 0.55;
    const pitch = (VINE_TOP - VINE_BOTTOM) / VINE_TURNS;
    const y = vineY(t + 0.55 / (Math.PI * 2 * VINE_TURNS)) - pitch / 2;
    const sd = buildHangingClock(stops[dialIndex].dial);
    // hang it just in front of the shaft, facing outwards, top tilted slightly away like a hung frame
    const dist = SHAFT_R + CLOCK_DEPTH + 0.06;
    sd.group.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);
    sd.group.rotation.y = Math.PI / 2 - angle;
    sd.clock.rotation.x = -0.07;
    const plaque = buildPlaque(stops[dialIndex].dial.title || 'Программа дня', 1.05, 0.26, 'bronze');
    plaque.position.set(0, CLOCK_R * 1.1 + 0.3 + 0.19, 0.03); // bronze plaque just above the nail the clock hangs from
    sd.clock.add(plaque);
    // Photo frame beside the clock. On wide screens it hangs like a shop sign: a short bronze arm sticks out of
    // the clock's left side and the frame hangs from it on two rings. On phones the clock fills the width, so the
    // frame hangs under the clock on a short chain from the rim near VII.
    const cameo = buildFramedPhoto(stops[dialIndex].photo, 0.5, 0.63);
    const bronzeM = new THREE.MeshStandardMaterial({ color: 0xa27a38, metalness: 0.75, roughness: 0.32 });
    const linkMat = new THREE.MeshStandardMaterial({ color: 0x6e5126, metalness: 0.7, roughness: 0.4 });
    const link = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), linkMat);
    const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 8, 20), bronzeM); // on the rim, for the chain
    // the sign bracket: arm + knob at its end + two pairs of interlocked rings
    const bracket = new THREE.Group();
    const ARM_Y = 0.32, RIM_X = -Math.sqrt((CLOCK_R * 1.1) ** 2 - ARM_Y ** 2), ARM_LEN = 0.86;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, ARM_LEN, 12), bronzeM);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(RIM_X - ARM_LEN / 2 + 0.03, ARM_Y, -0.02);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), bronzeM);
    knob.position.set(RIM_X - ARM_LEN + 0.03, ARM_Y, -0.02);
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 14), bronzeM); // where the arm meets the case
    mount.rotation.z = Math.PI / 2;
    mount.position.set(RIM_X - 0.01, ARM_Y, -0.02);
    bracket.add(arm, knob, mount);
    const frameX = RIM_X - ARM_LEN / 2 - 0.02;
    const frameY = ARM_Y - 0.115 - cameo.userData.edge; // the lower rings pass through the frame's top edge
    const upperGeo = new THREE.TorusGeometry(0.045, 0.009, 8, 20), lowerGeo = new THREE.TorusGeometry(0.038, 0.009, 8, 20);
    for (const dx of [-0.19, 0.19]) {
      const upper = new THREE.Mesh(upperGeo, bronzeM); // loops around the arm
      upper.rotation.y = Math.PI / 2;
      upper.position.set(frameX + dx, ARM_Y - 0.008, -0.02);
      const lower = new THREE.Mesh(lowerGeo, bronzeM); // through the upper ring and the frame's top edge
      lower.position.set(frameX + dx, ARM_Y - 0.085, -0.02);
      bracket.add(upper, lower);
    }
    bracket.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    sd.clock.add(cameo, link, eyelet, bracket);
    sd.placeCameo = (portrait) => {
      bracket.visible = !portrait;
      link.visible = eyelet.visible = cameo.userData.ring.visible = portrait;
      cameo.scale.setScalar(portrait ? 1.1 : 1);
      if (!portrait) { cameo.position.set(frameX, frameY, -0.02); return; }
      const k = 1.1, rimA = Math.PI + 1.12; // near VII
      const er = CLOCK_R * 1.1 + 0.035; // eyelet centre, just outside the case
      eyelet.position.set(er * Math.cos(rimA), er * Math.sin(rimA), -0.04);
      eyelet.rotation.set(0, 0, rimA);
      const rim = new THREE.Vector3((er + 0.03) * Math.cos(rimA), (er + 0.03) * Math.sin(rimA), -0.03);
      cameo.position.set(rim.x, rim.y - 0.12 - cameo.userData.top * k + 0.04, 0.05);
      const hook = cameo.position.clone().add(new THREE.Vector3(0, (cameo.userData.top - 0.005) * k, 0.02 * k));
      link.position.copy(rim).add(hook).multiplyScalar(0.5);
      link.scale.y = rim.distanceTo(hook);
      link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rim.clone().sub(hook).normalize());
    };
    scene.add(sd.group);
    dial = { ...sd, angle, y, items: stops[dialIndex].dial.items.length };
  }
  scene.add(vine);
  const clouds = buildClouds();
  clouds.traverse((o) => o.layers.set(BG_LAYER));
  scene.add(clouds);
  // Big 3D clouds the intro photo frames stand on; placed in screen space under the HTML frames each frame.
  const countdown = buildCloudCountdown(() => { needsRender = true; scheduleWarmUp?.(); });
  scene.add(countdown.group);
  let countdownParts = null;
  const introClouds = [buildPuffyCloud(7), buildPuffyCloud(4242)];
  introClouds[1].rotation.y = Math.PI; // a different silhouette for the second one
  introClouds.forEach((c) => { c.visible = false; scene.add(c); });

  // Ancient Rome around the column; its plaza top (y=0 in its own space) sits at the column's foot.
  const ground = buildRome();
  ground.position.y = BASE_Y;
  ground.traverse((o) => o.layers.set(BG_LAYER)); // background: rendered blurred
  scene.add(ground);

  // Heights that depend on which column is shown (procedural or a loaded model).
  const dims = { capTop: SHAFT_H + 1.91 };
  let needsRender = false;

  // Optional .glb column replaces the procedural one (the information vine stays procedural).
  // { src, shaft } — `shaft` names the mesh of the column body: it is stretched to our shaft height,
  // while the parts above/below it (capital, base, decorations) keep their proportions.
  const modelCfg = typeof columnModel === 'string' ? { src: columnModel } : columnModel;
  if (modelCfg?.src) {
    column.visible = false; // avoid a flash of the placeholder while the model loads
    import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(modelCfg.src))
      .then((gltf) => {
        const model = fitColumnModel(gltf.scene, modelCfg.shaft, modelCfg.stretchBand);
        scene.add(model);
        const box = new THREE.Box3().setFromObject(model);
        dims.capTop = box.max.y;
        ground.position.y = box.min.y;
        needsRender = true;
        scheduleWarmUp?.();
        renderer.shadowMap.needsUpdate = true;
      })
      .catch((err) => {
        console.warn('Column model not loaded, using the built-in column:', err);
        column.visible = true;
        needsRender = true;
        renderer.shadowMap.needsUpdate = true;
      });
  }

  // parts: { days, hours, minutes, seconds: { value, label } }
  function layoutCountdown() {
    if (!countdownParts) return;
    const { days, hours, minutes, seconds } = countdownParts;
    const g = (p) => ({ text: String(p.value), label: p.label });
    // «До свадьбы осталось» is written in clouds too (two lines on phones)
    const rows = view.portrait
      ? [{ text: 'До свадьбы', size: 0.12, gap: 0.13 }, { text: 'осталось', size: 0.12, gap: 0.8 }, { groups: [g(days)], size: 0.72 }, { groups: [g(hours), g(minutes), g(seconds)], size: 0.3 }]
      : [{ text: 'До свадьбы осталось', size: 0.144, gap: 0.65 }, { groups: [g(days), g(hours), g(minutes), g(seconds)], size: 0.52 }];
    if (countdown.set(rows, view.portrait ? 0.5 : 0.3)) needsRender = true;
  }
  function setCountdown(parts) { countdownParts = parts; layoutCountdown(); }

  // Optional detailed Colosseum model: takes the place, footprint and orientation of the procedural one.
  if (colosseumModel?.src) {
    const placeholder = ground.userData.colosseum;
    import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(colosseumModel.src))
      .then((gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
        const long = Math.max(size.x, size.z);
        const holder = new THREE.Group();
        model.position.set(-c.x, -box.min.y, -c.z);
        holder.add(model);
        holder.scale.setScalar(100 / long); // ~100 units across, like the placeholder
        holder.position.copy(placeholder.position);
        holder.rotation.y = placeholder.rotation.y + (size.z > size.x ? Math.PI / 2 : 0); // long axis along the placeholder's
        holder.traverse((o) => { o.layers.set(BG_LAYER); if (o.isMesh) o.receiveShadow = true; });
        placeholder.parent.add(holder);
        placeholder.visible = false;
        needsRender = true;
        scheduleWarmUp?.();
        renderer.shadowMap.needsUpdate = true;
      })
      .catch((err) => console.warn('Colosseum model not loaded, keeping the built-in one:', err));
  }

  // Statues on the plaza pedestals: one low-poly model, copied onto every pedestal, in the same marble as the rest.
  if (statueModel?.src && ground.userData.statueSpots?.length) {
    import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(statueModel.src))
      .then((gltf) => {
        const model = gltf.scene;
        const marble = new THREE.MeshStandardMaterial({ color: 0xf1ebe0, roughness: 0.6 });
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.material = marble;
          o.castShadow = o.receiveShadow = true;
        });
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
        const k = (statueModel.height || 6) / size.y;
        ground.userData.statueSpots.forEach((spot) => {
          const holder = new THREE.Group();
          const m = model.clone();
          m.position.set(-c.x, -box.min.y, -c.z);
          holder.add(m);
          holder.scale.setScalar(k);
          holder.position.copy(spot.position);
          holder.rotation.y = spot.rotationY + Math.PI; // the model faces -z: turn it to look past the column, at the viewer
          holder.traverse((o) => o.layers.set(BG_LAYER));
          ground.add(holder);
        });
        needsRender = true;
        scheduleWarmUp?.();
        renderer.shadowMap.needsUpdate = true;
      })
      .catch((err) => console.warn('Statue model not loaded:', err));
  }

  // Venue signpost: boards nailed to the column between two turns of the vine.
  const signIndex = stops.findIndex((st) => st.kind === 'sign');
  let sign = null;
  if (signIndex >= 0) {
    const t = stopTs[signIndex];
    const angle = vineAngle(t) - 0.6; // beside the stop's grape cluster
    const pitch = (VINE_TOP - VINE_BOTTOM) / VINE_TURNS;
    // a little below the middle between vine turns, so the stop's grape cluster hangs above the boards
    const y = vineY(t - 0.6 / (Math.PI * 2 * VINE_TURNS)) - pitch / 2 - 0.45;
    const sp = buildSignpost(stops[signIndex].sign);
    const dist = SHAFT_R + 0.03;
    sp.group.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);
    sp.group.rotation.y = Math.PI / 2 - angle;
    sp.group.traverse((o) => { if (o.isMesh) o.castShadow = o.castShadow && !o.material.transparent; });
    const venuePhoto = buildPolaroid(stops[signIndex].photo, 1.05, 1.18, 'pin');
    venuePhoto.position.set(-0.05, -1.86, 0.08); // pinned to the column under the boards, where it has room
    venuePhoto.rotation.z = 0.05;
    sp.group.add(venuePhoto);
    scene.add(sp.group);
    sign = { ...sp, angle, y };
  }

  // Dress code ribbons: a band of six silk ribbons with a bow and a tag, between two turns of the vine.
  const dressIndex = stops.findIndex((st) => st.kind === 'ribbons');
  let dress = null;
  if (dressIndex >= 0) {
    const t = stopTs[dressIndex];
    const angle = vineAngle(t) + 0.6;
    const pitch = (VINE_TOP - VINE_BOTTOM) / VINE_TURNS;
    const y = vineY(t + 0.6 / (Math.PI * 2 * VINE_TURNS)) - pitch / 2 + 0.75; // the knot; the tag hangs below
    const rb = buildRibbons(stops[dressIndex].ribbons);
    rb.bands.position.y = y;
    rb.bands.rotation.y = -angle;
    const dist = SHAFT_R + 0.02;
    rb.group.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);
    rb.group.rotation.y = Math.PI / 2 - angle;
    if (stops[dressIndex].photo) { // optional: add `photo` to the dress-code stop in content.js to pin one here
      const dressPhoto = buildPolaroid(stops[dressIndex].photo, 0.7, 0.8, 'pin');
      dressPhoto.position.set(-0.1, -3.55, 0.05); // pinned to the column under the tag, below the vine
      dressPhoto.rotation.z = 0.12;
      rb.group.add(dressPhoto);
    }
    scene.add(rb.bands, rb.group);
    dress = { ...rb, angle, y };
  }

  // Details chalkboard: hung above the last stop's vine turn, just over the base of the column.
  const boardIndex = stops.findIndex((st) => st.kind === 'chalkboard');
  let board = null;
  if (boardIndex >= 0) {
    const t = stopTs[boardIndex];
    const angle = vineAngle(t) + 1.2; // well round the column from the dress-code ribbons' tag (~130° apart)
    const pitch = (VINE_TOP - VINE_BOTTOM) / VINE_TURNS;
    const y = vineY(t + 1.2 / (Math.PI * 2 * VINE_TURNS)) + pitch / 2 - 0.2; // between this vine turn and the one above
    const cb = buildChalkboard(stops[boardIndex].chalkboard);
    const dist = SHAFT_R + 0.17;
    cb.group.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);
    cb.group.rotation.y = Math.PI / 2 - angle;
    cb.group.rotateX(-0.05); // hanging slightly forward from its rope
    const boardPhoto = buildPolaroid(stops[boardIndex].photo, 0.6, 0.69, 'tape');
    boardPhoto.position.set(0.55, 0.88, 0.1); // the tape on its top edge sits on the board's frame
    boardPhoto.rotation.z = -0.14;
    cb.group.add(boardPhoto);
    scene.add(cb.group);
    board = { ...cb, angle, y };
  }

  // ---------- camera path ----------
  const view = { w: 1, h: 1, portrait: false };
  const camPos = new THREE.Vector3();
  const crownAnchor = new THREE.Vector3(); // where the countdown sign hangs, just above the capital
  const camTarget = new THREE.Vector3();

  // A camera pose: angle around the column, distance from the axis, camera height, look-at height.
  const pose = (a, r, y, ty) => ({ a, r, y, ty });
  function stopPose(t) {
    const y = vineY(t);
    // close-up: the column + grapes fill most of the screen; CAM_LEAD keeps the cluster on the right edge
    return pose(vineAngle(t) + (view.portrait ? 0.45 : CAM_LEAD), view.portrait ? 6.6 : 3.7, y + 0.45, y - 0.05);
  }
  // "Crown" pose: the top of the column with the countdown sign floating above it.
  function crownPose() {
    const first = stopPose(stopTs[0]);
    return view.portrait
      ? pose(first.a - 0.5, 9.0, dims.capTop + 0.6, dims.capTop + 1.6)
      : pose(first.a - 0.5, 7.0, dims.capTop + 0.3, dims.capTop + 0.95);
  }
  // looking slightly upwards so the city below stays out of the intro
  const skyPose = (k) => pose(VINE_THETA0 + CAM_LEAD - 1.4 + k * 0.2, 12, SKY_Y - k * 3, SKY_Y + 4 - k * 6);


  function lerpPose(A, B, k) {
    let b = B.a;
    while (b - A.a > Math.PI) b -= Math.PI * 2;
    while (A.a - b > Math.PI) b += Math.PI * 2;
    return pose(lerp(A.a, b, k), lerp(A.r, B.r, k), lerp(A.y, B.y, k), lerp(A.ty, B.ty, k));
  }
  function applyPose(P) {
    camPos.set(Math.cos(P.a) * P.r, P.y, Math.sin(P.a) * P.r);
    camTarget.set(0, P.ty, 0);
  }

  // Camera facing the sundial straight on.
  function dialPose() {
    // the whole clock (with its chains) centred on screen; on phones the view is shifted up by 20%,
    // so the camera aims above the clock to bring it back to the middle
    return view.portrait
      ? pose(dial.angle, 5.8, dial.y + 0.55, dial.y + 0.65) // phones: the dial fills the width, the photo below fits
      : pose(dial.angle, 5.2, dial.y + 0.3, dial.y + 0.25);
  }
  // Camera facing the signpost. On phones the text fills the width; the arrow tips may run off the edges.
  function signPose() {
    return view.portrait
      ? pose(sign.angle - 0.08, 9.2, sign.y + 0.75, sign.y + 0.95)
      : pose(sign.angle, 6.9, sign.y + 0.05, sign.y - 0.12); // low enough to include the photo under the boards
  }
  // Camera facing the bow and the tag hanging under it.
  function dressPose() {
    const midY = dress.y - 1.0;
    return view.portrait
      ? pose(dress.angle + 0.03, 5.7, midY + 0.55, midY + 0.75) // phones: the tag fills the width
      : pose(dress.angle, 5.6, midY + 0.3, midY + 0.1);
  }
  // Camera facing the chalkboard.
  function boardPose() {
    return view.portrait
      ? pose(board.angle, 6.6, board.y + 0.85, board.y + 1.05) // phones: the board fills the width
      : pose(board.angle, 6.0, board.y + 0.3, board.y + 0.15);
  }
  // pose of stop i (0 = countdown above the capital, 1..n = stops along the vine)
  const poseOf = (i) => {
    if (i === 0) return crownPose();
    const kind = stops[i - 1].kind;
    return kind === 'dial' ? dialPose() : kind === 'sign' ? signPose() : kind === 'ribbons' ? dressPose()
      : kind === 'chalkboard' ? boardPose() : stopPose(stopTs[i - 1]);
  };
  const isVine = (i) => i > 0 && stops[i - 1].kind === 'vine';
  const weights = [1, ...stops.map((st) => st.weight ?? 1)];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const DIAL_DWELL = 0.8; // the sundial keeps the camera still longer: the shadow sweeps during this part

  // Returns the active stop index (or -1) and sets camPos / camTarget.
  function cameraAt(p) {
    const n = weights.length;
    if (p < PHASE.introEnd) {
      applyPose(skyPose(p / PHASE.introEnd));
      return { active: -1, sky: 1 };
    }
    if (p < PHASE.descentEnd) {
      const k = smooth((p - PHASE.introEnd) / (PHASE.descentEnd - PHASE.introEnd));
      const P = lerpPose(skyPose(1), crownPose(), k);
      // tilt down towards the column sooner than we arrive, so it stays in frame during the descent
      const kLook = 1 - (1 - k) ** 3;
      P.ty = lerp(skyPose(1).ty, crownPose().ty, kLook);
      applyPose(P);
      return { active: -1, sky: 1 - k };
    }
    if (p < PHASE.stopsEnd) {
      // which stop are we in, and how far through it (f: 0..1)?
      let u = ((p - PHASE.descentEnd) / (PHASE.stopsEnd - PHASE.descentEnd)) * totalWeight;
      let i = 0;
      while (i < n - 1 && u >= weights[i]) { u -= weights[i]; i++; }
      const f = Math.min(1, u / weights[i]);
      const dwell = i > 0 && stops[i - 1].kind === 'dial' ? DIAL_DWELL : DWELL;
      const move = i < n - 1 && f > dwell ? smooth((f - dwell) / (1 - dwell)) : 0;
      if (move > 0 && isVine(i) && isVine(i + 1)) applyPose(stopPose(lerp(stopTs[i - 1], stopTs[i], move))); // follow the vine
      else applyPose(move > 0 ? lerpPose(poseOf(i), poseOf(i + 1), move) : poseOf(i));
      // sundial: the shadow walks from mark to mark, pausing on each one
      let dialShadow = null;
      if (dial && i === dialIndex + 1) {
        const x = clamp01(f / (DIAL_DWELL * 0.92)) * (dial.items - 1);
        const k0 = Math.min(dial.items - 2, Math.floor(x));
        dialShadow = k0 + THREE.MathUtils.smoothstep(x - k0, 0.3, 0.7);
      } else if (dial) dialShadow = i <= dialIndex ? 0 : dial.items - 1;
      return { active: f < dwell + 0.12 || i === n - 1 ? i : -1, sky: 0, dialShadow };
    }
    // final: pull back to show the whole base of the column
    const k = smooth(clamp01((p - PHASE.stopsEnd) / (1 - PHASE.stopsEnd)));
    const last = poseOf(n - 1);
    applyPose(lerpPose(last, pose(last.a + 0.6, view.portrait ? 9 : 7.5, 1.6, 0.8), k));
    return { active: -1, sky: 0, dialShadow: dial ? dial.items - 1 : null };
  }

  // ---------- sky colours ----------
  const skyHigh = { top: new THREE.Color('#6fa8de'), bottom: new THREE.Color('#d6e9f7') };
  const skyLow = { top: new THREE.Color('#86b4de'), bottom: new THREE.Color('#ead9b8') };
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  const rootStyle = document.documentElement.style;

  function resize() {
    // clientWidth excludes a desktop scrollbar, matching the fixed canvas's real CSS width
    const w = document.documentElement.clientWidth || window.innerWidth, h = window.innerHeight;
    view.w = w; view.h = h; view.portrait = w < 760 || h > w * 1.1;
    dial?.placeCameo?.(view.portrait);
    dress?.setNarrow?.(view.portrait);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, view.portrait ? 2 : 1.75)); // phones: 2, or small text on the boards blurs
    renderer.setSize(w, h, false);
    blur?.setSize();
    camera.aspect = w / h;
    camera.fov = view.portrait ? 50 : 40;
    // Shift the column off-centre to leave room for the tag card:
    // to the left on wide screens, upwards on phones.
    // column centred horizontally; on phones shifted up to leave room for the card at the bottom
    if (view.portrait) camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    else camera.clearViewOffset();
    layoutCountdown();
    camera.updateProjectionMatrix();
  }
  resize();
  if (/[?&]nosmooth/.test(location.search)) window.__dbg = { scene, camera, ground, THREE, renderer, dial }; // debug only

  const proj = new THREE.Vector3();
  const camDir = new THREE.Vector3();

  const CLOUD_DEPTH = 9;       // distance from the camera along the view ray
  const CLOUD_WIDTH_K = 2.6;   // cloud width relative to the photo frame width (on screen)
  const ndc = new THREE.Vector3(), ray = new THREE.Vector3(), camQ = new THREE.Quaternion();

  // frames: [{ x, bottom, w, h }] in CSS px (bottom-centre of each photo frame), or null to hide
  function placeIntroClouds(frames) {
    camera.updateMatrixWorld();
    camera.getWorldQuaternion(camQ);
    const worldPerPx = (2 * CLOUD_DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / view.h;
    introClouds.forEach((cloud, i) => {
      const f = frames?.[i];
      cloud.visible = !!f && f.bottom > -f.h && f.bottom - f.h < view.h * 1.5;
      if (!cloud.visible) return;
      const pxW = f.w * CLOUD_WIDTH_K;
      const pxH = pxW / 2.6;
      const top = f.bottom - f.h * 0.32;           // the cloud rises behind the lower third of the frame
      const originY = top + pxH;                   // cloud geometry origin is its flat bottom
      ndc.set((f.x / view.w) * 2 - 1, -(originY / view.h) * 2 + 1, 0.5).unproject(camera);
      ray.copy(ndc).sub(camera.position).normalize();
      cloud.position.copy(camera.position).addScaledVector(ray, CLOUD_DEPTH);
      cloud.quaternion.copy(camQ);
      if (i === 1) cloud.rotateY(Math.PI);
      cloud.scale.setScalar((pxW * worldPerPx) / 2.6);
    });
  }

  function render(p, introFrames) {
    const state = cameraAt(p);
    if (dial && state.dialShadow !== null && state.dialShadow !== undefined) dial.setHand(state.dialShadow);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    // cloud digits hover above the capital and turn to face the camera
    countdown.group.position.set(0, dims.capTop + 0.5, 0);
    countdown.group.rotation.y = Math.atan2(camPos.x, camPos.z);
    countdown.group.visible = p < PHASE.stopsEnd && camPos.y > dims.capTop - 1.5; // skip drawing it once we are below the capital
    fill.position.copy(camPos).add(new THREE.Vector3(0, 3, 0));
    fill.target.position.copy(camTarget);
    placeIntroClouds(p < PHASE.descentEnd ? introFrames : null);

    // sky gradient + fog follow height
    const k = clamp01((camPos.y - 2) / (SKY_Y - 2));
    tmpA.copy(skyLow.top).lerp(skyHigh.top, k);
    tmpB.copy(skyLow.bottom).lerp(skyHigh.bottom, k);
    rootStyle.setProperty('--sky-top', `#${tmpA.getHexString()}`);
    rootStyle.setProperty('--sky-bottom', `#${tmpB.getHexString()}`);
    scene.fog.color.copy(tmpB);

    // clouds near the camera fade out so the descent doesn't go "through" flat sprites
    for (const sp of clouds.children) {
      const d = sp.position.distanceTo(camPos);
      const near = sp.userData.near;
      sp.material.opacity = sp.userData.baseOpacity * clamp01((d - near) / (near * 1.6));
    }

    // background softly out of focus, more so once we are close to the column
    if (blur) blur.render(scene, camera, lerp(0.8, 2.0, 1 - state.sky));
    else renderer.render(scene, camera);

    // screen positions of grape clusters for the HTML tags
    camDir.set(camPos.x, 0, camPos.z).normalize();
    proj.copy(crownAnchor.set(0, dims.capTop + 0.35, 0)).project(camera);
    const toScreen = (v3) => {
      proj.copy(v3).project(camera);
      return { x: (proj.x * 0.5 + 0.5) * view.w, y: (-proj.y * 0.5 + 0.5) * view.h, on: proj.z < 1 && Math.abs(proj.x) < 1.2 && Math.abs(proj.y) < 1.2 };
    };
    let schedule = null;
    if (dial) {
      const out = new THREE.Vector3(Math.cos(dial.angle), 0, Math.sin(dial.angle)).multiplyScalar(SHAFT_R + 0.15);
      const top = toScreen(out.clone().setY(dial.y + CLOCK_R * 1.1 + 0.6)); // above the hanging chains
      const bottom = toScreen(out.clone().setY(dial.y - CLOCK_R * 1.1));
      schedule = {
        visible: state.active === dialIndex + 1 && top.on,
        top, bottom,
        item: Math.round(state.dialShadow ?? 0),
      };
    }
    let dressInfo = null;
    if (dress) {
      const near = Math.abs(camPos.y - dress.y) < 6;
      if (near) dress.flutter(performance.now() / 1000);
      dress.tag.updateMatrixWorld();
      const b = dress.getButton(), { w, h } = dress.tagSize;
      // tag-plane coords: x from -w/2, y from +h/2 downwards
      const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]
        .map(([x, y]) => toScreen(dress.tag.localToWorld(new THREE.Vector3(x - w / 2, h / 2 - y, 0.01))));
      const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
      // phones: the open looks card covers the screen and the tag (with its button) slides away,
      // so the card itself becomes the button that closes it
      if (dress.isLooksOpen() && dress.isNarrow()) {
        dress.looks.updateMatrixWorld();
        const { w: lw, h: lh } = dress.looksSize;
        corners.splice(0, 4, ...[[-lw / 2, lh / 2], [lw / 2, lh / 2], [lw / 2, -lh / 2], [-lw / 2, -lh / 2]]
          .map(([x, y]) => toScreen(dress.looks.localToWorld(new THREE.Vector3(x, y, 0.01)))));
        xs.splice(0, 4, ...corners.map((c) => c.x)); ys.splice(0, 4, ...corners.map((c) => c.y));
      }
      const dressVisible = state.active === dressIndex + 1 && corners.some((c) => c.on);
      if (!dressVisible && dress.isLooksOpen()) dress.setLooksOpen(false); // tuck the card back when we move on
      dressInfo = {
        visible: dressVisible,
        animating: near,
        button: { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) },
      };
    }
    let details = null;
    if (board) {
      board.slate.updateMatrixWorld();
      const { w, h } = board.size;
      const rect = (a) => {
        const c = [[a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, a.y + a.h], [a.x, a.y + a.h]]
          .map(([x, y]) => toScreen(board.slate.localToWorld(new THREE.Vector3(x - w / 2, h / 2 - y, 0.01))));
        const xs = c.map((q) => q.x), ys = c.map((q) => q.y);
        return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), on: c[0].on };
      };
      const areas = board.getAreas();
      const phone = rect(areas.phone), telegram = rect(areas.telegram);
      details = { visible: state.active === boardIndex + 1 && phone.on, phone, telegram };
    }
    let venue = null;
    if (sign) {
      sign.group.updateMatrixWorld();
      const corners = sign.mapCorners.map((v) => toScreen(sign.group.localToWorld(v.clone())));
      const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
      const top = toScreen(sign.group.localToWorld(new THREE.Vector3(0, 1.45, 0)));
      venue = {
        visible: state.active === signIndex + 1 && top.on,
        top,
        map: { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) },
      };
    }
    countdown.group.updateMatrixWorld();
    const cdLabels = countdown.layout.labels.map((l) => ({ text: l.text, ...toScreen(countdown.group.localToWorld(l.pos.clone())) }));
    const cdTitle = toScreen(countdown.group.localToWorld(new THREE.Vector3(0, countdown.layout.top + 0.3, 0)));
    proj.copy(crownAnchor).project(camera);
    const crown = { x: (proj.x * 0.5 + 0.5) * view.w, y: (-proj.y * 0.5 + 0.5) * view.h, visible: proj.z < 1 && Math.abs(proj.y) < 1.2 };
    const out = anchors.map((a) => {
      proj.copy(a.pos).project(camera);
      const facing = a.out.dot(camDir);
      return {
        x: (proj.x * 0.5 + 0.5) * view.w,
        y: (-proj.y * 0.5 + 0.5) * view.h,
        visible: proj.z < 1 && facing > 0.15 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1,
      };
    });
    return {
      active: state.active, sky: state.sky, final: p >= PHASE.stopsEnd, anchors: [crown, ...out], portrait: view.portrait,
      countdown: { visible: state.sky < 0.15 && p < PHASE.stopsEnd && cdTitle.on, title: cdTitle, labels: cdLabels },
      schedule,
      venue,
      dress: dressInfo,
      details,
    };
  }

  // ---------- warm-up: prepare everything for the GPU before the guest ever sees it ----------
  // The first time an object comes into view, the browser compiles its shaders and uploads its geometry and
  // textures — a one-off stall of ~0.3 s that used to hit the first descent. Here the whole scene is drawn once,
  // invisibly, from a wide viewpoint that sees everything, while the envelope still covers the screen.
  const warmCam = new THREE.PerspectiveCamera(120, 1, 0.1, 1500);
  const warmTarget = new THREE.WebGLRenderTarget(64, 64);
  let warmTimer = null;
  async function warmUp() {
    warmCam.position.set(0, 30, 48);
    warmCam.lookAt(0, 8, 0);
    warmCam.layers.enableAll();
    warmCam.updateMatrixWorld();
    // show everything for this one pass (some objects are only switched on later in the journey)
    const hidden = [];
    scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try {
      if (renderer.compileAsync) await renderer.compileAsync(scene, warmCam); // compiles shaders without blocking
      else renderer.compile(scene, warmCam);
      renderer.setRenderTarget(warmTarget);
      renderer.render(scene, warmCam); // uploads geometry and textures
    } finally {
      renderer.setRenderTarget(null);
      hidden.forEach((o) => { o.visible = false; });
      needsRender = true;
    }
  }
  // run once things settle, and again whenever something new arrives (models, the countdown font)
  const scheduleWarmUp = () => { clearTimeout(warmTimer); warmTimer = setTimeout(() => { warmUp().catch(() => {}); }, 150); };
  scheduleWarmUp();
  FONTS_READY.then(scheduleWarmUp);

  const setPhases = (ph) => Object.assign(PHASE, ph);
  // true once after something changed outside of scrolling (e.g. the column model finished loading)
  const takeNeedsRender = () => { const r = needsRender; needsRender = false; return r; };
  const stats = () => ({ ...renderer.info.render, ...renderer.info.memory }); // debug: draw calls, triangles, GPU objects
  const toggleLooks = () => { if (dress) dress.setLooksOpen(!dress.isLooksOpen()); };
  return { render, resize, setPhases, takeNeedsRender, setCountdown, stats, toggleLooks };
}
