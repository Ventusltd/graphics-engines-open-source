// Design tools in the world: Trench and Cable, drawn by clicking the ground. The substrate hands in the ground,
// the origin and the viewer; this module owns the design panel (world.html #design), the design held in memory
// and the lines it draws. Routes are kept in national-grid metres, so they survive every move of the origin.
// A trench cuts the ground (composeGround): walkers and the drone follow its floor. A cable is laid in trefoil
// on the floor of its own trench, with the governing installation bend radius for its size; bends tighter than
// that are flagged. Numbers come from measure.mjs, so the readout says what the panels and exports will say.

import { toBng, toLocal } from './origin.mjs';
import { rayFromScreen, pickGround } from './pick.mjs';
import { createRouteTool, describeControls } from './route-tool.mjs';
import { createTrench, composeGround } from './trench.mjs';
import { routeCable } from './cable-route.mjs';
import { profile, cableSummary, bendRule } from './measure.mjs';
import { formatNumber, formatLength, formatVolume, formatGradient } from './measure-format.mjs';
import { sectionLabel, cableLabel, pressWord, distanceLabel } from './labels.mjs';

const COLOUR = { draft: [1, 1, 1, 0.95], trench: [1, 0.78, 0.45, 1], cable: [0.55, 1, 0.62, 1], tight: [1, 0.36, 0.3, 1] };
const WHEN = 'installation'; // the cable is being pulled in: the larger of the two radii governs the route
const SVG = 'http://www.w3.org/2000/svg';

