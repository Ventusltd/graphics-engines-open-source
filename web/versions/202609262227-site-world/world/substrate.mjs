// The substrate: an empty world you can move around in. It owns the loop, the camera and the views;
// everything you see comes from layers listed in manifest.json, plus the design being drawn (trenches and cables).
// Positions are local metres from the site origin, which is held in float64 British National Grid metres
// (0, 0 until a site is chosen). setOrigin moves the origin and shifts the viewer so they stay put in the world;
// walking more than 600 m from the origin moves it to the nearest whole kilometre (origin.mjs).
// The design is kept in memory in national-grid metres, so it survives every move of the origin.

import { gridAtlasUrl } from './links.mjs';
import { perspective, view, multiply } from './camera.mjs';
import { VIEWS, fpsOf, step, look, setView, toggle, blocked, AERIAL_MIN_CLEARANCE } from './views.mjs';
import { createFrameGate } from './frame-gate.mjs';
import { initialBudget, adjust } from './device-budget.mjs';
import { createLines } from './lines.mjs';
import { attachInput } from './input.mjs';
import { loadLayers } from './layers.mjs';
import { rebaseIfNeeded, toBng, toLocal } from './origin.mjs';
import { arrive } from './arrival.mjs';
import { gridRef, wgs84ToBng } from './bng.mjs';
import { createDesign } from './design-ui.mjs';
import { createSearchPanel, NO_TERRAIN } from './search-ui.mjs';
import { distanceLabel } from './labels.mjs';
import { footerText, aboutList } from './attribution.mjs';

const $ = id => document.getElementById(id);
const canvas = $('view'), where = $('where'), status = $('status');
const FADE_M = 450, FOV = 70 * Math.PI / 180, MAX_DT = 0.1, ARRIVAL_FPS = 30, ARRIVAL = { height: 80, seconds: 3 };
const JUMP_M = 3000;      // further than this, Find moves the origin and drops in from above instead of flying across
const SITE_HALF_M = 1024; // half the staged site's side: terrain tiles exist within this of its centre
// Arriving at a found place: an oblique look at it, about 35 degrees down from 150 m out, not straight down on it.
const OBLIQUE = { pitch: -35 * Math.PI / 180, back: 150 };
const SUBSTATION_REACH_M = 5000; // further than this, the grid data here is not the grid near the place

let state = { view: 'standing', pos: [0, -25, 0], yaw: 0, pitch: -0.12 };
let budget = initialBudget(devicePixelRatio);
let loaded = { generation: '', layers: [] }, vertices = 0;
let origin = { e: 0, n: 0, id: 0 };
let groundVersion = 0; // bumped whenever a layer says new ground has arrived, or the origin moves
let lastGround = 0;    // the last ground height found near the viewer; used where no layer knows the height
let arrival = null;    // { pose, t0 } while the drone flies itself somewhere
let place = null;      // the place last found: { label, e, n } in national-grid metres; a pin marks it
const GROUND_MEMORY_M = 20;

const live = () => loaded.layers.filter(l => l.layer);
// A layer that throws is switched off and named; it never takes the rest of the world down with it.
const guarded = (l, fn, fallback) => {
  try { return fn(); } catch (e) { l.layer = null; l.status = 'failed and switched off: ' + e.message; return fallback; }
};
// The ground the layers know, before any design cuts it.
const baseHeight = (x, y) => {
  for (const l of live()) {
    if (typeof l.layer.heightAt !== 'function') continue;
    const h = guarded(l, () => l.layer.heightAt(x, y), NaN);
    if (Number.isFinite(h)) {
      if (Math.hypot(x - state.pos[0], y - state.pos[1]) <= GROUND_MEMORY_M) lastGround = h;
      return h;
    }
  }
  return lastGround; // the empty world is flat at 0 m; past the edge of known ground, keep the last height
};
// Ground actually measured by a layer at (x, y), or NaN: engineering checks use this, never a guess.
const measuredAt = (x, y) => {
  for (const l of live()) {
    if (typeof l.layer.heightAt !== 'function') continue;
    const h = guarded(l, () => l.layer.heightAt(x, y), NaN);
    if (Number.isFinite(h)) return h;
  }
  return NaN;
};
// The ground everyone stands on: the layers' ground with every finished trench cut into it (design-ui.mjs).
const heightAt = (x, y) => design.heightAt(x, y);
// Solids are what a person or drone cannot pass through; layers declare them as boxes in local metres.
const solids = () => live().flatMap(l => (typeof l.layer.solids === 'function' ? guarded(l, () => l.layer.solids({ pos: state.pos }), []) : []));

