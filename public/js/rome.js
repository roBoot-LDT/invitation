// Procedural "ancient Rome" around the column: rolling hills, a paved plaza with steps, nearby ruins,
// a temple, a Pantheon-like rotunda, houses with terracotta roofs, the Colosseum, an aqueduct and trees.
// Everything is built from simple shapes and canvas textures — no downloads. Ground level is y = 0.
import * as THREE from 'three';

// ---------- noise / terrain ----------
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * noise(x * f, y * f); f *= 2; a *= 0.5; } return s; }
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const PLAZA_R = 16;
const GROUND_Y = -0.9; // terrain level around the plaza (the plaza and its steps sit above it)

// Height of the land at (x, z): flat around the plaza, gentle slopes in the city, the "seven hills" far away.
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const city = smoothstep(35, 90, r) * (fbm(x / 55, z / 55) * 12 - 4);
  const hills = smoothstep(170, 330, r) * (fbm(x / 110 + 7, z / 110 - 3) * 70);
  return GROUND_Y + city + hills;
}

// ---------- textures ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

function speckle(g, w, h, n, tones) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = tones[(Math.random() * tones.length) | 0];
    g.globalAlpha = 0.05 + Math.random() * 0.12;
    const r = 2 + Math.random() * 14;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

// Travertine paving: rows of rectangular slabs with dark joints.
const pavingTexture = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d9cbb0'; g.fillRect(0, 0, w, h);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    let x = -Math.random() * 60;
    const y = (r * h) / rows;
    while (x < w) {
      const sw = 50 + Math.random() * 70;
      const tone = 200 + Math.random() * 30;
      g.fillStyle = `rgb(${tone + 15},${tone + 4},${tone - 22})`;
      g.fillRect(x + 2, y + 2, sw - 4, h / rows - 4);
      x += sw;
    }
  }
  speckle(g, w, h, 500, ['#a8987a', '#f4ead6', '#8c7c62']);
}, [6, 6]);

const stoneTexture = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ddd0b5'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 400, ['#b4a284', '#f2e8d4', '#9a8a6c']);
  g.strokeStyle = 'rgba(120,100,70,.25)';
  for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
}, [2, 2]);

// One bay of the Colosseum facade: three tiers of arches + attic. Arch openings are transparent.
const colosseumTexture = () => canvasTex(128, 512, (g, w, h) => {
  g.fillStyle = '#d6c29c'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 160, ['#b09a72', '#efe2c4', '#8f7b58']);
  const attic = h * 0.2;
  const tier = (h - attic) / 3;
  g.fillStyle = 'rgba(110,90,60,.35)';
  for (let i = 0; i < 4; i++) g.fillRect(0, attic + i * tier - 5, w, 8); // cornices
  g.fillRect(0, 0, w, 6);
  for (let i = 0; i < 3; i++) {
    const top = attic + i * tier;
    const aw = w * 0.56, ax = (w - aw) / 2, springY = top + tier * 0.42;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(ax, top + tier - 6);
    g.lineTo(ax, springY);
    g.arc(w / 2, springY, aw / 2, Math.PI, 0);
    g.lineTo(ax + aw, top + tier - 6);
    g.closePath(); g.fill();
    g.restore();
    g.fillStyle = 'rgba(90,70,45,.25)'; // engaged half-columns between the arches
    g.fillRect(2, top + 8, 10, tier - 14); g.fillRect(w - 12, top + 8, 10, tier - 14);
  }
  g.fillStyle = 'rgba(80,60,40,.55)'; // small attic windows
  g.fillRect(w / 2 - 10, attic * 0.35, 20, attic * 0.3);
}, null);

// Aqueduct: two tiers of arches.
const aqueductTexture = () => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#c9b089'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 120, ['#a38c66', '#e4d3b2']);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const arch = (top, bottom, width) => {
    const ax = (w - width) / 2, springY = top + width / 2;
    g.beginPath(); g.moveTo(ax, bottom); g.lineTo(ax, springY); g.arc(w / 2, springY, width / 2, Math.PI, 0); g.lineTo(ax + width, bottom); g.closePath(); g.fill();
  };
  arch(h * 0.18, h * 0.5, w * 0.62);
  arch(h * 0.56, h, w * 0.72);
  g.restore();
}, null);

