import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeGridAtlasProjects, GRIDATLAS_SOURCE, projectToLocalMetres, searchProjects, gridAtlasProjectUrl } from '../web/gridatlas.mjs';

const fields = ['repd_ref', 'name', 'technology', 'status', 'capacity_mw', 'geometry_status', 'latitude', 'longitude'];
const row = ['123', 'Public solar example', 0, 0, 10, 0, 52, -1];
const payload = rows => ({ schema: GRIDATLAS_SOURCE.schema, fields, rows,
  dictionaries: { technology: ['solar'], status: ['Operational'], geometry_status: ['valid'] } });

test('decodes dictionary fields without coercing JSON null coordinates', () => {
  const invalid = [null, '', '52', Infinity, NaN, 91].map(latitude => [...row.slice(0, 6), latitude, -1]);
  const rows = [row, ...invalid, [...row.slice(0, 6), 0, 0], [...row.slice(0, 6), 49.766807, -7.55716]];
  const { projects } = decodeGridAtlasProjects(payload(rows));
  assert.equal(projects.length, 1);
  assert.equal(projects[0].technology, 'solar');
  assert.equal(searchProjects(projects, '123')[0].name, row[1]);
  assert.equal(new URL(gridAtlasProjectUrl(projects[0])).searchParams.get('repd_ref'), '123');
});

test('rejects ambiguous schema, missing identities and invalid dictionary indexes', () => {
  assert.throws(() => decodeGridAtlasProjects({ ...payload([row]), fields: [...fields, 'latitude'] }));
  assert.throws(() => decodeGridAtlasProjects({ ...payload([row]), schema: 'unknown' }));
  const badIdentity = [...row]; badIdentity[0] = null;
  const badTechnology = [...row]; badTechnology[2] = 99;
  assert.equal(decodeGridAtlasProjects(payload([badIdentity, badTechnology])).projects.length, 0);
});

test('local WGS84 axes, dateline wrapping and invalid coordinate rejection', () => {
  const origin = { latitude: 0, longitude: 0 };
  assert.deepEqual(projectToLocalMetres(origin, origin), [0, 0]);
  const east = projectToLocalMetres({ latitude: 0, longitude: 0.001 }, origin);
  const north = projectToLocalMetres({ latitude: 0.001, longitude: 0 }, origin);
  assert.ok(Math.abs(east[0] - 111.319490793) < 0.0001);
  assert.ok(Math.abs(north[1] - 110.574275822) < 0.0001);
  const wrapped = projectToLocalMetres({ latitude: 0, longitude: -179.999 }, { latitude: 0, longitude: 179.999 });
  assert.ok(wrapped[0] > 222 && wrapped[0] < 223);
  assert.throws(() => projectToLocalMetres({ latitude: null, longitude: 0 }, origin));
});
