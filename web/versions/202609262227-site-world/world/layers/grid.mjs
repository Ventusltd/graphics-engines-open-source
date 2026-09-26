// Layer: grid. Overhead lines and substations from a per-site file, drawn as quiet wireframe on the ground.
// Self-contained: no imports (it runs from a blob URL). The towers and conductors come from the shared overhead
// builder the substrate hands in as api.lib.overhead.buildOverhead; without it the layer draws nothing and says so.
//
// Config (manifest): { path, sha256 } of the site file, fetched through the substrate's hash check. File format:
//   { licence, attribution,
//     lines: [{ voltage_kv, operator, points: [[e, n], ...], towers: [indices into points] }],
//     substations: [{ e, n, voltage_kv, operator }] }
// in British National Grid metres. Positions are turned into local metres with api.origin(). Where a line gives
// no towers, every point is a tower. Points that are not towers are ignored: a span runs straight tower to tower.
//
// Towers stand on the ground (ctx.heightAt). Clearance is measured against the same ground, 1 m along each
// conductor, and the lowest per span is shown in layer.status. Towers and compounds are solids (walkers and the
// drone are blocked). The geometry is rebuilt when the ground or the origin changes.
//
// TOWER SHAPES, SAG AND COMPOUND SIZES ARE ASSUMED (typical, not surveyed). Positions and voltages are the file's.

// Voltage class from a nominal kV. Bands: >= 345 is 400 kV, >= 220 is 275 kV, >= 66 is 132 kV, else 33 kV.
export function voltageClass(kv) {
  const v = Number(kv);
  if (!(v > 0)) return '33kV';
  return v >= 345 ? '400kV' : v >= 220 ? '275kV' : v >= 66 ? '132kV' : '33kV';
}

// Quiet colours on the dark background, by class. Blue for 400 and red for 275 follow the usual UK map convention.
export const COLORS = {
  '400kV': [0.55, 0.66, 1.00, 0.62],
  '275kV': [1.00, 0.56, 0.56, 0.55],
  '132kV': [1.00, 0.80, 0.48, 0.50],
  '33kV': [0.56, 0.86, 0.62, 0.45],
};

// Compound footprint (east-west by north-south, metres) and fence height by class. ASSUMED: typical outdoor
// air-insulated compounds, proportioned by eye, not from any survey or public source checked in this session.
export const COMPOUND = {
  '400kV': { w: 300, d: 200 },
  '275kV': { w: 220, d: 150 },
  '132kV': { w: 90, d: 60 },
  '33kV': { w: 30, d: 20 },
};
export const FENCE_H = 2.4;       // assumed palisade fence height, metres
const FENCE_STEP = 10;            // fence line drapes on the ground every 10 m or less
const LIST_MAX = 30;              // spans listed by name in the status line

const finite = (h, d = 0) => (Number.isFinite(h) ? h : d);
const isPt = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);

// Pure: the file -> { lines: [{ cls, operator, towers: [{ id, e, n }] }], substations: [{ cls, e, n, operator }] }.
// Throws on a file that is not the expected shape; skips individual entries that are unusable.
export function parseGridFile(j) {
  if (!j || typeof j !== 'object' || !Array.isArray(j.lines)) throw Error('grid file has no lines list');
  const lines = [];
  j.lines.forEach((l, i) => {
    const pts = Array.isArray(l?.points) ? l.points : [];
    let idx = Array.isArray(l?.towers) && l.towers.length ? l.towers : pts.map((_, k) => k);
    idx = [...new Set(idx.filter(k => Number.isInteger(k) && k >= 0 && k < pts.length && isPt(pts[k])))].sort((a, b) => a - b);
    if (!idx.length) return;
    const cls = voltageClass(l.voltage_kv);
    lines.push({ cls, kv: l.voltage_kv, operator: l.operator || '', towers: idx.map(k => ({ id: `L${i}T${k}`, e: pts[k][0], n: pts[k][1] })) });
  });
  const substations = (Array.isArray(j.substations) ? j.substations : [])
    .filter(s => s && Number.isFinite(s.e) && Number.isFinite(s.n))
    .map(s => ({ cls: voltageClass(s.voltage_kv), kv: s.voltage_kv, operator: s.operator || '', e: s.e, n: s.n }));
  return { lines, substations, licence: j.licence || '', attribution: j.attribution || '' };
}

