// GridAtlas's public REPD routing index supplies points, not surveyed boundaries.
export const GRIDATLAS_SOURCE = Object.freeze({
  url: 'https://ventusltd.github.io/data-gridatlas/202608291410-repd-routing/projects.json',
  atlas: 'https://ventusltd.github.io/gridatlas/atlas/',
  schema: 'pipelinenews.v8.fast-project-index.v1',
  label: 'GridAtlas public REPD routing snapshot',
  geometry: 'Published project point; generated array geometry is illustrative.'
});

const coordinate = (latitude, longitude) => Number.isFinite(latitude) && Number.isFinite(longitude)
  && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
// Match the Atlas receiver's rejection of empty coordinates and the BNG false origin.
const publishedCoordinate = (latitude, longitude) => coordinate(latitude, longitude)
  && !(Math.abs(latitude) < 1e-12 && Math.abs(longitude) < 1e-12)
  && !(Math.abs(latitude - 49.766807) < 1e-9 && Math.abs(longitude + 7.55716) < 1e-9);

export function decodeGridAtlasProjects(data) {
  if (data?.schema !== GRIDATLAS_SOURCE.schema || !Array.isArray(data.fields)
      || !Array.isArray(data.rows) || data.rows.length > 100000) throw Error('Unsupported GridAtlas project index');
  const required = ['repd_ref', 'name', 'technology', 'status', 'capacity_mw', 'geometry_status', 'latitude', 'longitude'];
  if (required.some(field => !data.fields.includes(field)) || new Set(data.fields).size !== data.fields.length)
    throw Error('Incomplete or ambiguous GridAtlas field schema');
  const columns = Object.fromEntries(required.map(field => [field, data.fields.indexOf(field)]));
  const projects = [];
  for (const row of data.rows) {
    if (!Array.isArray(row)) continue;
    const project = {};
    for (const field of required) {
      const value = row[columns[field]], dictionary = data.dictionaries?.[field];
      project[field] = Array.isArray(dictionary) ? (Number.isInteger(value) && value >= 0 ? dictionary[value] : undefined) : value;
    }
    if (project.geometry_status !== 'valid' || !publishedCoordinate(project.latitude, project.longitude)) continue;
    if (typeof project.name !== 'string' || typeof project.technology !== 'string'
        || typeof project.status !== 'string' || !/^\d+$/.test(String(project.repd_ref))) continue;
    project.repd_ref = String(project.repd_ref);
    projects.push(project);
  }
  return { projects, generation: String(data.generation ?? ''), source: GRIDATLAS_SOURCE };
}

export async function loadGridAtlasProjects({ signal } = {}) {
  const response = await fetch(GRIDATLAS_SOURCE.url, { signal });
  if (!response.ok) throw Error(`GridAtlas data request failed (${response.status})`);
  return decodeGridAtlasProjects(await response.json());
}

export function searchProjects(projects, query = '', { limit = 30, technology = 'solar' } = {}) {
  const term = String(query).trim().toLocaleLowerCase();
  const count = Math.max(0, Math.min(100, Math.floor(limit) || 0));
  return projects.filter(project => (!technology || project.technology === technology)
    && (!term || project.name.toLocaleLowerCase().includes(term) || project.repd_ref === term))
    .slice(0, count);
}

// Local WGS84 tangent-plane approximation: [east metres, north metres].
// Intended for neighbourhood drawings; it does not calculate cable routes.
export function projectToLocalMetres(point, origin) {
  if (!coordinate(point?.latitude, point?.longitude) || !coordinate(origin?.latitude, origin?.longitude))
    throw Error('Invalid geographic point');
  const radians = Math.PI / 180, latitude = origin.latitude * radians;
  const a = 6378137, eccentricitySquared = 6.69437999014e-3;
  const denominator = 1 - eccentricitySquared * Math.sin(latitude) ** 2;
  const northRadius = a * (1 - eccentricitySquared) / denominator ** 1.5;
  const eastRadius = a / Math.sqrt(denominator);
  const deltaLongitude = ((point.longitude - origin.longitude + 540) % 360) - 180;
  return [deltaLongitude * radians * eastRadius * Math.cos(latitude),
    (point.latitude - origin.latitude) * radians * northRadius];
}

export function gridAtlasProjectUrl(project) {
  if (!coordinate(project?.latitude, project?.longitude)) throw Error('Invalid geographic point');
  const url = new URL(GRIDATLAS_SOURCE.atlas);
  url.search = new URLSearchParams({ repd_ref: project.repd_ref, technology: project.technology,
    lat: String(project.latitude), lon: String(project.longitude) }).toString();
  return url.href;
}