const lines = createLines(canvas, { onRestore: () => gate.invalidate() });
const gate = createFrameGate(draw);
// A layer asks for a redraw; { ground: true } (the default) also says new ground has arrived.
const invalidate = ({ ground = true } = {}) => { if (ground) groundVersion++; gate.invalidate(); };

// Grid equipment the design measures its routes against: substations and towers from the grid layer, if loaded.
function gridAssets() {
  const model = live().find(l => l.id === 'grid')?.layer?.debug?.()?.model;
  if (!model) return [];
  const subs = (model.substations || []).map(s => ({ kind: 'substation', label: `${s.cls} substation`, e: s.e, n: s.n }));
  const towers = (model.lines || []).flatMap(l => l.towers.map(t => ({ kind: 'tower', label: `${l.cls} pylon`, e: t.e, n: t.n })));
  return [...subs, ...towers];
}
const design = createDesign({ doc: document, canvas, fov: FOV, baseHeight, measured: measuredAt, origin: () => origin, viewer: () => state,
  invalidate, redraw: () => gate.invalidate(), assets: gridAssets });
design.setGroundVersion(() => groundVersion);

// ---- moving -----------------------------------------------------------------------------------------
// Moves the site origin to (e, n) national-grid metres. The viewer and the route being drawn are shifted by the
// same amount the other way, so they stay in the same place in the world; layers read it via api.origin().
function setOrigin(e, n) {
  if (!Number.isFinite(e) || !Number.isFinite(n)) throw Error('setOrigin needs finite easting and northing');
  const dx = e - origin.e, dy = n - origin.n;
  state = { ...state, pos: [state.pos[0] - dx, state.pos[1] - dy, state.pos[2]] };
  origin = { e, n, id: origin.id + 1 };
  design.shift(dx, dy);
  invalidate();
  return { ...origin };
}

const target = () => (arrival ? ARRIVAL_FPS : fpsOf(VIEWS[state.view], input.get().slow));
const moving = () => input.active() || !!arrival;
const input = attachInput(canvas, $('pad'), {
  onChange: () => { if (input.active()) arrival = null; gate.setMoving(moving(), target()); gate.invalidate(); },
  onLook: (dy, dp) => { arrival = null; state = look(state, dy, dp); gate.invalidate(); },
  onView: v => chooseView(toggle(state.view, v)),
  onClick: (x, y) => design.pickAt(x, y)
});

// Flies the drone smoothly to hover above local [x, y], looking down; any movement key takes over.
function flyTo(x, y, opts = {}) {
  if (state.view !== 'aerial') chooseView('aerial', { arrive: false });
  if (Math.hypot(x - state.pos[0], y - state.pos[1]) > JUMP_M) { // a far place: move the origin there, drop in from above
    const p = toBng(origin, x, y);
    setOrigin(Math.round(p.e / 1000) * 1000, Math.round(p.n / 1000) * 1000);
    [x, y] = toLocal(origin, p.e, p.n);
    state = { ...state, pos: [x, y, heightAt(x, y) + 400] };
  }
  // back: stand off this far behind the point (along the current heading), so a pitch above straight down still sees it.
  const { back = 0, ...rest } = opts, yaw = rest.yaw ?? state.yaw, g = heightAt(x, y);
  const at = [x - back * Math.sin(yaw), y - back * Math.cos(yaw), g];
  const height = back && rest.pitch ? back * Math.tan(-rest.pitch) : (rest.height ?? ARRIVAL.height);
  arrival = { pose: arrive(state, at, { ...ARRIVAL, ...rest, yaw, height }), t0: performance.now() };
  gate.setMoving(true, ARRIVAL_FPS);
}