// deps: { doc, canvas, fov, baseHeight(x, y), origin(), viewer() -> state, invalidate({ ground }), redraw(), assets() }
// assets() -> [{ label, e, n }] grid equipment to measure the route's end against (may be empty).
export function createDesign({ doc, canvas, fov, baseHeight, measured = () => NaN, origin, viewer, invalidate, redraw, assets = () => [] }) {
  const $ = id => doc.getElementById(id);
  const catalogue = { sections: [], cables: [], rules: [], json: null };
  // view: what the panel is showing. 'choose' a tool, 'draw' a route, or the 'result' of the one just finished.
  const design = { tool: null, trenches: [], cables: [], finished: 0, drafts: 0, last: null, view: 'choose' };
  const coarse = matchMedia('(pointer: coarse)').matches, press = pressWord(coarse);
  let built = { o: -1, g: -1, f: -1, key: '', ground: baseHeight, trenches: [], cables: [] };
  let groundVersion = () => 0;
  const route = createRouteTool({ onChange: () => { design.drafts++; if (route.state.points.length) design.view = 'draw'; showReadout(); redraw(); } });

  const section = id => catalogue.sections.find(s => s.id === id) || catalogue.sections[0];
  const cableSpec = id => catalogue.cables.find(c => c.id === id) || catalogue.cables[0];
  const toLocalPts = path => path.map(p => toLocal(origin(), p.e, p.n));
  const trenchOf = (sectionId, pts) => {
    const s = section(sectionId);
    return createTrench({ path: pts, width: s.trench_width_m, depth: s.trench_depth_m });
  };
  // Trefoil on the floor: the centreline is lifted so the lower two cores rest on it.
  const cableOf = (cableId, ground, pts) => {
    const spec = cableSpec(cableId), od = spec.od_mm / 1000;
    const bend = bendRule(catalogue.json, { voltageKv: spec.voltage_kv, when: WHEN, odMm: spec.od_mm });
    // The bend rule applies at the cable's inner edge, so the centreline bends at rule + OD/2.
    const r = routeCable({ points: pts, minBendRadius: (bend.radius || 0) + od / 2,
      depthBelowGround: -(od / 2 + od / (2 * Math.sqrt(3))), groundAt: ground, formation: 'trefoil', spacing: od, step: 0.5 });
    return Object.assign(r, { spec, bend, summary: cableSummary(r, { cables: catalogue.json, cableId: spec.id, when: WHEN }) });
  };

  // Local geometry, rebuilt only when the origin, the ground or the finished design changes (plain number checks:
  // heightAt runs this for every height anyone asks for).
  function build() {
    const o = origin(), g = groundVersion();
    if (built.o === o.id && built.g === g && built.f === design.finished) return built;
    const all = [...design.trenches, ...design.cables];
    const trenches = all.map(t => trenchOf(t.section, toLocalPts(t.path)));
    const ground = trenches.length ? composeGround(baseHeight, trenches) : baseHeight;
    built = { o: o.id, g, f: design.finished, key: `${o.id}:${g}:${design.finished}`, ground, trenches, cables: [] };
    built.cables = design.cables.map(c => cableOf(c.cable, ground, toLocalPts(c.path)));
    return built;
  }
  const heightAt = (x, y) => build().ground(x, y);

  // Positions relative to their first point, worked out in doubles, so far-out lines stay sharp on the GPU.
  function batch(key, version, pos, color) {
    if (!pos || pos.length < 6) return null;
    const o = [pos[0], pos[1], pos[2]], out = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) out[i] = pos[i] - o[i % 3];
    return { key, version, positions: out, color, origin: o };
  }
  const marker = (v, [x, y, z], h, arm) => v.push(x, y, z, x, y, z + h, x - arm, y, z + h, x + arm, y, z + h, x, y - arm, z + h, x, y + arm, z + h);
  const tightIndices = c => [...new Set([...c.violations.map(v => v.index), ...c.summary.below.map(b => b.index)])].sort((a, b) => a - b);

  function batches() {
    const b = build(), out = [];
    b.trenches.forEach((t, i) => out.push(batch('design-trench-' + i, b.key, t.wallLines(baseHeight), COLOUR.trench)));
    b.cables.forEach((c, i) => {
      out.push(batch('design-cable-' + i, b.key, c.drawLines({ includeCentreline: false }), COLOUR.cable));
      const tight = [], pts = toLocalPts(design.cables[i].path);
      for (const k of tightIndices(c)) { const [x, y] = pts[k]; marker(tight, [x, y, heightAt(x, y)], 3, 1.2); }
      out.push(batch('design-tight-' + i, b.key, tight, COLOUR.tight));
    });
    const d = route.state.points, v = [];
    for (let i = 0; i < d.length; i++) {
      const [x, y] = d[i], z = heightAt(x, y) + 0.05;
      if (i) { const [px, py] = d[i - 1]; v.push(px, py, heightAt(px, py) + 0.05, x, y, z); }
      marker(v, [x, y, z], 1.5, 0.4);
    }
    out.push(batch('design-draft', `${b.key}:${design.drafts}`, v, COLOUR.draft));
    return out.filter(Boolean);
  }

  // ---- readout ----------------------------------------------------------------------------------------
  // Where the route ends against the grid: the nearest substation if one is in reach, else says so plainly and
  // gives the nearest pylon. A route may end at a pylon or any drawn point.
  const REACH_M = 5000;
  function nearestAsset(pt) {
    const o = origin(), end = toBng(o, pt[0], pt[1]), list = assets();
    const near = kind => list.filter(a => a.kind === kind).map(a => ({ ...a, d: Math.hypot(a.e - end.e, a.n - end.n) }))
      .sort((x, y) => x.d - y.d)[0] || null;
    if (!list.length) return 'no grid equipment loaded here';
    const sub = near('substation'), tower = near('tower');
    if (sub && sub.d <= REACH_M) return `${sub.label}, ${distanceLabel(sub.d)} from the end`;
    const none = `no substation within ${formatNumber(REACH_M / 1000, 0)} km`;
    return tower ? `${none} · nearest ${tower.label} ${distanceLabel(tower.d)} from the end` : none;
  }
  // Level change is only stated where every point and every midpoint of the route is on measured ground.
  const onMeasuredGround = pts => pts.every((p, i) => Number.isFinite(measured(p[0], p[1])) &&
    (i === 0 || Number.isFinite(measured((p[0] + pts[i - 1][0]) / 2, (p[1] + pts[i - 1][1]) / 2))));
  // Rows for the readout and the level profile. spoil: undefined = not yet worked out.
  function measure(kind, sectionId, cableId, pts, spoil) {
    const s = section(sectionId), t = trenchOf(s.id, pts);
    const rows = [['Trench', `${sectionLabel(s)} · ${s.trench_width_m} m wide × ${s.trench_depth_m} m deep`]];
    let plan = pts;
    if (kind === 'cable') {
      const c = cableOf(cableId, heightAt, pts), cs = c.summary, tight = tightIndices(c);
      plan = c.centreline.map(p => [p[0], p[1]]);
      rows.unshift(['Cable', cableLabel(c.spec)]);
      rows.push(['Minimum bend radius', cs.required.radius == null ? `no ${WHEN} rule for this cable`
        : `${formatNumber(cs.required.radius, 2)} m (${formatNumber(cs.required.multiple, 0)} × OD, ${WHEN})`],
      ['Cable length (plan)', formatLength(cs.length2d)], ['Cable length (3D)', formatLength(cs.length3d)],
      ['Tight bends', tight.length ? `${tight.length} (at point${tight.length > 1 ? 's' : ''} ${tight.map(k => k + 1).join(', ')})` : 'none']);
    }
    const p = profile(baseHeight, plan, 1);
    rows.push(['Trench length (plan)', formatLength(t.length2d)], ['Trench length (3D)', formatLength(t.length3dOn(baseHeight))],
      ['Spoil volume', spoil === undefined ? 'on finish' : spoil === null ? 'working out…' : formatVolume(spoil, 2)],
      ...(onMeasuredGround(plan) ? [['Level change', `${formatNumber(p.max - p.min, 2)} m (ground ${formatNumber(p.min, 2)} to ${formatNumber(p.max, 2)} m above sea level)`],
        ['Steepest gradient', formatGradient(p.gradient.max)]]
        : [['Level change', 'not known: no measured ground (terrain tiles) under this route']]),
      ['Nearest grid', nearestAsset(pts[pts.length - 1])]);
    return { rows, profile: onMeasuredGround(plan) ? p : null, depth: s.trench_depth_m };
  }
  function drawProfile(m) {
    const box = $('design-profile-box'), svg = $('design-profile');
    box.hidden = !m;
    if (!m) return;
    const W = 300, H = 90, L = 4, R = 296, T = 14, B = 76, pr = m.profile;
    const lo = pr.min - m.depth, hi = Math.max(pr.max, lo + 0.5), len = Math.max(pr.length2d, 1e-6);
    const X = s => L + (s / len) * (R - L), Y = z => B - ((z - lo) / (hi - lo)) * (B - T);
    const line = (dz, cls) => {
      const el = doc.createElementNS(SVG, 'polyline');
      el.setAttribute('points', pr.pairs.map(([s, z]) => `${X(s).toFixed(1)},${Y(z - dz).toFixed(1)}`).join(' '));
      el.setAttribute('class', cls); return el;
    };
    const text = (x, y, s, anchor = 'start') => {
      const el = doc.createElementNS(SVG, 'text');
      Object.entries({ x, y, 'text-anchor': anchor }).forEach(([k, v]) => el.setAttribute(k, v));
      el.textContent = s; return el;
    };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren(line(0, 'ground'), line(m.depth, 'floor'), text(L, 10, `${formatNumber(hi, 1)} m`),
      text(L, H - 2, `${formatNumber(lo, 1)} m`), text(R, H - 2, formatLength(pr.length2d), 'end'));
  }
  // One line that says what to do next, and which parts of the panel are showing (world.html styles #design[data-state]).
  function hint(pts) {
    if (!design.tool) return 'Choose Trench or Cable';
    if (design.view === 'result' && !pts.length) return `${design.tool === 'cable' ? 'Cable' : 'Trench'} finished. ${press} the ground to draw another.`;
    if (!pts.length) return `${press} two or more points on the ground, then Done`;
    if (pts.length === 1) return `1 point · ${press.toLowerCase()} the next point`;
    return `${pts.length} points · ${press.toLowerCase()} more, or Done`;
  }
  function showReadout() {
    const pts = route.state.points.map(p => [p[0], p[1]]);
    if (!design.tool && design.view === 'draw') design.view = 'choose';
    let m = design.last || { rows: [['Status', design.tool ? `${press.toLowerCase()} the ground to start a ${design.tool}` : 'choose Trench or Cable']] };
    if (design.tool && pts.length >= 2) {
      try { m = measure(design.tool, $('trench-section').value, $('cable-type').value, pts); } catch (e) { m = { rows: [['Status', e.message]] }; }
    } else if (design.tool && pts.length === 1) m = { rows: [['Status', '1 point · add another']] };
    $('design').dataset.state = design.view;
    $('design-hint').textContent = hint(pts);
    $('design-readout').replaceChildren(...m.rows.flatMap(([k, v]) => {
      const dt = doc.createElement('dt'), dd = doc.createElement('dd');
      dt.textContent = k; dd.textContent = v;
      if (k === 'Tight bends' && v !== 'none') dd.className = 'warn';
      return [dt, dd];
    }));
    drawProfile(m.profile ? m : null);
  }

  // ---- actions ----------------------------------------------------------------------------------------
  function finish() {
    const pts = route.state.points, kind = design.tool;
    if (!kind || !route.finish()) return false;
    const o = origin(), path = pts.map(([x, y]) => toBng(o, x, y)), plan = pts.map(p => [p[0], p[1]]);
    const item = { path, section: $('trench-section').value, ...(kind === 'cable' ? { cable: $('cable-type').value } : {}) };
    (kind === 'trench' ? design.trenches : design.cables).push(item);
    design.finished++;
    const last = measure(kind, item.section, item.cable, plan, null); // measured on the ground it has just cut
    design.last = last;
    design.view = 'result';
    route.clear();
    invalidate({ ground: true }); // new ground: walkers and the drone follow the trench floor
    // Spoil is a fine grid over the whole trench; work it out after the frame, then say it.
    setTimeout(() => {
      const spoil = trenchOf(item.section, plan).spoilVolumeOn(baseHeight);
      item.spoil_m3 = spoil;
      if (design.last === last) { design.last = measure(kind, item.section, item.cable, plan, spoil); showReadout(); }
    }, 0);
    return true;
  }
  function choose(tool) {
    design.tool = design.tool === tool ? null : tool;
    design.view = design.tool ? 'draw' : 'choose';
    route.clear();
    for (const b of doc.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === design.tool));
    showReadout();
  }
  function pickAt(x, y) {
    if (!design.tool) return false;
    const s = viewer();
    const ray = rayFromScreen(x, y, canvas.clientWidth, canvas.clientHeight, s.pos, s.yaw, s.pitch, fov);
    const p = pickGround(ray, heightAt, { maxDistance: 3000 });
    return p ? route.addPoint(p) : false;
  }
  // The origin moved by (dx, dy): the route being drawn moves the other way, so it stays put in the world.
  const shift = (dx, dy) => route.state.points.forEach((p, i) => route.movePoint(i, [p[0] - dx, p[1] - dy, p[2]]));

  // ---- page wiring ------------------------------------------------------------------------------------
  for (const b of doc.querySelectorAll('[data-tool]')) b.addEventListener('click', () => { choose(b.dataset.tool); canvas.focus(); });
  $('design-undo').addEventListener('click', () => route.removeLast());
  $('design-finish').addEventListener('click', () => finish());
  $('design-clear').addEventListener('click', () => route.clear());
  // Section and cable choices sit behind Options; on a phone, choosing one folds them away again so the ground stays clear.
  const options = open => { $('design-options').hidden = !open; $('design-options-toggle').setAttribute('aria-expanded', String(open)); };
  $('design-options-toggle').addEventListener('click', () => options($('design-options').hidden));
  for (const id of ['trench-section', 'cable-type']) $(id).addEventListener('change', () => { if (coarse) options(false); showReadout(); canvas.focus(); });
  addEventListener('keydown', e => {
    if (!design.tool || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target?.tagName)) return;
    if (e.code === 'Backspace') { route.removeLast(); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { finish(); e.preventDefault(); }
    else if (e.code === 'Escape') route.clear();
  });
  $('design-keys').className = coarse ? 'touch' : 'keys';
  $('design-keys').replaceChildren(...describeControls({ touch: coarse }).flatMap(([k, v]) => {
    const dt = doc.createElement('dt'), dd = doc.createElement('dd');
    dt.textContent = k; dd.textContent = v; return [dt, dd];
  }));

  async function loadCatalogue() {
    try {
      const get = async p => { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw Error(`${p}: HTTP ${r.status}`); return r.json(); };
      const [cables, trenches] = await Promise.all([get('./world/data/cables.json'), get('./world/data/trench-sections.json')]);
      Object.assign(catalogue, { sections: trenches.sections || [], cables: cables.cables || [], rules: cables.rules || [], json: cables });
      const fill = (id, items, label, chosen) => $(id).replaceChildren(...items.map(it => {
        const o = new Option(label(it), it.id); o.selected = it.id === chosen; return o;
      }));
      fill('trench-section', catalogue.sections, s => `${sectionLabel(s)} · ${s.trench_width_m} × ${s.trench_depth_m} m`, '33kv-1-dno');
      fill('cable-type', catalogue.cables, cableLabel, '33kv-1c-al-xlpe-300');
    } catch (e) {
      for (const b of doc.querySelectorAll('[data-tool]')) b.disabled = true;
      design.last = { rows: [['Status', 'design data could not be loaded: ' + e.message]] };
    }
    showReadout();
  }

  return {
    heightAt, batches, pickAt, shift, finish, loadCatalogue,
    setGroundVersion: fn => { groundVersion = fn; },
    putDown: () => { if (design.tool) choose(design.tool); },
    drawing: () => !!design.tool,
    // The design in memory, in national-grid metres (export and import come later).
    snapshot: () => JSON.parse(JSON.stringify({ tool: design.tool, trenches: design.trenches, cables: design.cables,
      draft: route.state.points.map(([x, y]) => toBng(origin(), x, y)), readout: design.last?.rows || null }))
  };
}