// ---------- builders ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra });

function buildTerrain() {
  const SIZE = 900, SEG = 110;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color(), grass = new THREE.Color('#7f8f4a'), dry = new THREE.Color('#b9a36a'), dark = new THREE.Color('#5d6e36'), dust = new THREE.Color('#c8b48a');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = heightAt(x, z);
    p.setY(i, y);
    const r = Math.hypot(x, z);
    const n = fbm(x / 25, z / 25);
    c.copy(grass).lerp(dry, smoothstep(0.35, 0.7, n)).lerp(dark, smoothstep(10, 40, y) * 0.6);
    c.lerp(dust, 1 - smoothstep(20, 45, r)); // trodden earth around the plaza
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildPlaza(paving, stone) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA_R, PLAZA_R, 0.3, 96), [mat(0xffffff, { map: stone }), mat(0xffffff, { map: paving }), mat(0xffffff)]);
  top.position.y = -0.15;
  top.receiveShadow = true;
  g.add(top);
  // steps down to the terrain
  [0.6, 1.3].forEach((grow, i) => {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA_R + grow, PLAZA_R + grow, 0.3, 96), mat(0xd3c3a2, { map: stone }));
    step.position.y = -0.45 - i * 0.3;
    step.receiveShadow = true;
    g.add(step);
  });
  return g;
}

// A paved road from the plaza towards `angle`.
function buildRoad(angle, paving) {
  const len = 140;
  const tex = paving.clone(); tex.needsUpdate = true; tex.repeat.set(1, 18);
  const geo = new THREE.PlaneGeometry(7, len, 2, 70);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -len / 2 - PLAZA_R + 1);
  geo.rotateY(-angle - Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)) + 0.06);
  geo.computeVertexNormals();
  const road = new THREE.Mesh(geo, mat(0xcfbf9e, { map: tex }));
  road.receiveShadow = true;
  return road;
}

function column(stoneMat, h, r = 0.7) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 16), stoneMat);
  shaft.position.y = h / 2;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, r * 0.5, r * 2.6), stoneMat);
  cap.position.y = h + r * 0.25;
  const base = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, r * 0.5, r * 2.6), stoneMat);
  base.position.y = r * 0.25;
  g.add(shaft, cap, base);
  return g;
}

function pediment(width, height, depth, m) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(0, height); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, m);
}

// Ruins close to the plaza: a standing colonnade with an architrave, broken stumps and fallen drums.
function buildRuins(stoneMat) {
  const g = new THREE.Group();
  const place = (obj, angle, radius, rotY = 0) => {
    obj.position.set(Math.cos(angle) * radius, heightAt(Math.cos(angle) * radius, Math.sin(angle) * radius), Math.sin(angle) * radius);
    obj.rotation.y = rotY;
    g.add(obj);
    return obj;
  };
  // colonnade: 5 columns in a row, an architrave on the first three
  const colonnade = new THREE.Group();
  [11, 11, 11, 7.5, 4].forEach((h, i) => { const c = column(stoneMat, h); c.position.x = i * 4.2; colonnade.add(c); });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1.4, 2), stoneMat);
  beam.position.set(4.2, 11.4 + 0.7 + 0.35, 0);
  colonnade.add(beam);
  colonnade.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  place(colonnade, 2.3, 27, -2.3 + Math.PI / 2);
  // stumps and fallen drums
  [[0.4, 22, 3.2], [0.9, 24, 1.8], [4.1, 23, 5], [5.0, 26, 2.4]].forEach(([a, r, h]) => place(column(stoneMat, h, 0.8), a, r));
  [[0.65, 21, 0.3], [4.5, 22, 1.2], [5.3, 20.5, 2.0]].forEach(([a, r, rot]) => {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.2, 16), stoneMat);
    drum.rotation.z = Math.PI / 2;
    const o = place(new THREE.Group().add(drum), a, r, rot);
    o.position.y += 0.8;
  });
  return g;
}

