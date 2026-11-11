import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const dataDirectory = new URL('../public/data/', import.meta.url);
const json = async (file) => JSON.parse(await readFile(new URL(file, dataDirectory), 'utf8'));
const [global, grid, provenance, binary, csv, gzipBinary] = await Promise.all([
  json('global-monthly.json'), json('grid-meta.json'), json('provenance.json'),
  readFile(new URL('grid-monthly.bin', dataDirectory)),
  readFile(new URL('GLB.Ts+dSST.csv', dataDirectory)),
  readFile(new URL('grid-monthly.bin.gz', dataDirectory)),
]);

const baselineMonths = global.months.filter(({ year }) => year >= 1880 && year <= 1900);
assert.equal(baselineMonths.length, 252, 'The reference must contain 252 months');
const baseline = baselineMonths.reduce((sum, item) => sum + item.anomaly, 0) / baselineMonths.length;
assert.ok(Math.abs(baseline - global.baseline1880To1900) < 1e-12, 'Baseline must be calculated from the source series');
for (let i = 1; i < global.months.length; i++) {
  const previous = global.months[i - 1];
  const current = global.months[i];
  assert.equal(current.year * 12 + current.month, previous.year * 12 + previous.month + 1, 'Monthly series must be continuous');
  assert.ok(Number.isFinite(current.anomaly), 'Every monthly anomaly must be a finite number');
}
const visible = global.months.filter(({ year }) => year >= 1926);
assert.equal(visible.length, grid.months, 'Spatial/global coverage must match');
assert.equal(grid.frames.length, grid.months);
visible.forEach((item, i) => {
  assert.equal(item.year, grid.frames[i].year);
  assert.equal(item.month, grid.frames[i].month);
});
assert.equal(binary.length, grid.months * grid.rows * grid.cols * 2, 'No partial or truncated binary frames');
assert.equal(grid.bytes, binary.length);
const decompressed = gunzipSync(gzipBinary);
assert.equal(decompressed.length, binary.length, 'Gzip transport must contain every native grid frame');
assert.equal(createHash('sha256').update(decompressed).digest('hex'), createHash('sha256').update(binary).digest('hex'), 'Gzip transport must preserve the raw dataset byte for byte');
assert.equal(gzipBinary.readUInt32LE(4), 0, 'Gzip timestamp must be zero for reproducible output');
assert.equal(grid.latitudes.length, grid.rows);
assert.equal(grid.longitudes.length, grid.cols);
assert.equal(grid.rows, 90);
assert.equal(grid.cols, 180);
assert.equal(grid.stepLat, 2);
assert.equal(grid.stepLon, 2);
assert.equal(grid.latitudes[0], -89);
assert.equal(grid.latitudes.at(-1), 89);
assert.equal(grid.longitudes[0], -179);
assert.equal(grid.longitudes.at(-1), 179);
assert.equal(grid.format, 'int16-le');
assert.equal(grid.scale, 0.01);
assert.equal(grid.missing, -32768);
const cells = grid.rows * grid.cols;
let missing = 0;
let minimum = Infinity;
let maximum = -Infinity;
for (let frame = 0; frame < grid.months; frame++) {
  let valid = 0;
  for (let i = 0; i < cells; i++) {
    const value = binary.readInt16LE((frame * cells + i) * 2);
    if (value === grid.missing) missing++;
    else {
      valid++;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  assert.ok(valid > 0, 'Each map must contain genuine observations');
  assert.ok(Math.abs(valid / cells - grid.coverage[frame]) < 0.000051, 'Missing-cell coverage must agree with metadata');
}
assert.ok(missing > 0, 'Historical missing observations must remain missing');
assert.equal(createHash('sha256').update(csv).digest('hex'), provenance.sourceChecksums['GLB.Ts+dSST.csv']);
console.log(`Verified ${global.months.length} global months; ${grid.months} spatial frames; baseline ${baseline.toFixed(6)} °C; ${missing} missing cells preserved; regional range ${minimum * grid.scale} to ${maximum * grid.scale} °C; gzip transport ${gzipBinary.length} bytes matches the raw dataset.`);
await import('./verify-areas.mjs');
