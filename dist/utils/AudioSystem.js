// AudioSystem: procedural sound synthesis via Web Audio API
// No external audio files — all sounds are generated mathematically.
// No licensing issues.
export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this._muted = false;
    }
    // ─── AudioContext lifecycle ────────────────────────────────────────────────
    /** Lazily create and resume the AudioContext (needs user gesture first). */
    acquire() {
        if (this._muted)
            return null;
        if (!this.ctx) {
            try {
                this.ctx = new AudioContext();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 1.0;
                this.masterGain.connect(this.ctx.destination);
            }
            catch {
                return null; // Web Audio not available
            }
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
        }
        return this.ctx;
    }
    get out() {
        return this.masterGain;
    }
    // ─── Low-level helpers ─────────────────────────────────────────────────────
    /** Schedule a single oscillator note. */
    tone(freq, type, start, duration, peak, attack = 0.005) {
        const ctx = this.ctx;
        const out = this.out;
        if (!ctx || !out)
            return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }
    /** Schedule a noise burst through a bandpass filter. */
    noise(duration, start, peak, decay, filterHz = 1000, filterQ = 1) {
        const ctx = this.ctx;
        const out = this.out;
        if (!ctx || !out)
            return;
        const len = Math.ceil(ctx.sampleRate * duration);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++)
            data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterHz;
        filter.Q.value = filterQ;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(peak, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        src.start(start);
        src.stop(start + duration);
    }
    // ─── Public sounds ─────────────────────────────────────────────────────────
    /** Dice rattling on the board. */
    playDiceRoll() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        // Three short noise-+-tone bursts simulate the rattle
        for (let i = 0; i < 3; i++) {
            const at = t + i * 0.10;
            this.noise(0.10, at, 0.35, 0.09, 900, 1.2);
            this.tone(180 - i * 18, 'sine', at, 0.08, 0.18);
        }
    }
    /** Checker placed on a point — wooden thud. */
    playCheckerMove() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        this.tone(400, 'sine', t, 0.09, 0.28, 0.003);
        this.tone(220, 'sine', t + 0.01, 0.07, 0.16, 0.002);
        this.noise(0.05, t, 0.18, 0.04, 2200, 1.5);
    }
    /** Checker captured / hit — heavy impact. */
    playHit() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        this.tone(140, 'sawtooth', t, 0.20, 0.48, 0.004);
        this.tone(90, 'sine', t + 0.02, 0.15, 0.32, 0.004);
        this.noise(0.08, t, 0.38, 0.07, 550, 0.8);
    }
    /** Checker bears off — upward swoosh. */
    playBearOff() {
        const ctx = this.acquire();
        if (!ctx || !this.out)
            return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.exponentialRampToValueAtTime(950, t + 0.20);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.30, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        osc.connect(gain);
        gain.connect(this.out);
        osc.start(t);
        osc.stop(t + 0.26);
    }
    /** Victory fanfare — ascending C-major arpeggio. */
    playWin() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        // Arpeggio: C5 E5 G5 C6
        [523, 659, 784, 1047].forEach((f, i) => {
            this.tone(f, 'triangle', t + i * 0.14, 0.45, 0.28, 0.01);
        });
        // Sustained chord after arpeggio
        [523, 659, 784].forEach(f => {
            this.tone(f, 'sine', t + 0.60, 0.70, 0.14, 0.03);
        });
    }
    /** Defeat sound — descending minor phrase. */
    playLose() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        // G4 F4 Eb4 D4
        [392, 349, 311, 294].forEach((f, i) => {
            this.tone(f, 'sine', t + i * 0.22, 0.40, 0.24, 0.01);
        });
    }
    /** Doubling cube is offered or accepted — weighty thud + rising pitch. */
    playDouble() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        // Heavy wooden thud
        this.tone(120, 'sine', t, 0.18, 0.55, 0.005);
        this.tone(240, 'triangle', t + 0.03, 0.12, 0.38, 0.005);
        this.noise(0.06, t, 0.28, 0.05, 400, 0.6);
        // Rising "doubling" effect
        if (this.ctx && this.out) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(280, t + 0.06);
            osc.frequency.exponentialRampToValueAtTime(560, t + 0.28);
            gain.gain.setValueAtTime(0, t + 0.06);
            gain.gain.linearRampToValueAtTime(0.22, t + 0.10);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
            osc.connect(gain);
            gain.connect(this.out);
            osc.start(t + 0.06);
            osc.stop(t + 0.34);
        }
    }
    /** Decliner concedes — descending "surrender" phrase. */
    playDecline() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        // Short descending two-note phrase
        this.tone(330, 'sine', t, 0.22, 0.28, 0.01);
        this.tone(220, 'sine', t + 0.18, 0.28, 0.24, 0.01);
        this.noise(0.08, t + 0.02, 0.12, 0.07, 600, 0.7);
    }
    /** Match is completely won — extended grand fanfare. */
    playMatchWin() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        // Ascending arpeggio then full chord + bell shimmer
        const arpNotes = [523, 659, 784, 1047, 1319];
        arpNotes.forEach((f, i) => {
            this.tone(f, 'triangle', t + i * 0.12, 0.55, 0.32, 0.01);
        });
        // Sustained chord
        [523, 659, 784].forEach(f => {
            this.tone(f, 'sine', t + 0.72, 1.2, 0.18, 0.04);
        });
        // Shimmer on top
        [2093, 2637].forEach(f => {
            this.tone(f, 'sine', t + 0.70, 0.60, 0.06, 0.02);
        });
    }
    /** Gammon or backgammon win — win fanfare + extra triumphant accent. */
    playGammonWin() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        // Standard win arpeggio
        [523, 659, 784, 1047].forEach((f, i) => {
            this.tone(f, 'triangle', t + i * 0.14, 0.48, 0.30, 0.01);
        });
        // Extra accent: higher octave punch
        this.tone(2093, 'sine', t + 0.60, 0.28, 0.14, 0.01);
        this.tone(1047, 'triangle', t + 0.65, 0.60, 0.50, 0.03);
        this.tone(784, 'sine', t + 0.65, 0.60, 0.50, 0.03);
    }
    /** Subtle UI click feedback. */
    playButtonClick() {
        const ctx = this.acquire();
        if (!ctx)
            return;
        const t = ctx.currentTime;
        this.tone(680, 'sine', t, 0.055, 0.10, 0.003);
    }
    // ─── Mute control ──────────────────────────────────────────────────────────
    toggleMute() {
        this._muted = !this._muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this._muted ? 0 : 1;
        }
    }
    get muted() {
        return this._muted;
    }
}
export const audioSystem = new AudioSystem();
//# sourceMappingURL=AudioSystem.js.map