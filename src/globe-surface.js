import { PALETTE } from './climate.js';

export const INNER_GLOBE_RADIUS = 0.985;
export const SURFACE_MIN_RADIUS = 1.012;
export const SURFACE_MAX_RADIUS = 1.084;
export const MISSING_SURFACE_COLOR = '#aeb8bd';
export const VERTICES_PER_CELL = 5;
export const TRIANGLES_PER_CELL = 4;
const radians = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const weights = [1, 4, 6, 4, 1];
const stops = PALETTE.map(([value, hex]) => [value, ...[1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))]);
const linear = channel => { const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const missingRGB = [1, 3, 5].map(i => linear(Number.parseInt(MISSING_SURFACE_COLOR.slice(i, i + 2), 16)));

/** The same sRGB interpolation as the legend, converted to linear GPU input. */
export function temperatureLinear(value, output = new Float32Array(3), offset = 0) {
  if (!Number.isFinite(value)) { output.set(missingRGB, offset); return output; }
  let high = stops.findIndex(([threshold]) => threshold >= value);
  if (high < 0) high = stops.length - 1;
  const low = high === 0 || value >= stops.at(-1)[0] ? high : high - 1;
  const t = high === low ? 0 : (value - stops[low][0]) / (stops[high][0] - stops[low][0]);
  for (let c = 0; c < 3; c += 1) output[offset + c] = linear(Math.round(stops[low][c + 1] + (stops[high][c + 1] - stops[low][c + 1]) * t));
  return output;
}

function unit(latitude, longitude, output, offset) {
  const lat = latitude * radians, lon = longitude * radians;
  output[offset] = Math.cos(lat) * Math.sin(lon);
  output[offset + 1] = Math.sin(lat);
  output[offset + 2] = Math.cos(lat) * Math.cos(lon);
}
function normal(output, offset, x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  output[offset] = x / length; output[offset + 1] = y / length; output[offset + 2] = z / length;
}

/** Reusable pure buffers: geography is computed once, measured data stay separate
 * from a spatially filtered height field used only for artistic relief. */
export function createSurface(meta) {
  const rows = meta.rows ?? meta.latitudes.length, cols = meta.cols ?? meta.longitudes.length;
  const cells = rows * cols, corners = (rows + 1) * (cols + 1);
  const surface = {
    rows, cols, cells, corners, latitudes: meta.latitudes, stepLat: meta.stepLat ?? 2, stepLon: meta.stepLon ?? 2,
    cellValues: new Float32Array(cells), valid: new Uint8Array(cells), heightValues: new Float32Array(cells),
    cellColors: new Float32Array(cells * 3), cornerValues: new Float32Array(corners), cornerColors: new Float32Array(corners * 3),
    centerUnits: new Float32Array(cells * 3), cornerUnits: new Float32Array(corners * 3),
    centerRadii: new Float32Array(cells), cornerRadii: new Float32Array(corners),
    centerNormals: new Float32Array(cells * 3), cornerNormals: new Float32Array(corners * 3),
    cornerIndices: new Uint32Array(cells * 4),
    numerator: new Float32Array(cells), denominator: new Float32Array(cells), tempNumerator: new Float32Array(cells), tempDenominator: new Float32Array(cells),
  };
  for (let row = 0; row <= rows; row += 1) for (let col = 0; col <= cols; col += 1) unit(
    clamp(meta.latitudes[0] - surface.stepLat / 2 + row * surface.stepLat, -90, 90),
    meta.longitudes[0] - surface.stepLon / 2 + col * surface.stepLon,
    surface.cornerUnits, (row * (cols + 1) + col) * 3,
  );
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    const i = row * cols + col, sw = row * (cols + 1) + col;
    unit(meta.latitudes[row], meta.longitudes[col], surface.centerUnits, i * 3);
    surface.cornerIndices.set([sw, sw + 1, sw + cols + 2, sw + cols + 1], i * 4);
  }
  return surface;
}

