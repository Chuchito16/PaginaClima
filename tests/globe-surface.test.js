import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createSurface, createSurfaceMesh, updateSurface, fillSurfaceTargets, temperatureLinear,
  INNER_GLOBE_RADIUS, SURFACE_MIN_RADIUS, SURFACE_MAX_RADIUS, VERTICES_PER_CELL, TRIANGLES_PER_CELL,
} from '../src/globe-surface.js';

const meta = JSON.parse(fs.readFileSync(new URL('../public/data/grid-meta.json', import.meta.url)));
const binary = fs.readFileSync(new URL('../public/data/grid-monthly.bin', import.meta.url));
const measurements = new Int16Array(binary.buffer, binary.byteOffset, binary.byteLength / 2);
const size = meta.rows * meta.cols;
function frame(year, month) {
  const index = meta.frames.findIndex(row => row.year === year && row.month === month);
  assert.ok(index >= 0, `Real NASA frame ${year}-${month} is bundled`);
  return measurements.subarray(index * size, (index + 1) * size);
}
function cell(latitude, longitude) {
  const row = meta.latitudes.indexOf(latitude), col = meta.longitudes.indexOf(longitude);
  assert.ok(row >= 0 && col >= 0);
  return row * meta.cols + col;
}
function targets(surface) {
  const vertices = surface.cells * VERTICES_PER_CELL;
  const result = { radii: new Float32Array(vertices), colors: new Float32Array(vertices * 3), normals: new Float32Array(vertices * 3) };
  fillSurfaceTargets(surface, result);
  return result;
}
function close(a, b, epsilon = 1e-6) { assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`); }

test('real NASA native centers retain their exact palette, including the January 1933 Arctic extreme', () => {
  const source = frame(1933, 1), surface = updateSurface(createSurface(meta), source, { ...meta, relief: 2 });
  const result = targets(surface), index = cell(81, -151), value = source[index] * meta.scale;
  assert.ok(value > 10, 'This regression uses the actual observed +13.14 °C Arctic cell');
  const expected = temperatureLinear(value), center = (index * VERTICES_PER_CELL + 4) * 3;
  for (let c = 0; c < 3; c += 1) close(result.colors[center + c], expected[c], 1e-7);
  assert.equal(surface.valid[index], 1);
  // The previous implementation replaced this center by a neighboring corner
  // average near +0.41 °C; smoothing the artistic height must not do that.
  assert.ok(Math.abs(surface.cornerValues[surface.cornerIndices[index * 4]] - value) > 5);
});

test('all 900 Antarctic observations in September 2026 remain visible thermal cells', () => {
  const source = frame(2026, 9), snapshot = source.slice();
  const surface = updateSurface(createSurface(meta), source, { ...meta, relief: 2 }), result = targets(surface);
  let checked = 0;
  for (let row = 0; row < meta.rows; row += 1) if (meta.latitudes[row] < -80) for (let col = 0; col < meta.cols; col += 1) {
    const i = row * meta.cols + col, center = (i * VERTICES_PER_CELL + 4) * 3;
    assert.notEqual(source[i], meta.missing); assert.equal(surface.valid[i], 1);
    const expected = temperatureLinear(source[i] * meta.scale);
    for (let c = 0; c < 3; c += 1) close(result.colors[center + c], expected[c], 1e-7);
    checked += 1;
  }
  assert.equal(checked, 900);
  assert.deepEqual(source, snapshot, 'Rendering must not modify measured data');
});

test('real zero anomalies stay valid and only actual missing cells are neutral gray', () => {
  const source = frame(2026, 9), surface = updateSurface(createSurface(meta), source, meta), result = targets(surface);
  const zero = source.findIndex(v => v === 0), absent = source.findIndex(v => v === meta.missing);
  assert.ok(zero >= 0 && absent >= 0); assert.equal(surface.valid[zero], 1); assert.equal(surface.cellValues[zero], 0);
  const expected = temperatureLinear(0), neutral = temperatureLinear(NaN), center = (zero * VERTICES_PER_CELL + 4) * 3;
  for (let c = 0; c < 3; c += 1) close(result.colors[center + c], expected[c], 1e-7);
  for (let k = 0; k < VERTICES_PER_CELL; k += 1) for (let c = 0; c < 3; c += 1) close(result.colors[(absent * VERTICES_PER_CELL + k) * 3 + c], neutral[c], 1e-7);
  for (let i = 0; i < size; i += 1) assert.equal(surface.valid[i], source[i] === meta.missing ? 0 : 1);
});

test('1926 genuinely missing Antarctic cells retain the mask while every geometric attribute stays finite', () => {
  const source = frame(1926, 1), surface = updateSurface(createSurface(meta), source, { ...meta, relief: 2 }), result = targets(surface);
  let missing = 0;
  for (let row = 0; row < meta.rows; row += 1) if (meta.latitudes[row] < -80) for (let col = 0; col < meta.cols; col += 1) {
    const i = row * meta.cols + col; assert.equal(source[i], meta.missing); assert.equal(surface.valid[i], 0); missing += 1;
  }
  assert.equal(missing, 900);
  for (const values of [result.radii, result.colors, result.normals]) assert.ok(values.every(Number.isFinite));
});

test('native fan topology is closed at shared cell edges, the longitude seam and both poles', () => {
  const surface = updateSurface(createSurface(meta), frame(2026, 9), { ...meta, relief: 2 });
  const mesh = createSurfaceMesh(surface), result = targets(surface);
  assert.equal(mesh.indices.length, size * TRIANGLES_PER_CELL * 3);
  function position(vertex, axis) { return mesh.units[vertex * 3 + axis] * result.radii[vertex]; }
  for (let row = 0; row < meta.rows; row += 1) for (let col = 0; col < meta.cols; col += 1) {
    const a = (row * meta.cols + col) * VERTICES_PER_CELL;
    const b = (row * meta.cols + (col + 1) % meta.cols) * VERTICES_PER_CELL;
    for (let axis = 0; axis < 3; axis += 1) { close(position(a + 1, axis), position(b, axis)); close(position(a + 2, axis), position(b + 3, axis)); }
    if (row + 1 < meta.rows) {
      const north = ((row + 1) * meta.cols + col) * VERTICES_PER_CELL;
      for (let axis = 0; axis < 3; axis += 1) { close(position(a + 3, axis), position(north, axis)); close(position(a + 2, axis), position(north + 1, axis)); }
    }
  }
  for (const row of [0, meta.rows]) {
    const first = row * (meta.cols + 1);
    for (let col = 0; col <= meta.cols; col += 1) close(surface.cornerRadii[first + col], surface.cornerRadii[first], 1e-7);
  }
});

test('every native triangle is provably above the inner sphere for any measured frame and relief from 0 to 2', () => {
  const surface = createSurface(meta), mesh = createSurfaceMesh(surface);
  let minimumDot = 1;
  // For any convex point in a triangle, its projection on the cell-center
  // direction is at least minimumRadius × minimumDot. This bound covers all
  // 1209 monthly frames, all intermediate transitions and every triangle point.
  for (let i = 0; i < mesh.indices.length; i += 1) {
    const vertex = mesh.indices[i], cellIndex = Math.floor(vertex / VERTICES_PER_CELL), j = cellIndex * 3;
    const length = Math.hypot(...surface.centerUnits.subarray(j, j + 3));
    let dot = 0; for (let c = 0; c < 3; c += 1) dot += mesh.units[vertex * 3 + c] * surface.centerUnits[j + c] / length;
    minimumDot = Math.min(minimumDot, dot);
  }
  assert.ok(SURFACE_MIN_RADIUS * minimumDot > INNER_GLOBE_RADIUS + 0.02);
  for (const date of [[1926, 1], [1933, 1], [1980, 1], [2026, 9]]) for (const relief of [0, 1, 2]) {
    updateSurface(surface, frame(...date), { ...meta, relief });
    for (const radius of [...surface.centerRadii, ...surface.cornerRadii]) {
      assert.ok(Number.isFinite(radius) && radius >= SURFACE_MIN_RADIUS - 1e-6 && radius <= SURFACE_MAX_RADIUS + 1e-6);
      assert.ok(radius * minimumDot > INNER_GLOBE_RADIUS);
    }
  }
});

test('spatial height filtering reduces steep native transitions without changing any temperature color', () => {
  const source = frame(1933, 1), surface = updateSurface(createSurface(meta), source, { ...meta, relief: 2 }), result = targets(surface);
  let maximumStep = 0;
  for (let row = 0; row < meta.rows; row += 1) for (let col = 0; col < meta.cols; col += 1) {
    const i = row * meta.cols + col;
    maximumStep = Math.max(maximumStep, Math.abs(surface.centerRadii[i] - surface.centerRadii[row * meta.cols + (col + 1) % meta.cols]));
    if (row + 1 < meta.rows) maximumStep = Math.max(maximumStep, Math.abs(surface.centerRadii[i] - surface.centerRadii[i + meta.cols]));
    if (source[i] !== meta.missing) {
      const expected = temperatureLinear(source[i] * meta.scale), center = (i * VERTICES_PER_CELL + 4) * 3;
      for (let c = 0; c < 3; c += 1) close(result.colors[center + c], expected[c], 1e-7);
    }
  }
  assert.ok(maximumStep < 0.02, `Adjacent height jump is ${maximumStep}, less than 2% at maximum relief`);
});
