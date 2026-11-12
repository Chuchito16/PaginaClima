// Sonido procedural original. Sin grabaciones, recursos externos ni reproducción automática.
//
// Cómo se "lee" la anomalía con el oído:
//   · Tono ........ sube por notas de una escala pentatónica menor (E3 → E5) al aumentar la anomalía.
//   · Brillo ...... un filtro pasa-bajos se abre con el calor: el frío suena oscuro y apagado; el calor, brillante.
//   · Duración .... el frío resuena más tiempo y tranquilo; el calor suena más corto y tenso.
//   · Volumen ..... crece suavemente con la anomalía.
//   · Umbrales .... al superar +1,5 °C se suma una segunda menor (roce disonante);
//                   al superar +2,0 °C se añade además un tritono (tensión máxima).

const BASE_HZ = 164.81;                 // E3
const PENTATONIC = [0, 3, 5, 7, 10];    // semitonos de la pentatónica menor
const NOTES = 11;                       // 2 octavas + tónica: E3 … E5 (164,8 – 659,3 Hz)
const MAX_VOICES = 5;                   // evita acumulación al reproducir muy rápido
const PARTIALS = [                      // [razón de frecuencia, volumen relativo]: timbre tipo marimba/campana
  [1, 1], [2, 0.45], [3, 0.25], [4.16, 0.14],
];
const DISSONANCE = [                    // capas añadidas al cruzar cada umbral de París: [semitonos, volumen]
  [[1, 0.5]],                           // nivel 1 (≥ +1,5 °C): segunda menor
  [[1, 0.5], [6, 0.45]],                // nivel 2 (≥ +2,0 °C): segunda menor + tritono
];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const semitones = (n) => Math.pow(2, n / 12);

/** 0 (muy frío) … 1 (muy cálido), con el mismo rango que usaba el sonido original (-1 … +3 °C). */
export function heat(anomaly) { return clamp01((anomaly + 1) / 4); }

/** Índice de la nota de la escala (0 … NOTES-1) que corresponde a una anomalía. */
export function noteIndex(anomaly) { return Math.round(heat(anomaly) * (NOTES - 1)); }

/** Frecuencia (Hz) de la nota fundamental para una anomalía. */
export function noteFrequency(anomaly) {
  const i = noteIndex(anomaly);
  return BASE_HZ * semitones(PENTATONIC[i % 5] + 12 * Math.floor(i / 5));
}

/** Cuántos umbrales (0, 1 o 2) supera la anomalía. `thresholds` va en la misma referencia que `anomaly`. */
export function thresholdLevel(anomaly, thresholds = []) {
  return Math.min(2, thresholds.filter((x) => Number.isFinite(x) && anomaly >= x).length);
}

export class ClimateAudio {
  context = null;
  master = null;
  enabled = false;
  voices = 0;

  async enable() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Tu navegador no admite audio sintetizado.');
    if (!this.context) {
      this.context = new Context();
      // Compresor suave: si se solapan varias notas no hay saturación ni golpes de volumen.
      const compressor = this.context.createDynamicsCompressor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(compressor).connect(this.context.destination);
    }
    await this.context.resume();
    this.enabled = true;
  }

  disable() { this.enabled = false; this.context?.suspend(); }

  /**
   * @param {number} anomaly  anomalía de temperatura en la referencia que ve la persona
   * @param {{thresholds?: number[]}} [options]  valores (misma referencia) de +1,5 °C y +2,0 °C de París
   */
  play(anomaly, { thresholds = [] } = {}) {
    if (!this.enabled || !this.context || !this.master || !Number.isFinite(anomaly)) return;
    if (this.voices >= MAX_VOICES) return;

    const ctx = this.context, now = ctx.currentTime;
    const t = heat(anomaly), level = thresholdLevel(anomaly, thresholds);
    const root = noteFrequency(anomaly);
    const duration = 0.9 - 0.4 * t;                       // frío: 0,9 s · calor: 0,5 s
    const peak = 0.03 + 0.05 * t + 0.008 * level;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600 + 4200 * t + 800 * level, now);
    filter.Q.value = 0.7 + 0.5 * level;
    const out = ctx.createGain();
    out.gain.value = 1;
    filter.connect(out).connect(this.master);

    // [frecuencia, volumen, forma de onda, factor de decaimiento]
    const layers = PARTIALS.map(([ratio, amp], k) => [root * ratio, amp * (k ? 0.35 + 0.65 * t : 1), 'sine', 1 + 0.6 * k]);
    for (const [steps, amp] of (DISSONANCE[level - 1] ?? [])) layers.push([root * semitones(steps), amp, 'triangle', 1]);
    const total = layers.reduce((sum, [, amp]) => sum + amp, 0);

    let remaining = layers.length;
    this.voices += 1;
    for (const [frequency, amp, type, decay] of layers) {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      const end = now + duration / decay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime((peak * amp) / total, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(filter);
      oscillator.start(now); oscillator.stop(end + 0.03);
      oscillator.onended = () => {
        oscillator.disconnect(); gain.disconnect();
        if (--remaining === 0) { filter.disconnect(); out.disconnect(); this.voices -= 1; }
      };
    }
  }
}