function draw(now, intervalMs) {
  if (arrival) {
    const t = (now - arrival.t0) / 1000;
    state = { ...state, ...arrival.pose(t) };
    if (arrival.pose.done(t)) { arrival = null; gate.setMoving(moving(), target()); }
  } else if (input.active()) {
    const i = input.get(), dt = Math.min(intervalMs / 1000, MAX_DT);
    if (i.turn) state = look(state, i.turn * dt, 0);
    state = step(state, i, dt, heightAt, solids());
    budget = adjust(budget, intervalMs, 1000 / target());
  }
  const r = arrival ? null : rebaseIfNeeded(origin, state.pos);
  if (r) setOrigin(r.e, r.n);
  // Ground can arrive after the viewer does (tiles stream in): a walker's eye follows it, a drone keeps clear.
  const v = VIEWS[state.view], g = heightAt(state.pos[0], state.pos[1]);
  if (v.eye !== null && Math.abs(state.pos[2] - (g + v.eye)) > 1e-6) state = { ...state, pos: [state.pos[0], state.pos[1], g + v.eye] };
  if (v.eye === null && state.pos[2] < g + AERIAL_MIN_CLEARANCE) state = { ...state, pos: [state.pos[0], state.pos[1], g + AERIAL_MIN_CLEARANCE] };
  lines.resize(budget.scale);
  // The view is built at the eye; lines.draw moves each batch by (its origin - eye) in doubles.
  const mat = multiply(perspective(FOV, canvas.width / canvas.height, 0.05, 5000), view([0, 0, 0], state.yaw, state.pitch));
  const ctx = { pos: state.pos, heightAt, measuredAt, groundVersion, origin: { ...origin } };
  const batches = live().flatMap(l => (typeof l.layer.lines === 'function' ? guarded(l, () => l.layer.lines(ctx), []) : []));
  vertices = lines.draw(mat, state.pos, FADE_M, batches.concat(design.batches(), pin()));
  writeReadout();
}

// The pin at the place last found: a 40 m mast with a diamond on the ground, so it can be seen from the drone.
function pin() {
  if (!place) return [];
  const [x, y] = toLocal(origin, place.e, place.n), z = heightAt(x, y), r = 6, h = 40;
  const v = [0, 0, 0, 0, 0, h, -r, 0, 0, 0, r, 0, 0, r, 0, r, 0, 0, r, 0, 0, 0, -r, 0, 0, -r, 0, -r, 0, 0,
    0, 0, h, -3, 0, h - 6, 0, 0, h, 3, 0, h - 6];
  return [{ key: 'place-pin', version: `${origin.id}:${groundVersion}:${place.e}:${place.n}`, positions: new Float32Array(v),
    color: [1, 0.45, 0.85, 1], origin: [x, y, z] }];
}

function chooseView(v, { arrive: fly = true } = {}) {
  const next = setView(state, v, heightAt);
  if (blocked(next.pos, VIEWS[v].body, solids())) return; // e.g. no standing up under a table
  const from = state.view;
  state = next; arrival = null;
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  $('lift').hidden = v !== 'aerial';
  if (v !== 'aerial') input.setLift(0);
  if (fly && v === 'aerial' && from !== 'aerial') flyTo(state.pos[0], state.pos[1]);
  gate.setMoving(moving(), target());
  gate.invalidate();
}

function writeReadout() {
  const [x, y, z] = state.pos, g = heightAt(x, y), v = VIEWS[state.view], p = toBng(origin, x, y);
  // On screen: a grid reference and the height of the ground above sea level. The exact numbers are under Controls.
  let ref = '';
  try { ref = gridRef(p.e, p.n, 8); } catch { /* off the national grid */ }
  const up = v.eye === null ? ` · ${Math.round(z - g)} m up` : '';
  const known = Number.isFinite(measuredAt(x, y)); // only measured ground is given a height above sea level
  where.textContent = `${ref ? ref + ' · ' : ''}${known ? `ground ${Math.round(g)} m above sea level` : 'ground height not measured here'}${up}`;
  $('where-detail').textContent = `${v.label} · easting ${p.e.toFixed(1)} m, northing ${p.n.toFixed(1)} m · ` +
    `eye ${(z - g).toFixed(2)} m above the ground${known ? ` · ground ${g.toFixed(2)} m above sea level` : ''}`;
  // When still, no frame is drawn, so the rate is 0 whatever the last second's counter still holds.
  status.textContent = `${moving() ? gate.fps() : 0} fps now (moving ${v.fps}, precise ${v.slowFps}, still 0) · ${budget.scale}× resolution · ` +
    `${vertices / 2} lines · ${loaded.layers.map(l => l.id + ': ' + l.status).join('; ') || 'no layers'}`;
}

