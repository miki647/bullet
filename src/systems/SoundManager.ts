/**
 * SoundManager — Procedural sound effects using Web Audio API.
 * No external audio files needed; all sounds are synthesized.
 */

class SoundManagerImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted = false;

  /** Lazily create AudioContext (must happen after user gesture) */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Resume context after user gesture */
  resume(): void {
    const ctx = this.ensure();
    if (ctx?.state === 'suspended') ctx.resume();
  }

  get muted(): boolean { return this._muted; }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : 0.35;
    }
    return this._muted;
  }

  // ─── Sound Effects ──────────────────────────────────────

  /** Bullet fire — short bright "pew" */
  fire(): void {
    const ctx = this.ensure();
    if (!ctx || this._muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  /** Enemy explosion — noise burst + low thud */
  explosion(intensity: number = 1): void {
    const ctx = this.ensure();
    if (!ctx || this._muted) return;
    const t = ctx.currentTime;
    const dur = 0.15 + intensity * 0.1;

    // Noise burst
    const bufferSize = ctx.sampleRate * dur;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2 * intensity, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    // Bandpass for crunchier sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800 + intensity * 400;
    filter.Q.value = 1.5;
    noiseSrc.connect(filter).connect(noiseGain).connect(this.masterGain!);
    noiseSrc.start(t);
    noiseSrc.stop(t + dur);

    // Low thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120 * intensity, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + dur);
    oscGain.gain.setValueAtTime(0.25 * Math.min(intensity, 2), t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oscGain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + dur);
  }

  /** Tank explosion — bigger, deeper */
  tankExplosion(): void {
    this.explosion(2.0);
    const ctx = this.ensure();
    if (!ctx || this._muted) return;
    const t = ctx.currentTime;

    // Extra sub-bass rumble
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(15, t + 0.5);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  /** Non-lethal hit (e.g., tank armor) — short metallic ping */
  hit(): void {
    const ctx = this.ensure();
    if (!ctx || this._muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.06);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /** Chain milestone — rising synth chime */
  chainMilestone(level: 'nice' | 'awesome' | 'incredible' | 'unstoppable'): void {
    const ctx = this.ensure();
    if (!ctx || this._muted) return;
    const t = ctx.currentTime;

    const freqs: Record<string, number[]> = {
      nice: [523, 659],           // C5, E5
      awesome: [659, 784, 1047],  // E5, G5, C6
      incredible: [784, 988, 1319, 1568], // G5, B5, E6, G6
      unstoppable: [1047, 1319, 1568, 2093], // C6, E6, G6, C7
    };

    const notes = freqs[level] || freqs.nice;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const noteStart = t + i * 0.08;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.3);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(noteStart);
      osc.stop(noteStart + 0.3);
    });
  }

  /** Player damage — harsh distorted buzz */
  playerHit(): void {
    const ctx = this.ensure();
    if (!ctx || this._muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  /** Player death — dramatic descending */
  playerDeath(): void {
    const ctx = this.ensure();
    if (!ctx || this._muted) return;
    const t = ctx.currentTime;

    // Descending tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 1.0);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 1.0);

    // Noise sweep
    const bufSize = ctx.sampleRate * 0.8;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) ch[i] = (Math.random() * 2 - 1) * 0.3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.15, t + 0.1);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.connect(ng).connect(this.masterGain!);
    src.start(t + 0.1);
    src.stop(t + 0.8);
  }

  /** Wave transition burst — sweeping whoosh */
  waveBurst(): void {
    const ctx = this.ensure();
    if (!ctx || this._muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.4);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** Wave announce — short fanfare-like tone */
  waveAnnounce(): void {
    const ctx = this.ensure();
    if (!ctx || this._muted) return;
    const t = ctx.currentTime;

    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const start = t + i * 0.1;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }
}

/** Singleton */
export const SoundManager = new SoundManagerImpl();