function buildTemple(stoneMat, roofMat) {
  const g = new THREE.Group();
  const podium = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 26), stoneMat);
  podium.position.y = 1.5;
  g.add(podium);
  for (let i = 0; i < 6; i++) for (const z of [11.5, 8.5]) {
    const c = column(stoneMat, 11, 0.75); c.position.set(-6.5 + i * 2.6, 3, z); g.add(c);
  }
  const cella = new THREE.Mesh(new THREE.BoxGeometry(13, 11, 17), stoneMat);
  cella.position.set(0, 8.5, -3.5);
  const entab = new THREE.Mesh(new THREE.BoxGeometry(16.5, 1.6, 26), stoneMat);
  entab.position.y = 15.2;
  const ped = pediment(16.5, 4, 26, roofMat);
  ped.position.y = 16;
  g.add(cella, entab, ped);
  return g;
}

function buildPantheon(stoneMat, roofMat) {
  const g = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 16, 48), stoneMat);
  drum.position.y = 8;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(15, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb8b0a0));
  dome.scale.y = 0.75; dome.position.y = 16;
  g.add(drum, dome);
  for (let i = 0; i < 8; i++) { const c = column(stoneMat, 12, 0.8); c.position.set(-9.8 + i * 2.8, 0, 19); g.add(c); }
  const entab = new THREE.Mesh(new THREE.BoxGeometry(23, 1.6, 9), stoneMat);
  entab.position.set(0, 13.6, 18);
  const ped = pediment(23, 4.5, 9, roofMat);
  ped.position.set(0, 14.4, 18);
  g.add(entab, ped);
  return g;
}

function buildColosseum() {
  const g = new THREE.Group();
  const H = 34, R = 50;
  const outerTex = colosseumTexture(); outerTex.repeat.set(76, 1);
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 152, 1, true),
    mat(0xffffff, { map: outerTex, alphaTest: 0.5, side: THREE.DoubleSide }));
  outer.position.y = H / 2;
  const innerTex = colosseumTexture(); innerTex.repeat.set(60, 1);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R * 0.86, H * 0.82, 120, 1, true),
    mat(0xcbb48c, { map: innerTex, alphaTest: 0.5, side: THREE.DoubleSide }));
  inner.position.y = H * 0.41;
  const cavea = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R * 0.45, H * 0.7, 96, 1, true), mat(0x9c8868, { side: THREE.DoubleSide }));
  cavea.position.y = H * 0.35;
  const arena = new THREE.Mesh(new THREE.CircleGeometry(R * 0.45, 48), mat(0xc2a878));
  arena.rotation.x = -Math.PI / 2; arena.position.y = 0.5;
  g.add(outer, inner, cavea, arena);
  g.scale.z = 0.84; // elliptical plan
  return g;
}

function buildAqueduct(fromAngle, toAngle, radius) {
  const a = new THREE.Vector3(Math.cos(fromAngle) * radius, 0, Math.sin(fromAngle) * radius);
  const b = new THREE.Vector3(Math.cos(toAngle) * radius, 0, Math.sin(toAngle) * radius);
  const len = a.distanceTo(b);
  const tex = aqueductTexture(); tex.repeat.set(len / 9, 1);
  const H = 26;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, H, 3), [
    mat(0xb9a07a), mat(0xb9a07a), mat(0xb9a07a), mat(0xb9a07a),
    mat(0xffffff, { map: tex, alphaTest: 0.5 }), mat(0xffffff, { map: tex, alphaTest: 0.5 }),
  ]);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  wall.position.set(mid.x, heightAt(mid.x, mid.z) + H / 2 - 4, mid.z);
  wall.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  return wall;
}

