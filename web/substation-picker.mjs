import { loadGridAtlasSubstations, GRIDATLAS_SUBSTATION_SOURCE } from './gridatlas.mjs';

const mount = document.getElementById('substation-picker');
if (mount) {
  const make = (tag, text) => { const node = document.createElement(tag); node.textContent = text; return node; };
  const title = make('h2', 'Public substations');
  const load = make('button', 'Load substation points'); load.type = 'button';
  const label = make('label', 'Snapshot ID');
  const query = make('input', ''); query.type = 'search'; query.placeholder = '0–5799'; query.disabled = true; label.append(query);
  const listLabel = make('label', 'Substation');
  const select = make('select', ''); select.disabled = true; listLabel.append(select);
  const apply = make('button', 'Anchor illustrative layout'); apply.type = 'button'; apply.disabled = true;
  const status = make('p', 'Published points only; the layout and cables remain illustrative.');
  status.className = 'muted'; status.setAttribute('role', 'status');
  const provenance = make('a', 'GridAtlas substation snapshot');
  provenance.href = GRIDATLAS_SUBSTATION_SOURCE.url; provenance.target = '_blank'; provenance.rel = 'noopener noreferrer'; provenance.style.color = '#a5cfff';
  mount.append(title, load, label, listLabel, apply, status, provenance);
  let substations = [], matches = [];
  function refresh() {
    const term = query.value.trim().replace(/^substation-/i, '');
    matches = substations.filter(point => !term || String(point.source_index).includes(term)).slice(0, 40);
    select.replaceChildren(...matches.map(point => { const option = make('option', `Substation ${point.source_index}`); option.value = point.id; return option; }));
    select.disabled = apply.disabled = matches.length === 0;
    status.textContent = `${substations.length} public points loaded; ${matches.length} matches shown (maximum 40). IDs identify rows in this snapshot.`;
  }
  query.addEventListener('input', refresh);
  load.addEventListener('click', async () => {
    load.disabled = true; status.textContent = 'Loading and verifying public substation snapshot…';
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const data = await loadGridAtlasSubstations({ signal: controller.signal });
      substations = data.substations; query.disabled = false; load.textContent = 'Substation snapshot loaded'; refresh();
    } catch (error) { status.textContent = `Could not load substations: ${error.name === 'AbortError' ? 'request timed out' : error.message}. Retry loading.`; load.disabled = false; }
    finally { clearTimeout(timeout); }
  });
  apply.addEventListener('click', () => {
    const point = matches.find(item => item.id === select.value), scene = window.electricalExplorer;
    if (!point) return;
    if (!scene?.state?.gpu || typeof scene.setOrigin !== 'function') { status.textContent = 'The GPU scene is unavailable.'; return; }
    try {
      scene.setOrigin({ latitude: point.latitude, longitude: point.longitude, label: `Substation ${point.source_index}` });
      status.textContent = `Anchored substation ${point.source_index}. Published voltage(s), volts: ${point.voltage ?? 'unavailable'}. Snapshot ${GRIDATLAS_SUBSTATION_SOURCE.generation}; SHA-256 ${point.snapshot_sha256.slice(0, 12)}…. Layout and cable routes remain illustrative.`;
    } catch (error) { status.textContent = `Could not anchor substation: ${error.message}`; }
  });
}
