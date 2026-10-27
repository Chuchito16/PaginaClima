// Original procedural sound. No recordings, external assets or autoplay.
export class ClimateAudio {
  context = null;
  enabled = false;
  async enable() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Tu navegador no admite audio sintetizado.');
    this.context ??= new Context();
    await this.context.resume();
    this.enabled = true;
  }
  disable() { this.enabled = false; this.context?.suspend(); }
  play(anomaly) {
    if (!this.enabled || !this.context || !Number.isFinite(anomaly)) return;
    const ctx = this.context, time = ctx.currentTime;
    const t = Math.max(0, Math.min(1, (anomaly + 1) / 4));
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(164.81 * Math.pow(2, t * 2), time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.025 + t * 0.045, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(time); oscillator.stop(time + 0.4);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