// Pure: a compound's fence as line pairs relative to o, draped on heightAt, plus its solid box (absolute local).
export function compound(x, y, cls, heightAt, o = [0, 0, 0]) {
  const { w, d } = COMPOUND[cls] || COMPOUND['33kV'];
  const c = [[x - w / 2, y - d / 2], [x + w / 2, y - d / 2], [x + w / 2, y + d / 2], [x - w / 2, y + d / 2]];
  const out = [], g = (px, py) => finite(heightAt(px, py), finite(heightAt(x, y)));
  let lo = Infinity, hi = -Infinity;
  const P = (px, py, up) => { const z = g(px, py); lo = Math.min(lo, z); hi = Math.max(hi, z); return [px - o[0], py - o[1], z + up - o[2]]; };
  const L = (a, b) => out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = c[k], [bx, by] = c[(k + 1) % 4];
    const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / FENCE_STEP));
    for (let i = 0; i < m; i++) {
      const f0 = i / m, f1 = (i + 1) / m;
      const x0 = ax + (bx - ax) * f0, y0 = ay + (by - ay) * f0, x1 = ax + (bx - ax) * f1, y1 = ay + (by - ay) * f1;
      L(P(x0, y0, 0), P(x1, y1, 0));                       // foot of the fence
      L(P(x0, y0, FENCE_H), P(x1, y1, FENCE_H));           // top rail
    }
    L(P(ax, ay, 0), P(ax, ay, FENCE_H));                   // corner post
  }
  // A cross at the centre marks the compound from the air.
  const s = Math.min(w, d) * 0.15;
  L(P(x - s, y, 0.2), P(x + s, y, 0.2)); L(P(x, y - s, 0.2), P(x, y + s, 0.2));
  return { positions: out, solid: { min: [x - w / 2, y - d / 2, lo], max: [x + w / 2, y + d / 2, hi + FENCE_H] } };
}

// Pure: for each span, true when both towers and every point under it (5 m steps) have measured ground.
export function measuredSpans(towers, measuredAt) {
  const out = [];
  for (let k = 0; k + 1 < towers.length; k++) {
    const A = towers[k], B = towers[k + 1], n = Math.max(2, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / 5));
    let ok = true;
    for (let s = 0; s <= n && ok; s++) ok = Number.isFinite(measuredAt(A.x + (B.x - A.x) * s / n, A.y + (B.y - A.y) * s / n));
    out.push(ok);
  }
  return out;
}

// Pure: the status line from per-span clearances.
export function clearanceStatus(model, clearances) {
  const nT = model.lines.reduce((s, l) => s + l.towers.length, 0);
  const head = `grid: ${model.lines.length} lines, ${nT} towers, ${model.substations.length} substations`;
  if (!clearances.length) return `${head}; no spans; tower and compound sizes assumed`;
  const fmt = c => (Number.isFinite(c.minClearance) ? c.minClearance.toFixed(1) + (c.minClearance < c.required ? '!' : '') : 'not measured');
  const shown = clearances.slice(0, LIST_MAX).map(c => `${c.from}-${c.to} ${fmt(c)}`);
  if (clearances.length > LIST_MAX) shown.push(`+${clearances.length - LIST_MAX} more`);
  const measured = clearances.filter(c => Number.isFinite(c.minClearance));
  const ASSUMED = 'assumed: tower positions inferred from OpenStreetMap, attachment heights and sag typical,'
    + ' required clearance figure to be confirmed against ESQCR, compound sizes';
  if (!measured.length) return `${head}; clearance not measured yet (walk or fly near the line so its ground loads); ${ASSUMED}`;
  const low = measured.reduce((a, b) => (b.minClearance < a.minClearance ? b : a));
  const below = measured.filter(c => c.minClearance < c.required).length;
  return `${head}; min ground clearance per span (m): ${shown.join(', ')}; lowest measured ${fmt(low)} on ${low.from}-${low.to}` +
    ` (needs ${low.required}); ${below} measured span${below === 1 ? '' : 's'} below the figure; ${ASSUMED}`;
}

// Ground on the straight line between the tower grounds of the span nearest (x, y).
function straightGround(towers, x, y) {
  if (towers.length < 2) return towers[0]?.ground ?? 0;
  let best = Infinity, h = towers[0].ground;
  for (let k = 0; k + 1 < towers.length; k++) {
    const A = towers[k], B = towers[k + 1], dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1;
    const f = Math.min(1, Math.max(0, ((x - A.x) * dx + (y - A.y) * dy) / L2));
    const d = Math.hypot(A.x + dx * f - x, A.y + dy * f - y);
    if (d < best) { best = d; h = A.ground + (B.ground - A.ground) * f; }
  }
  return h;
}