// Houses with terracotta roofs, instanced, in clusters across the city ring.
function buildHouses(avoid) {
  const N = 150;
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const roof = new THREE.ConeGeometry(0.75, 1, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 0.5, 0);
  const walls = new THREE.InstancedMesh(box, mat(0xffffff), N);
  const roofs = new THREE.InstancedMesh(roof, mat(0xffffff, { roughness: 0.8 }), N);
  const wallColors = ['#e8d3a8', '#d9b77e', '#c98f5c', '#efe1c3', '#d4a46c', '#b97c4f'];
  const roofColors = ['#b5532f', '#a3472a', '#c2653a', '#9a4a2c'];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  let n = 0, tries = 0;
  while (n < N && tries < 5000) {
    tries++;
    const cluster = Math.floor(hash(tries * 0.13, 1.7) * 14);
    const ca = cluster * 0.45 + 0.3, cr = 70 + hash(cluster, 3.1) * 130;
    const x = Math.cos(ca) * cr + (hash(tries, 2.2) - 0.5) * 50;
    const z = Math.sin(ca) * cr + (hash(tries, 5.9) - 0.5) * 50;
    const r = Math.hypot(x, z);
    if (r < 50 || r > 240) continue;
    if (avoid.some((p) => (p.test ? p.test(x, z) : Math.hypot(x - p.x, z - p.z) < p.r))) continue;
    const w = 5 + hash(tries, 8.8) * 7, d = 5 + hash(tries, 9.9) * 6, h = 4 + hash(tries, 4.4) * 7;
    const y = heightAt(x, z) - 0.5;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(x, z) + (hash(tries, 6.6) - 0.5) * 0.4);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, d));
    walls.setMatrixAt(n, m);
    walls.setColorAt(n, c.set(wallColors[(hash(tries, 7.7) * wallColors.length) | 0]));
    m.compose(new THREE.Vector3(x, y + h, z), q, new THREE.Vector3(w * 1.15, 2 + w * 0.15, d * 1.15));
    roofs.setMatrixAt(n, m);
    roofs.setColorAt(n, c.set(roofColors[(hash(tries, 3.3) * roofColors.length) | 0]));
    n++;
  }
  walls.count = roofs.count = n;
  return [walls, roofs];
}

// Cypresses (tall dark cones) and umbrella pines (flat canopies), instanced.
function buildTrees(avoid) {
  const out = [];
  const cyp = new THREE.ConeGeometry(1, 1, 8); cyp.translate(0, 0.5, 0);
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 1, 6); trunk.translate(0, 0.5, 0);
  const canopy = new THREE.SphereGeometry(1, 12, 8);
  const NC = 45, NP = 17, NL = 55, LEMONS_PER_TREE = 14;
  const cypresses = new THREE.InstancedMesh(cyp, mat(0x34502c), NC);
  const pineTrunks = new THREE.InstancedMesh(trunk, mat(0x6b5235), NP);
  const pineTops = new THREE.InstancedMesh(canopy, mat(0x4f6d33), NP);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const spot = (i, salt, minR, maxR) => {
    for (let k = 0; k < 40; k++) {
      const a = hash(i + k * 13.1, salt) * Math.PI * 2, r = minR + hash(i + k * 7.3, salt + 1) * (maxR - minR);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!avoid.some((p) => (p.test ? p.test(x, z) : Math.hypot(x - p.x, z - p.z) < p.r))) return [x, z];
    }
    return [0, 600];
  };
  for (let i = 0; i < NC; i++) {
    const [x, z] = spot(i, 11.1, 22, 260);
    const h = 9 + hash(i, 12.2) * 7;
    m.compose(v.set(x, heightAt(x, z) - 0.3, z), q, s.set(1 + h * 0.06, h, 1 + h * 0.06));
    cypresses.setMatrixAt(i, m);
  }
  for (let i = 0; i < NP; i++) {
    const [x, z] = spot(i, 21.3, 30, 230);
    const h = 8 + hash(i, 22.2) * 5, y = heightAt(x, z) - 0.3;
    m.compose(v.set(x, y, z), q, s.set(1.4, h, 1.4));
    pineTrunks.setMatrixAt(i, m);
    const w = 5 + hash(i, 23.3) * 3;
    m.compose(v.set(x, y + h, z), q, s.set(w, 1.6, w));
    pineTops.setMatrixAt(i, m);
  }
  // lemon trees: short trunk, dense round crown, yellow fruit dotted over the crown
  const lemonTrunks = new THREE.InstancedMesh(trunk, mat(0x6e5434), NL);
  const lemonCrowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), mat(0x3f6a2a, { roughness: 0.7 }), NL);
  const lemons = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), mat(0xf2cf2e, { roughness: 0.55 }), NL * LEMONS_PER_TREE);
  let li = 0;
  for (let i = 0; i < NL; i++) {
    const [x, z] = spot(i, 31.7, 21, 150);
    const y = heightAt(x, z) - 0.2, h = 2.2 + hash(i, 32.2) * 1.2, w = 2.4 + hash(i, 33.3) * 1.1;
    m.compose(v.set(x, y, z), q, s.set(1, h, 1));
    lemonTrunks.setMatrixAt(i, m);
    const cy = y + h + w * 0.7;
    m.compose(v.set(x, cy, z), q, s.set(w, w * 0.85, w));
    lemonCrowns.setMatrixAt(i, m);
    for (let k = 0; k < LEMONS_PER_TREE; k++) {
      const a = hash(i * 31 + k, 34.4) * Math.PI * 2, el = -0.4 + hash(i * 17 + k, 35.5) * 1.2;
      m.compose(v.set(x + Math.cos(a) * Math.cos(el) * w * 0.98, cy + Math.sin(el) * w * 0.83, z + Math.sin(a) * Math.cos(el) * w * 0.98), q, s.set(0.26, 0.2, 0.2));
      lemons.setMatrixAt(li++, m);
    }
  }
  [cypresses, pineTrunks, pineTops, lemonTrunks, lemonCrowns, lemons].forEach((o) => out.push(o));
  return out;
}

