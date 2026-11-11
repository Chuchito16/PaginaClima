export const MIN_YEAR = 1926;
export const BASELINE_LABEL = '1880–1900 (aproximación)';

export function mean(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export function monthKey(row) {
  return `${row.year}-${String(row.month).padStart(2, '0')}`;
}

export function referenceOffset(baseline, reference) {
  return reference === 'preindustrial' ? -baseline : 0;
}

export function compareWindows(months, requestedMonths = 120) {
  if (months.length < 24) return null;
  const size = Math.min(requestedMonths, Math.floor(months.length / 2));
  const first = months.slice(0, size);
  const last = months.slice(-size);
  const firstValid=first.filter(m=>Number.isFinite(m.anomaly)).length;
  const lastValid=last.filter(m=>Number.isFinite(m.anomaly)).length;
  const firstMean = firstValid>=Math.ceil(size/2)?mean(first.map(m => m.anomaly)):null;
  const lastMean = lastValid>=Math.ceil(size/2)?mean(last.map(m => m.anomaly)):null;
  return {
    size, shortened: size < requestedMonths, first, last, firstMean, lastMean,
    delta: firstMean === null || lastMean === null ? null : lastMean - firstMean,
    firstValid,lastValid,
  };
}

export function summarize(months) {
  const valid = months.filter(m => Number.isFinite(m.anomaly));
  return {mean: mean(valid.map(m => m.anomaly)), warmest: valid.reduce((a, b) => !a || b.anomaly > a.anomaly ? b : a, null), count:valid.length};
}

export function rollingMean(months, index, size = 12) {
  if (index < size - 1) return null;
  const values = months.slice(index - size + 1, index + 1).map(m => m.anomaly);
  return values.every(Number.isFinite) ? mean(values) : null;
}

export function formatTemperature(value, digits = 2) {
  if (!Number.isFinite(value)) return 'Sin datos';
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits).replace('.', ',')} °C`;
}

export const PALETTE = [
  [-3, '#377da7'], [-1.5, '#70b7c5'], [0, '#ddd8b3'],
  [1.5, '#f7ab5b'], [3, '#e9693e'], [5, '#a72f39'],
];

export function temperatureColor(value) {
  if (!Number.isFinite(value)) return '#495a54';
  const i = PALETTE.findIndex(([v]) => v >= value);
  if (i === 0) return PALETTE[0][1];
  if (i < 0) return PALETTE.at(-1)[1];
  const [a, ca] = PALETTE[i - 1], [b, cb] = PALETTE[i];
  const t = (value - a) / (b - a);
  const rgb = c => [1,3,5].map(n => parseInt(c.slice(n, n + 2), 16));
  const aa=rgb(ca), bb=rgb(cb);
  return '#' + aa.map((v,j) => Math.round(v+(bb[j]-v)*t).toString(16).padStart(2,'0')).join('');
}
