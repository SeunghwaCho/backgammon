// AnimationSystem: manages checker-move animations and hit-burst effects
// All drawing is self-contained — no game state dependency

import { Player } from '../game/Types.js';

// ── Timing constants (exported for main.ts to align AI delays) ────────────────

/** Duration of a checker-in-flight animation (ms). */
export const ANIM_MOVE_MS = 380;
/** Duration of a hit-burst particle effect (ms). */
export const ANIM_HIT_MS  = 520;

// ── Easing ────────────────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Animation descriptors ─────────────────────────────────────────────────────

export interface MoveAnim {
  kind: 'move';
  fromX: number; fromY: number;
  toX:   number; toY:   number;
  player: Player;
  r: number;           // base checker radius
  startTime: number;
  duration:  number;
}

export interface HitBurstAnim {
  kind: 'hitBurst';
  x: number; y: number;
  r: number;           // reference radius (checker radius)
  startTime: number;
  duration:  number;
}

export type Anim = MoveAnim | HitBurstAnim;

// ── AnimationSystem ────────────────────────────────────────────────────────────

export class AnimationSystem {
  private anims: Anim[] = [];

  /** Enqueue a new animation. startTime defaults to performance.now(). */
  queue(anim: Anim): void {
    this.anims.push(anim);
  }

  /** True if any animation is currently running or scheduled to start. */
  isActive(): boolean {
    const now = performance.now();
    return this.anims.some(a => now - a.startTime < a.duration);
  }

  clear(): void { this.anims = []; }

  /**
   * Draw all active animations onto ctx.
   * Finished entries are pruned automatically.
   */
  render(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    const alive: Anim[] = [];

    for (const anim of this.anims) {
      const elapsed = now - anim.startTime;
      if (elapsed < 0) { alive.push(anim); continue; } // not yet started

      const t = Math.min(1, elapsed / anim.duration);
      if (anim.kind === 'move') {
        this.drawMoveAnim(ctx, anim, t);
      } else {
        this.drawHitBurst(ctx, anim, t);
      }
      if (t < 1) alive.push(anim);
    }

    this.anims = alive;
  }

  // ── Move animation ───────────────────────────────────────────────────────────

  private drawMoveAnim(ctx: CanvasRenderingContext2D, a: MoveAnim, t: number): void {
    const et = easeOutCubic(t);

    // Linear interpolation for X, eased for Y (gives a slight arc feel)
    const cx = a.fromX + (a.toX - a.fromX) * et;
    const cy = a.fromY + (a.toY - a.fromY) * et;

    // Arc lift: checker rises in proportion to distance travelled
    const dist = Math.hypot(a.toX - a.fromX, a.toY - a.fromY);
    const arcH  = Math.min(dist * 0.20, 44);
    const finalCY = cy - Math.sin(t * Math.PI) * arcH;

    // Scale up at peak, back to normal on landing
    const scale = 1 + Math.sin(t * Math.PI) * 0.20;
    const r = a.r * scale;
    const isWhite = a.player === 'white';

    ctx.save();

    // Soft drop shadow that grows at peak
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur  = 10 + Math.sin(t * Math.PI) * 12;

    // Hard shadow on board surface
    ctx.beginPath();
    ctx.arc(cx + 2, finalCY + 3, r * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();

    // Main body
    ctx.beginPath();
    ctx.arc(cx, finalCY, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      cx - r * 0.3, finalCY - r * 0.35, r * 0.08,
      cx,           finalCY,              r
    );
    if (isWhite) {
      grad.addColorStop(0,   '#ffffff');
      grad.addColorStop(0.65, '#f5f0e8');
      grad.addColorStop(1,   '#a0a090');
    } else {
      grad.addColorStop(0,   '#6a6a8a');
      grad.addColorStop(0.65, '#1a1a2e');
      grad.addColorStop(1,   '#04040e');
    }
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = isWhite ? '#c8c0b0' : '#4a4a6e';
    ctx.lineWidth   = Math.max(1, r * 0.13);
    ctx.stroke();

    // Inner ring decoration
    ctx.beginPath();
    ctx.arc(cx, finalCY, r * 0.63, 0, Math.PI * 2);
    ctx.strokeStyle = isWhite ? 'rgba(180,170,150,0.55)' : 'rgba(110,110,155,0.55)';
    ctx.lineWidth   = Math.max(0.5, r * 0.07);
    ctx.stroke();

    // Faint speed-trail (first half of flight only)
    if (t > 0.05 && t < 0.55) {
      const trailAlpha = (0.55 - t) / 0.55 * 0.35;
      for (let i = 1; i <= 3; i++) {
        const tt  = easeOutCubic(Math.max(0, t - i * 0.06));
        const tcx = a.fromX + (a.toX - a.fromX) * tt;
        const tcy = a.fromY + (a.toY - a.fromY) * tt;
        const tArcH  = Math.min(dist * 0.20, 44);
        const tFinalCY = tcy - Math.sin((t - i * 0.06) * Math.PI) * tArcH;
        const tr  = r * (1 - i * 0.25);
        ctx.beginPath();
        ctx.arc(tcx, tFinalCY, Math.max(1, tr), 0, Math.PI * 2);
        ctx.fillStyle = isWhite
          ? `rgba(245,240,232,${trailAlpha / i})`
          : `rgba(80,80,120,${trailAlpha / i})`;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // ── Hit burst ─────────────────────────────────────────────────────────────────

  private drawHitBurst(ctx: CanvasRenderingContext2D, a: HitBurstAnim, t: number): void {
    const et    = easeOutCubic(t);
    const alpha = 1 - t;

    ctx.save();

    // Central flash (first 22% of animation)
    if (t < 0.22) {
      const flashT = t / 0.22;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * 0.95 * (1 - flashT * 0.45), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 200, ${(1 - flashT) * 0.70})`;
      ctx.fill();
    }

    // Outer ring (main)
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r * (0.45 + et * 3.0), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 65, 10, ${alpha * 0.95})`;
    ctx.lineWidth   = Math.max(0.5, 4.5 * (1 - t * 0.85));
    ctx.stroke();

    // Inner ring (faster decay)
    if (t < 0.60) {
      const t2  = t / 0.60;
      const et2 = easeOutCubic(t2);
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * (0.30 + et2 * 1.7), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 210, 40, ${(1 - t2) * 0.90})`;
      ctx.lineWidth   = Math.max(0.5, 3.0 * (1 - t2));
      ctx.stroke();
    }

    // 8 particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const dist  = et * a.r * 3.2;
      const px    = a.x + Math.cos(angle) * dist;
      const py    = a.y + Math.sin(angle) * dist;
      const pr    = Math.max(0.5, a.r * 0.23 * (1 - t));
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0
        ? `rgba(255, 100, 10, ${alpha * 0.95})`
        : `rgba(255, 230, 40, ${alpha * 0.90})`;
      ctx.fill();
    }

    // 4 diagonal spark lines
    if (t < 0.45) {
      const t3 = t / 0.45;
      const len = a.r * 0.9 * easeOutCubic(t3);
      ctx.strokeStyle = `rgba(255, 180, 30, ${(1 - t3) * 0.7})`;
      ctx.lineWidth   = Math.max(0.5, 2 * (1 - t3));
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const sx    = a.x + Math.cos(angle) * a.r * 0.3;
        const sy    = a.y + Math.sin(angle) * a.r * 0.3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