// Vineyard patches: parallel rows of vine bushes on wooden posts, following the slopes.
const VINEYARDS = [
  { angle: 0.25, r: 95, rows: 12, len: 44, rot: 0.3 },
  { angle: 2.9, r: 120, rows: 10, len: 40, rot: -0.5 },
  { angle: 4.4, r: 88, rows: 9, len: 34, rot: 1.1 },
  { angle: 1.55, r: 150, rows: 12, len: 50, rot: 0.0 },
];
function buildVineyards() {
  const bushGeo = new THREE.IcosahedronGeometry(1, 0); // 20 triangles: they are small and far away
  const SPACING = 1.3, ROW_GAP = 3.2;
  const total = VINEYARDS.reduce((n, v) => n + v.rows * Math.ceil(v.len / SPACING), 0);
  const bushes = new THREE.InstancedMesh(bushGeo, mat(0xffffff, { roughness: 0.85 }), total);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 1, 0.15).translate(0, 0.5, 0), mat(0x7a5c3a), VINEYARDS.reduce((n, v) => n + v.rows * 2, 0));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  const greens = ['#5f7f2e', '#6f8f35', '#557328', '#7d9440'];
  let b = 0, p = 0;
  for (const vy of VINEYARDS) {
    const cx = Math.cos(vy.angle) * vy.r, cz = Math.sin(vy.angle) * vy.r;
    const dir = new THREE.Vector2(Math.cos(vy.rot), Math.sin(vy.rot)), side = new THREE.Vector2(-dir.y, dir.x);
    for (let row = 0; row < vy.rows; row++) {
      const off = (row - (vy.rows - 1) / 2) * ROW_GAP;
      const n = Math.ceil(vy.len / SPACING);
      for (let k = 0; k < n; k++) {
        const t = k * SPACING - vy.len / 2;
        const x = cx + dir.x * t + side.x * off, z = cz + dir.y * t + side.y * off;
        const s = 0.75 + hash(b, 41.1) * 0.3;
        m.compose(pos.set(x, heightAt(x, z) + 0.9, z), q, sc.set(s * 0.8, s, s * 0.8));
        bushes.setMatrixAt(b, m);
        bushes.setColorAt(b++, c.set(greens[(hash(b, 42.2) * greens.length) | 0]));
        if (k === 0 || k === n - 1) {
          m.compose(pos.set(x, heightAt(x, z), z), q, sc.set(1, 1.9, 1));
          posts.setMatrixAt(p++, m);
        }
      }
    }
  }
  return [bushes, posts];
}

