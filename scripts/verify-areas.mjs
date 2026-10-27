import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const root = new URL('../public/', import.meta.url);
const masks = JSON.parse(await readFile(new URL('data/areas.json', root), 'utf8'));
const shapes = JSON.parse(await readFile(new URL('assets/countries-50m.json', root), 'utf8'));
const countries = masks.areas.filter(area => area.type === 'country');
const regions = masks.areas.filter(area => area.type === 'region');
const byId = new Map(masks.areas.map(area => [area.id, area]));
const geometryById = new Map(shapes.features.map(feature => [feature.id, feature]));
const radius = masks.earthRadiusKm;
const radians = Math.PI / 180;
const cellArea = index => {
  const lat = -89 + Math.floor(index / 180) * 2;
  return 2 * radians * (Math.sin((lat + 1) * radians) - Math.sin((lat - 1) * radians)) * radius ** 2;
};
assert.equal(masks.gridRows, 90);
assert.equal(masks.gridCols, 180);
assert.equal(masks.gridResolutionDegrees, 2);
assert.equal(masks.weightUnits, 'km²');
assert.equal(byId.size, masks.areas.length, 'Area IDs must be unique');
assert.ok(countries.length >= 240, 'Country list must include small countries and territories');
assert.equal(regions.length, 7, 'Seven terrestrial continents are available');
assert.equal(shapes.features.length, masks.areas.length, 'Every selection must have a real outline');
let totalLandArea = 0;
for (const area of masks.areas) {
  assert.ok(area.name && area.name.length > 1);
  assert.ok(area.cells.length > 0, `${area.id} must retain partial-cell observations`);
  assert.equal(area.cells.length, area.weights.length);
  assert.equal(new Set(area.cells).size, area.cells.length, 'No cell may be counted twice within a mask');
  let total = 0;
  for (let i = 0; i < area.cells.length; i++) {
    const index = area.cells[i], weight = area.weights[i];
    assert.ok(Number.isInteger(index) && index >= 0 && index < 16200);
    assert.ok(weight > 0 && Number.isFinite(weight));
    assert.ok(weight <= cellArea(index) * (1 + 1e-8), 'Partial overlap cannot exceed the entire spherical cell');
    total += weight;
  }
  assert.ok(Math.abs(total - area.areaKm2) < 0.001, 'Country weights conserve the intersected area');
  assert.ok(geometryById.has(area.id));
  assert.ok(['Polygon', 'MultiPolygon'].includes(geometryById.get(area.id).geometry.type));
  if (area.type === 'country') totalLandArea += total;
}
assert.ok(totalLandArea > 100_000_000 && totalLandArea < 180_000_000, 'Land area must be in km², not degree squares');
for (const id of ['VAT', 'MCO', 'SGP', 'COL', 'FJI', 'RUS']) assert.ok(byId.has(id));
for (const id of ['VAT', 'MCO']) {
  const area = byId.get(id);
  assert.ok(area.weights.reduce((sum, w) => sum + w, 0) < cellArea(area.cells[0]) * 0.01,
    'Microstates must use their polygon fraction, not an entire surrounding NASA cell');
}
for (const id of ['FJI', 'RUS']) {
  const columns = byId.get(id).cells.map(index => index % 180);
  assert.ok(columns.some(c => c <= 1) && columns.some(c => c >= 178),
    'Antimeridian countries must retain observations on both sides of ±180°');
}
const colombia = byId.get('COL');
assert.equal(colombia.name, 'Colombia');
const colombiaInterior = Math.floor((5 + 90) / 2) * 180 + Math.floor((-75 + 180) / 2);
const interiorIndex = colombia.cells.indexOf(colombiaInterior);
assert.ok(interiorIndex >= 0, 'Native row/column indexing must locate central Colombia');
assert.ok(colombia.weights[interiorIndex] / cellArea(colombiaInterior) > 0.99, 'Interior cells keep their full area');
console.log(`Verified ${countries.length} countries/territories and ${regions.length} continents; partial-cell area conservation, tiny states, antimeridian and native-grid indexing.`);
