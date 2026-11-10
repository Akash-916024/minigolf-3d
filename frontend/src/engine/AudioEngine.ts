/**
 * Procedural Web Audio synthesizer for realistic golf and arcade obstacle SFX
 * without external audio asset dependencies.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastBounceAt = 0;
  private lastBoostAt = 0;
  private lastSandAt = 0;

  /** Unlock or lazily create AudioContext on user gesture. */
  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /** Synthesize crisp putter-to-ball strike scaled by shot power (0..1). */
  public playPutt(power: number): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const clamped = Math.max(0.12, Math.min(1, power));
    this.playTone('triangle', 280 + clamped * 160, 75, 0.28 * clamped, 0.085, now);
  }

  /** Synthesize rail impact scaled by impact velocity. */
  public playWallBounce(speed: number): void {
    if (this.muted || !this.ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBounceAt < 55) return;
    this.lastBounceAt = nowMs;

    const now = this.ctx.currentTime;
    const intensity = Math.max(0.08, Math.min(1, speed / 14));
    this.playTone('sine', 190 + intensity * 140, 68, 0.22 * intensity, 0.07, now);
  }

  /** Synthesize springy jump pad launch sweep. */
  public playJumpPad(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone('sine', 210, 660, 0.22, 0.18, now);
    this.playTone('triangle', 320, 880, 0.14, 0.16, now + 0.03);
  }

  /** Synthesize energetic speed boost pad whoosh. */
  public playBoostPad(): void {
    if (this.muted || !this.ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBoostAt < 180) return;
    this.lastBoostAt = nowMs;

    const now = this.ctx.currentTime;
    this.playTone('sawtooth', 260, 720, 0.09, 0.14, now);
  }

  /** Synthesize rubberized pinball bumper boing. */
  public playBumperHit(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone('triangle', 540, 240, 0.22, 0.11, now);
    this.playTone('sine', 780, 390, 0.14, 0.09, now + 0.02);
  }

  /** Synthesize sci-fi portal warp shimmer. */
  public playPortalWarp(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone('sine', 340, 920, 0.16, 0.22, now);
    this.playTone('triangle', 680, 440, 0.12, 0.24, now + 0.05);
  }

  /** Synthesize water splash + penalty tone. */
  public playWaterSplash(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // White noise splash burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.26);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);

    this.playTone('sine', 280, 120, 0.12, 0.22, now + 0.05);
  }

  /** Synthesize soft granular thud when entering a sand bunker. */
  public playSandTrap(): void {
    if (this.muted || !this.ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastSandAt < 400) return;
    this.lastSandAt = nowMs;

    const now = this.ctx.currentTime;
    this.playTone('sine', 140, 62, 0.14, 0.11, now);
  }

  /** Synthesize metallic cup-rim lip-out clink. */
  public playLipOut(): void {
    if (this.muted || !this.ctx) return;
    this.playTone('sine', 980, 520, 0.14, 0.1, this.ctx.currentTime);
  }

  /** Synthesize hollow cup rattle followed by an uplifting completion chord. */
  public playCupDrop(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [0, 0.06, 0.12].forEach((offset, idx) => {
      this.playTone('sine', 420 - idx * 60, 140, 0.16, 0.055, now + offset);
    });

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      this.playTone('triangle', freq, freq, 0.12, 0.45, now + 0.16 + idx * 0.065);
    });
  }

  /** Soft descending tone for out-of-bounds penalty reset. */
  public playOutOfBounds(): void {
    if (this.muted || !this.ctx) return;
    this.playTone('sine', 340, 130, 0.16, 0.26, this.ctx.currentTime);
  }

  private playTone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    peakGain: number,
    duration: number,
    startTime: number
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (startFreq !== endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}