// ---- page controls ----------------------------------------------------------------------------------
for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => { chooseView(b.dataset.view); canvas.focus(); });
// One panel at a time: Find, Design and Controls share the space under the dash on a phone.
let search = null;
const panels = { 'help-toggle': 'help', 'design-toggle': 'design', 'find-toggle': 'find' };
// GridAtlas opens at the spot you are standing on (latitude, longitude and zoom only; no project reference).
$('to-gridatlas').addEventListener('click', () => {
  const url = gridAtlasUrl({ origin, pos: state.pos });
  if (url) open(url, '_blank', 'noopener');
});
function openPanel(btn, open) {
  if (btn === 'find-toggle') { if (search) (open ? search.open() : search.close()); }
  else $(panels[btn]).hidden = !open;
  $(btn).setAttribute('aria-expanded', String(open));
  if (btn === 'design-toggle' && !open) design.putDown(); // closing Design puts the tool down
  const shown = Object.keys(panels).find(b => $(b).getAttribute('aria-expanded') === 'true');
  if (shown) document.body.dataset.panel = panels[shown]; else delete document.body.dataset.panel;
  if (btn === 'find-toggle' && open) dismissStart();
}
for (const btn of Object.keys(panels)) {
  $(btn).addEventListener('click', () => {
    const open = $(btn).getAttribute('aria-expanded') !== 'true';
    for (const o of Object.keys(panels)) if (o !== btn && $(o).getAttribute('aria-expanded') === 'true') openPanel(o, false);
    openPanel(btn, open);
  });
}
// Up and Down: hold to climb or sink; a quick tap moves 10 m, so a tap is never lost.
const TAP_MS = 250, TAP_M = 10;
for (const b of document.querySelectorAll('[data-lift]')) {
  let down = 0;
  const hold = e => {
    e.preventDefault(); down = performance.now();
    try { b.setPointerCapture(e.pointerId); } catch { /* synthetic or finished pointer */ }
    input.setLift(Number(b.dataset.lift));
  };
  const release = e => {
    if (!down) return;
    const tap = e.type === 'pointerup' && performance.now() - down < TAP_MS;
    down = 0; input.setLift(0);
    if (tap && state.view === 'aerial') {
      const [x, y, z] = state.pos, floor = heightAt(x, y) + AERIAL_MIN_CLEARANCE;
      state = { ...state, pos: [x, y, Math.max(floor, z + Number(b.dataset.lift) * TAP_M)] };
      gate.invalidate();
    }
  };
  b.addEventListener('pointerdown', hold);
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, release);
}

// The first step, offered once: a small card that opens Find. Dismissed for good with × or by using Find.
const START_KEY = 'world.start.dismissed';
const remembered = () => { try { return localStorage.getItem(START_KEY) === '1'; } catch { return false; } };
function dismissStart() {
  $('start').hidden = true;
  try { localStorage.setItem(START_KEY, '1'); } catch { /* private window: it just shows again next time */ }
}
$('start').hidden = remembered();
$('start-close').addEventListener('click', () => { dismissStart(); canvas.focus(); });
$('start-go').addEventListener('click', () => { if ($('find-toggle').getAttribute('aria-expanded') !== 'true') $('find-toggle').click(); });
$('place-close').addEventListener('click', () => { $('place').hidden = true; canvas.focus(); });

