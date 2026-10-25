import { UserSettings } from '../types/game';

/**
 * Procedural Web Audio API sound engine for APEX PITCH 26.
 * Zero external audio file dependencies — generates crisp referee whistles,
 * ball kicks, goalpost impacts, net swishes, crowd roars, and UI feedback.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private crowdGain: GainNode | null = null;
  private crowdSource: AudioBufferSourceNode | null = null;
  private settings: UserSettings = {
    masterVolume: 0.8,
    musicVolume: 0.5,
    crowdVolume: 0.65,
    sfxVolume: 0.85,
    commentaryVolume: 0.8,
    graphicsQuality: 'High',
    defaultCamera: 'Broadcast',
    joystickDeadzone: 0.12,
    controlSensitivity: 1.0,
    buttonScale: 1.0,
    hapticsEnabled: true,
    showRadar: true,
    showPlayerNames: true,
    autoSwitchDefender: true,
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public updateSettings(newSettings: UserSettings) {
    this.settings = newSettings;
    if (this.crowdGain && this.ctx) {
      const target = this.settings.masterVolume * this.settings.crowdVolume * 0.14;
      this.crowdGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
  }

  public triggerHaptic(durationMs = 18) {
    if (this.settings.hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(durationMs);
      } catch {
        // Ignore on unsupported browsers
      }
    }
  }

  public startCrowdAmbience() {
    const ctx = this.ensureContext();
    if (!ctx || this.crowdSource) return;

    try {
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.03 * white) / 1.03;
        lastOut = data[i];
        data[i] *= 1.5;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 520;
      filter.Q.value = 0.7;

      const gain = ctx.createGain();
      gain.gain.value = this.settings.masterVolume * this.settings.crowdVolume * 0.12;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      this.crowdSource = noise;
      this.crowdGain = gain;
    } catch {
      // Ignore audio block
    }
  }

  public stopCrowdAmbience() {
    if (this.crowdSource) {
      try {
        this.crowdSource.stop();
        this.crowdSource.disconnect();
      } catch {
        // Ignore
      }
      this.crowdSource = null;
      this.crowdGain = null;
    }
  }

  public playKick(power = 0.6) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.settings.masterVolume * this.settings.sfxVolume;
    if (vol <= 0.01) return;

    this.triggerHaptic(12 + Math.round(power * 18));

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(135 + power * 45, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.09);

    gain.gain.setValueAtTime(Math.min(1, vol * (0.45 + power * 0.45)), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playWhistle(type: 'single' | 'double' | 'fulltime' = 'single') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.settings.masterVolume * this.settings.sfxVolume;
    if (vol <= 0.01) return;

    this.triggerHaptic(40);

    const blow = (startOffset: number, duration: number) => {
      const now = ctx.currentTime + startOffset;
      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2850, now);

      // Pea-whistle trill modulation
      mod.type = 'sine';
      mod.frequency.setValueAtTime(42, now);
      modGain.gain.setValueAtTime(140, now);

      mod.connect(modGain);
      modGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol * 0.28, now + 0.02);
      gain.gain.setValueAtTime(vol * 0.26, now + duration - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      mod.start(now);
      osc.stop(now + duration + 0.01);
      mod.stop(now + duration + 0.01);
    };

    if (type === 'single') {
      blow(0, 0.36);
    } else if (type === 'double') {
      blow(0, 0.18);
      blow(0.24, 0.35);
    } else {
      blow(0, 0.18);
      blow(0.24, 0.18);
      blow(0.48, 0.55);
    }
  }

  public playGoalCheer() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.settings.masterVolume * this.settings.crowdVolume;
    this.triggerHaptic(90);

    if (this.crowdGain) {
      const now = ctx.currentTime;
      const base = this.settings.masterVolume * this.settings.crowdVolume * 0.14;
      this.crowdGain.gain.cancelScheduledValues(now);
      this.crowdGain.gain.setValueAtTime(base, now);
      this.crowdGain.gain.linearRampToValueAtTime(Math.min(0.85, vol * 0.65), now + 0.25);
      this.crowdGain.gain.exponentialRampToValueAtTime(Math.max(0.02, base), now + 4.0);
    }

    // Celebratory stadium horn chord
    const sfxVol = this.settings.masterVolume * this.settings.sfxVolume;
    if (sfxVol > 0.02) {
      [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
        const now = ctx.currentTime + i * 0.04;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(sfxVol * 0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.9);
      });
    }
  }

  public playPostHit() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.settings.masterVolume * this.settings.sfxVolume;
    if (vol <= 0.01) return;

    this.triggerHaptic(35);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.22);
    gain.gain.setValueAtTime(vol * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playUiClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.settings.masterVolume * this.settings.sfxVolume;
    if (vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.035);
    gain.gain.setValueAtTime(vol * 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }
}

export const soundEngine = new SoundEngine();