export function reliefRadius(value, relief = 1) {
  return SURFACE_MIN_RADIUS + 0.018 * clamp(Number(relief) || 0, 0, 2) * (1 + Math.tanh((Number.isFinite(value) ? value : 0) / 3));
}

/** Four shared edge corners plus an exact native sample at the cell center. */
export function createSurfaceMesh(surface) {
  const units = new Float32Array(surface.cells * VERTICES_PER_CELL * 3);
  const indices = new Uint32Array(surface.cells * TRIANGLES_PER_CELL * 3);
  for (let cell = 0; cell < surface.cells; cell += 1) {
    const base = cell * VERTICES_PER_CELL;
    for (let k = 0; k < 4; k += 1) {
      const corner = surface.cornerIndices[cell * 4 + k];
      units.set(surface.cornerUnits.subarray(corner * 3, corner * 3 + 3), (base + k) * 3);
      indices.set([base + k, base + (k + 1) % 4, base + 4], (cell * TRIANGLES_PER_CELL + k) * 3);
    }
    units.set(surface.centerUnits.subarray(cell * 3, cell * 3 + 3), (base + 4) * 3);
  }
  return { units, indices };
}

/** Target attributes shared by the renderer and numerical regression tests. */
export function fillSurfaceTargets(surface, { radii, colors, normals }) {
  for (let cell = 0; cell < surface.cells; cell += 1) for (let k = 0; k < VERTICES_PER_CELL; k += 1) {
    const center = k === 4, vertex = cell * VERTICES_PER_CELL + k;
    const i = center ? cell : surface.cornerIndices[cell * 4 + k];
    const nativeColor = center || !Number.isFinite(surface.cornerValues[i]);
    const color = nativeColor ? surface.cellColors : surface.cornerColors;
    const colorIndex = nativeColor ? cell : i;
    radii[vertex] = center ? surface.centerRadii[cell] : surface.cornerRadii[i];
    const normal = center ? surface.centerNormals : surface.cornerNormals;
    for (let c = 0; c < 3; c += 1) {
      colors[vertex * 3 + c] = surface.valid[cell] ? color[colorIndex * 3 + c] : missingRGB[c];
      normals[vertex * 3 + c] = normal[i * 3 + c];
    }
  }
}

