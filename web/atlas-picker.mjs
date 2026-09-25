import { loadGridAtlasProjects, searchProjects, gridAtlasProjectUrl, GRIDATLAS_SOURCE } from './gridatlas.mjs';

const mount = document.getElementById('atlas-picker');
if (mount) {
  const element = (tag, text, attributes = {}) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const title = element('h2', 'Anchor at a public solar project');
  const note = element('p', 'A published project point anchors this illustrative layout. It does not reconstruct the site or its cable routes.', { class: 'muted' });
  const load = element('button', 'Load GridAtlas projects', { type: 'button' });
  const label = element('label', 'Name or REPD ID');
  const query = element('input', '', { type: 'search', placeholder: 'Search solar', 'aria-label': 'Search public solar projects', disabled: '' });
  label.append(query);
  const resultsLabel = element('label', 'Project');
  const results = element('select', '', { 'aria-label': 'Public solar project matches', disabled: '' });
  resultsLabel.append(results);
  const apply = element('button', 'Anchor illustrative layout', { type: 'button', disabled: '' });
  const status = element('p', 'Public snapshot loads on request.', { role: 'status', 'aria-live': 'polite', class: 'muted' });
  const details = element('p', '', { class: 'muted' });
  const source = element('a', 'GridAtlas source snapshot', { href: GRIDATLAS_SOURCE.url, target: '_blank', rel: 'noopener noreferrer' });
  source.style.color = '#a5cfff';
  const atlas = element('a', 'Open selected project in GridAtlas', { target: '_blank', rel: 'noopener noreferrer', hidden: '' });
  atlas.style.color = '#a5cfff';
  mount.append(title, note, load, label, resultsLabel, apply, status, details, source, element('br'), atlas);
  let projects = [], matches = [], generation = '';
  function refresh() {
    matches = searchProjects(projects, query.value, { limit: 40 });
    results.replaceChildren();
    for (const project of matches) results.append(element('option', `${project.name} · ${project.repd_ref}`, { value: project.repd_ref }));
    results.disabled = apply.disabled = matches.length === 0;
    status.textContent = matches.length ? `${matches.length} matches shown (maximum 40). Select a project to anchor.` : 'No matching solar projects with valid coordinates.';
  }
  query.addEventListener('input', refresh);
  load.addEventListener('click', async () => {
    load.disabled = true;
    status.textContent = 'Loading public GridAtlas snapshot…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const data = await loadGridAtlasProjects({ signal: controller.signal });
      projects = data.projects; generation = data.generation;
      query.disabled = false;
      refresh();
      load.textContent = 'Public snapshot loaded';
    } catch (error) {
      status.textContent = `Public data unavailable: ${error.name === 'AbortError' ? 'request timed out' : error.message}. Retry loading.`;
      load.disabled = false;
    } finally { clearTimeout(timeout); }
  });
  apply.addEventListener('click', () => {
    const project = matches.find(item => item.repd_ref === results.value);
    if (!project) return;
    if (typeof window.electricalExplorer?.setOrigin !== 'function' || !window.electricalExplorer.state?.gpu) {
      status.textContent = 'The GPU scene is unavailable.'; return;
    }
    try { window.electricalExplorer.setOrigin({ ...project, label: project.name }); }
    catch (error) { status.textContent = `Could not anchor the scene: ${error.message}`; return; }
    details.textContent = `Anchored project: ${project.name} · REPD ${project.repd_ref} · ${project.status} · ${Number.isFinite(project.capacity_mw) && project.capacity_mw >= 0 ? `${project.capacity_mw} MW published capacity` : 'capacity unavailable'} · snapshot ${generation}. Published point: ${project.latitude.toFixed(6)}, ${project.longitude.toFixed(6)}.`;
    atlas.href = gridAtlasProjectUrl(project); atlas.hidden = false;
    status.textContent = 'Published point selected. Array dimensions and routes remain illustrative.';
  });
}