// Marble pedestal for a statue; the statue itself (a Venus model) is loaded by scene.js and set on top.
export const PEDESTAL_TOP = 2.88;
function buildPedestal(marble) {
  const g = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), marble);
  pedestal.position.y = 1.3;
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(3, 0.35, 3), marble);
  cornice.position.y = 2.7;
  g.add(pedestal, cornice);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function buildStatues(marble, roadAngle) {
  const g = new THREE.Group();
  const spots = [];
  const place = (angle, r) => {
    const s = buildPedestal(marble);
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    s.position.set(x, Math.max(0, heightAt(x, z)) - (r < PLAZA_R + 2 ? 0 : 0.3), z);
    s.rotation.y = Math.atan2(-x, -z); // facing the column
    g.add(s);
    spots.push({ position: s.position.clone().setY(s.position.y + PEDESTAL_TOP), rotationY: s.rotation.y, pedestal: s });
  };
  // a single statue at the plaza's edge, beside the road to the Colosseum
  place(roadAngle - 0.62, PLAZA_R - 1.6);
  // Phones see less around the column: there the statue stands in the open grass to the right of the column
  // as seen from the countdown stop (camera at about (-9, 17.5, 2.6)), turned towards that camera.
  const px = 44, pz = -3.6, py = Math.max(0, heightAt(px, pz)) - 0.3;
  spots[0].phone = { position: new THREE.Vector3(px, py + PEDESTAL_TOP, pz), rotationY: Math.atan2(-9 - px, 2.6 - pz) };
  g.userData.statueSpots = spots;
  return g;
}

export function buildRome() {
  const root = new THREE.Group();
  const paving = pavingTexture();
  const stone = stoneTexture();
  const stoneMat = mat(0xffffff, { map: stone });
  const roofMat = mat(0xa8603a);

  // landmark placement (angle around the column, distance)
  const at = (angle, r) => ({ x: Math.cos(angle) * r, z: Math.sin(angle) * r });
  const L = {
    temple: { ...at(0.9, 52), r: 22 },
    pantheon: { ...at(5.4, 95), r: 30 },
    // behind the column as seen from the dress-code stop, a little off-centre so the column doesn't hide it
    colosseum: { ...at(3.95, 140), r: 62 },
  };

  root.add(buildTerrain());
  root.add(buildPlaza(paving, stone));
  root.add(buildRoad(3.95, paving)); // the road leads to the Colosseum
  root.add(buildRuins(stoneMat));

  const temple = buildTemple(stoneMat, roofMat);
  temple.position.set(L.temple.x, heightAt(L.temple.x, L.temple.z), L.temple.z);
  temple.rotation.y = -0.9 - Math.PI / 2; // facing the column
  const pantheon = buildPantheon(stoneMat, roofMat);
  pantheon.position.set(L.pantheon.x, heightAt(L.pantheon.x, L.pantheon.z) - 0.5, L.pantheon.z);
  pantheon.rotation.y = -3.6 - Math.PI / 2;
  const colosseum = buildColosseum();
  colosseum.position.set(L.colosseum.x, heightAt(L.colosseum.x, L.colosseum.z) - 1, L.colosseum.z);
  colosseum.rotation.y = 0.4;
  root.add(temple, pantheon, colosseum);
  root.userData.colosseum = colosseum; // scene.js can swap it for a detailed model
  root.add(buildAqueduct(1.6, 2.6, 250));

  // vineyard patches keep houses and trees out
  const vineyardAvoid = VINEYARDS.map((v) => ({ ...at(v.angle, v.r), r: v.len / 2 + v.rows * 1.8 }));
  // keep a clear view from the column to the Colosseum: nothing tall inside this widening corridor
  const corridor = {
    test: (x, z) => {
      const len = Math.hypot(L.colosseum.x, L.colosseum.z);
      const t = (x * L.colosseum.x + z * L.colosseum.z) / (len * len);
      if (t < 0 || t > 1) return false;
      const dist = Math.abs(x * L.colosseum.z - z * L.colosseum.x) / len;
      return dist < 22 + t * 45;
    },
  };
  const avoid = [L.temple, L.pantheon, L.colosseum, { x: 0, z: 0, r: 40 }, corridor, ...vineyardAvoid];
  buildVineyards().forEach((o) => root.add(o));
  buildHouses(avoid).forEach((o) => root.add(o));
  buildTrees([L.temple, L.pantheon, L.colosseum, { x: 0, z: 0, r: 20 }, corridor, ...vineyardAvoid]).forEach((o) => root.add(o));
  const statues = buildStatues(mat(0xf1ebe0, { roughness: 0.6 }), 3.95);
  root.add(statues);
  root.userData.statueSpots = statues.userData.statueSpots;

  root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return root;
}