// Pure: build every batch, solid and clearance for the model at the given origin and ground.
export function buildGrid(model, origin, heightAt, buildOverhead, measuredAt = heightAt) {
  const batches = [], solids = [], clearances = [];
  const local = (e, n) => [e - origin.e, n - origin.n];
  model.lines.forEach((l, i) => {
    const towers = l.towers.map(t => { const [x, y] = local(t.e, t.n); return { id: t.id, x, y, ground: finite(heightAt(x, y)), type: l.cls }; });
    const known = measuredSpans(towers, measuredAt);
    // Off the loaded ground, clearance is measured to the straight line between the nearest span's tower grounds.
    const out = buildOverhead(towers, {
      groundAt: (x, y) => { const h = heightAt(x, y); return Number.isFinite(h) ? h : straightGround(towers, x, y); }
    });
    const o = [towers[0].x, towers[0].y, towers[0].ground], pos = new Float32Array(out.lines.length);
    for (let k = 0; k < pos.length; k += 3) { pos[k] = out.lines[k] - o[0]; pos[k + 1] = out.lines[k + 1] - o[1]; pos[k + 2] = out.lines[k + 2] - o[2]; }
    batches.push({ key: `grid/line/${i}`, origin: o, color: COLORS[l.cls], positions: pos });
    solids.push(...out.solids);
    // Clearance is only reported where the whole span stands on measured LiDAR ground; elsewhere it is not measured.
    clearances.push(...out.clearances.map(c => (known[c.span] ? { ...c, line: i, cls: l.cls }
      : { ...c, minClearance: NaN, at: null, line: i, cls: l.cls, note: 'ground not measured under this span' })));
  });
  model.substations.forEach((s, i) => {
    const [x, y] = local(s.e, s.n), o = [x, y, finite(heightAt(x, y))];
    const c = compound(x, y, s.cls, heightAt, o);
    batches.push({ key: `grid/substation/${i}`, origin: o, color: COLORS[s.cls], positions: new Float32Array(c.positions) });
    solids.push(c.solid);
  });
  return { batches, solids, clearances };
}

export function createGrid() {
  let api = null, model = null, state = 'idle'; // idle | loading | ready | failed
  let built = { version: null, batches: [], solids: [], clearances: [] };

  function load() {
    if (state !== 'idle' || !api) return;
    const path = api.config?.path, sha = api.config?.sha256;
    if (!path || !sha) { state = 'failed'; layer.status = 'no grid file configured (config.path and config.sha256)'; return; }
    state = 'loading'; layer.status = 'loading ' + path;
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      model = parseGridFile(j);
      state = 'ready';
      layer.status = `grid file loaded: ${model.lines.length} lines, ${model.substations.length} substations`;
      api.invalidate({ ground: false });
    }).catch(e => { state = 'failed'; layer.status = 'grid file failed: ' + e.message; });
  }

  const layer = {
    id: 'grid',
    status: 'waiting for init',
    clearances: [],
    init(a) { api = a; layer.status = 'ready to load'; load(); },
    lines(ctx) {
      if (!api) return [];
      if (state === 'idle') load();
      if (state !== 'ready') return [];
      const lib = api.lib?.overhead;
      if (!lib || typeof lib.buildOverhead !== 'function') { layer.status = 'waiting: api.lib.overhead.buildOverhead not provided'; return []; }
      const o = typeof api.origin === 'function' ? api.origin() : { e: 0, n: 0, id: 0 };
      const heightAt = typeof ctx.heightAt === 'function' ? ctx.heightAt : () => NaN;
      const version = `${o.e},${o.n},${o.id}@${ctx.groundVersion ?? 0}`;
      if (built.version === version && built.heightAt === heightAt) return built.batches;
      try {
        const measured = typeof ctx.measuredAt === 'function' ? ctx.measuredAt : heightAt;
        const g = buildGrid(model, o, heightAt, lib.buildOverhead, measured);
        built = { version, heightAt, ...g, batches: g.batches.map(b => ({ ...b, version })) };
        layer.clearances = g.clearances;
        layer.status = clearanceStatus(model, g.clearances);
      } catch (e) {
        built = { version, heightAt, batches: [], solids: [], clearances: [] };
        layer.status = 'grid build failed: ' + e.message;
      }
      return built.batches;
    },
    // Boxes from the last build (towers and compounds). Empty until the first frame has drawn the grid.
    solids() { return built.solids; },
    debug: () => ({ state, model, version: built.version })
  };
  return layer;
}

export default createGrid();