/** Updates existing buffers without changing values, metadata or validity. */
export function updateSurface(surface, values, { scale = 0.01, missing = -32768, offset = 0, relief = 1 } = {}) {
  const { rows, cols, cells, numerator: num, denominator: den, tempNumerator: tmpNum, tempDenominator: tmpDen } = surface;
  for (let i = 0; i < cells; i += 1) {
    const raw = values[i], valid = raw !== missing && Number.isFinite(raw), value = valid ? raw * scale + offset : NaN;
    surface.valid[i] = valid ? 1 : 0; surface.cellValues[i] = value;
    temperatureLinear(value, surface.cellColors, i * 3);
    num[i] = valid ? value : 0; den[i] = valid ? 1 : 0;
  }
  // Two normalized Gaussian 5×5 passes. Missing observations contribute no
  // weight. Filtering never changes the measured validity/color buffers.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
      let n = 0, d = 0;
      for (let k = -2; k <= 2; k += 1) { const j = row * cols + (col + k + cols) % cols, w = weights[k + 2]; n += num[j] * w; d += den[j] * w; }
      const i = row * cols + col; tmpNum[i] = n / 16; tmpDen[i] = d / 16;
    }
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
      let n = 0, d = 0;
      for (let k = -2; k <= 2; k += 1) { const j = clamp(row + k, 0, rows - 1) * cols + col, w = weights[k + 2]; n += tmpNum[j] * w; d += tmpDen[j] * w; }
      const i = row * cols + col; num[i] = n / 16; den[i] = d / 16;
    }
  }
  for (let i = 0; i < cells; i += 1) {
    surface.heightValues[i] = den[i] > 0 ? num[i] / den[i] : 0;
    surface.centerRadii[i] = reliefRadius(surface.heightValues[i], relief);
  }
  // Smooth the bounded geometry as well: normalization at sparse-data edges
  // must not create a steep wall. This changes geometry, never observation
  // validity, measured center colors, tooltips or exported temperatures.
  num.set(surface.centerRadii);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
      let sum = 0;
      for (let k = -2; k <= 2; k += 1) sum += num[row * cols + (col + k + cols) % cols] * weights[k + 2];
      tmpNum[row * cols + col] = sum / 16;
    }
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
      let sum = 0;
      for (let k = -2; k <= 2; k += 1) sum += tmpNum[clamp(row + k, 0, rows - 1) * cols + col] * weights[k + 2];
      num[row * cols + col] = sum / 16;
    }
  }
  // All longitudes meet at one pole. Ease the height toward its zonal mean
  // before that meeting point instead of forming a jagged polar collar.
  for (let row = 0; row < rows; row += 1) {
    let sum = 0;
    for (let col = 0; col < cols; col += 1) sum += num[row * cols + col];
    const mean = sum / cols, t = clamp((Math.abs(surface.latitudes[row]) - 75) / 15, 0, 1), blend = t * t * (3 - 2 * t);
    for (let col = 0; col < cols; col += 1) { const i = row * cols + col; surface.centerRadii[i] = num[i] + (mean - num[i]) * blend; }
  }
  const width = cols + 1;
  for (let row = 0; row <= rows; row += 1) {
    let polarValue = 0, polarCount = 0, polarHeight = 0;
    if (row === 0 || row === rows) {
      const sourceRow = row === 0 ? 0 : rows - 1;
      for (let col = 0; col < cols; col += 1) {
        const i = sourceRow * cols + col;
        if (surface.valid[i]) { polarValue += surface.cellValues[i]; polarCount += 1; }
        polarHeight += surface.centerRadii[i];
      }
    }
    for (let col = 0; col <= cols; col += 1) {
      let sum = 0, count = 0, height = 0;
      if (row === 0 || row === rows) { sum = polarValue; count = polarCount; height = polarHeight / cols; }
      else {
        for (let dr = -1; dr <= 0; dr += 1) for (let dc = -1; dc <= 0; dc += 1) {
          const i = (row + dr) * cols + (col + dc + cols) % cols;
          if (surface.valid[i]) { sum += surface.cellValues[i]; count += 1; }
          height += surface.centerRadii[i] / 4;
        }
      }
      const i = row * width + col, value = count ? sum / count : NaN;
      surface.cornerValues[i] = value; temperatureLinear(value, surface.cornerColors, i * 3);
      surface.cornerRadii[i] = height;
    }
  }
  // Smooth normals for the height field, independent of thermal colors.
  const u = surface.cornerUnits, radii = surface.cornerRadii, normals = surface.cornerNormals;
  for (let row = 0; row <= rows; row += 1) for (let col = 0; col <= cols; col += 1) {
    const i = row * width + col, j = i * 3;
    if (row === 0 || row === rows) { normals[j] = u[j]; normals[j + 1] = u[j + 1]; normals[j + 2] = u[j + 2]; continue; }
    const west = row * width + (col + cols - 1) % cols, east = row * width + (col + 1) % cols, south = i - width, north = i + width;
    const ex = u[east * 3] * radii[east] - u[west * 3] * radii[west], ey = u[east * 3 + 1] * radii[east] - u[west * 3 + 1] * radii[west], ez = u[east * 3 + 2] * radii[east] - u[west * 3 + 2] * radii[west];
    const nx = u[north * 3] * radii[north] - u[south * 3] * radii[south], ny = u[north * 3 + 1] * radii[north] - u[south * 3 + 1] * radii[south], nz = u[north * 3 + 2] * radii[north] - u[south * 3 + 2] * radii[south];
    normal(normals, j, ey * nz - ez * ny, ez * nx - ex * nz, ex * ny - ey * nx);
  }
  for (let i = 0; i < cells; i += 1) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k += 1) { const j = surface.cornerIndices[i * 4 + k] * 3; x += normals[j]; y += normals[j + 1]; z += normals[j + 2]; }
    normal(surface.centerNormals, i * 3, x, y, z);
  }
  return surface;
}