// The nearest substation in the grid data to national-grid (e, n), or a plain line saying there is none to hand.
function nearestSubstation(e, n) {
  const all = gridAssets();
  if (!all.length) return 'Grid data not loaded for this area';
  const near = kind => all.filter(a => a.kind === kind).map(a => ({ ...a, d: Math.hypot(a.e - e, a.n - n) })).sort((a, b) => a.d - b.d)[0];
  const s = near('substation'), t = near('tower');
  if (s && s.d <= SUBSTATION_REACH_M) return `Nearest ${s.label}: ${distanceLabel(s.d)}`;
  const none = `No substation within ${SUBSTATION_REACH_M / 1000} km in the grid data loaded`;
  return t ? `${none} · nearest ${t.label} ${distanceLabel(t.d)}` : none;
}
// Names the place just found, pins it, and says what is known there.
function showPlace(label, e, n, terrain) {
  place = { label, e, n };
  $('place-name').textContent = label;
  let ref = '';
  try { ref = gridRef(e, n, 8) + ' · '; } catch { /* off the national grid */ }
  $('place-grid').textContent = ref + nearestSubstation(e, n);
  $('place-terrain').textContent = terrain ? '' : NO_TERRAIN;
  $('place').hidden = false;
  gate.invalidate();
}
addEventListener('resize', () => gate.invalidate());
setInterval(() => { if (!moving()) writeReadout(); }, 1000); // text only: no frame is drawn

// Small print for exactly the layers that are on: one line along the bottom, the full lines under Controls.
let attribution = null;
function writeCredits() {
  if (!attribution) return;
  const ids = live().map(l => l.id), full = footerText(ids, attribution);
  $('credit-full').textContent = full;
  $('credit-short').textContent = full.replace(/ copyright and\/or database right/g, '').replace(/ All rights reserved\./g, '');
  $('credits').replaceChildren(...aboutList(ids, attribution).map(c => {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = c.link || c.licence_url || '#'; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = `${c.line} (${c.licence})`; li.append(a); return li;
  }));
}

// Find: a REPD project, postcode or "lat, lon"; the drone flies there. Near the staged site there is terrain.
function mountFind() {
  const siteNear = (lat, lon) => {
    if (!loaded.site) return false;
    const p = wgs84ToBng(lat, lon);
    return Math.abs(p.e - loaded.site.centre_e) <= SITE_HALF_M && Math.abs(p.n - loaded.site.centre_n) <= SITE_HALF_M;
  };
  const loadIndex = () => fetch('./world/data/projects.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json(); });
  search = createSearchPanel(document.body, {
    loadIndex, attribution, hasTerrain: siteNear,
    onChoose: ({ lat, lon, label }) => {
      const p = wgs84ToBng(lat, lon), [x, y] = toLocal(origin, p.e, p.n);
      openPanel('find-toggle', false);
      flyTo(x, y, OBLIQUE);
      showPlace(label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`, p.e, p.n, siteNear(lat, lon));
      canvas.focus();
    }
  });
  search.element.id = 'find';
  // Escape inside the box closes it; keep the Find button in step.
  search.element.addEventListener('keydown', e => { if (e.key === 'Escape') { $('find-toggle').setAttribute('aria-expanded', 'false'); delete document.body.dataset.panel; } });
}

try {
  loaded = await loadLayers('./world/manifest.json', { invalidate, origin: () => origin });
} catch (e) {
  loaded = { generation: '', layers: [{ id: 'manifest', status: 'failed: ' + e.message }] };
}
await design.loadCatalogue();
try { attribution = await (await fetch('./world/data/attribution.json', { cache: 'no-cache' })).json(); } catch { /* the fixed footer stays */ }
writeCredits();
mountFind();
// A site places the world: its centre becomes the origin, so the viewer starts in the middle of the land.
if (loaded.site) origin = { e: loaded.site.centre_e, n: loaded.site.centre_n, id: origin.id + 1 };
chooseView('standing');

// For tests and the console. Read-only views of the live state, and the origin and arrival hooks.
window.world = Object.freeze({
  origin: () => ({ ...origin }), groundVersion: () => groundVersion, setOrigin, heightAt,
  state: () => state, budget: () => budget, fps: () => gate.fps(), generation: () => loaded.generation,
  layers: () => loaded.layers.map(({ id, status, layer }) => ({ id, status, detail: layer?.status ?? null })), // detail: the layer's own word
  // Flies the drone to national-grid (e, n): the arrival is smooth and capped at 30 fps.
  flyTo: (e, n, opts) => { const [x, y] = toLocal(origin, e, n); flyTo(x, y, opts); },
  place: () => (place ? { ...place } : null), // the place last found and pinned
  design: design.snapshot // the design in memory, in national-grid metres (export and import come later)
});
