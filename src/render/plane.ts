// Canvas renderer for a curve over the REALS: axes, the smooth curve, the two
// input points, and the chord/tangent → third intersection → reflection that
// makes P + Q. Equal scaling on both axes so the geometry isn't distorted (a
// distorted tangent would teach the wrong thing).

import { rhs } from '../math/curve-real';
import type { RealConstruction, RealCurve } from '../math/types';
import { palette } from '../ui/dom';

export interface PlaneState {
  construction: RealConstruction;
  /** Which input point is currently grabbed, for highlight. */
  dragging?: 'p' | 'q' | null;
  showInverse?: boolean;
}

export class PlaneRenderer {
  private ctx: CanvasRenderingContext2D | null;
  private scale = 1;
  private originX = 0; // screen px for world x = 0
  private originY = 0; // screen px for world y = 0
  private yMin = -6;
  private yMax = 6;

  constructor(
    private canvas: HTMLCanvasElement,
    private curve: RealCurve,
    private xRange: [number, number],
  ) {
    // Null in non-canvas environments (e.g. jsdom tests); draw becomes a no-op.
    this.ctx = canvas.getContext('2d');
    this.computeYRange();
    this.resize();
  }

  setCurve(curve: RealCurve, xRange: [number, number]) {
    this.curve = curve;
    this.xRange = xRange;
    this.computeYRange();
    this.resize();
  }

  private computeYRange() {
    let maxY = 1;
    const [x0, x1] = this.xRange;
    for (let i = 0; i <= 400; i += 1) {
      const x = x0 + ((x1 - x0) * i) / 400;
      const r = rhs(this.curve, x);
      if (r > 0) maxY = Math.max(maxY, Math.sqrt(r));
    }
    this.yMax = maxY * 1.12;
    this.yMin = -this.yMax;
  }

  /** Size the backing store to the element size × devicePixelRatio. */
  resize() {
    if (!this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 600;
    const h = this.canvas.clientHeight || 420;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const margin = 24;
    const [x0, x1] = this.xRange;
    const scaleX = (w - 2 * margin) / (x1 - x0);
    const scaleY = (h - 2 * margin) / (this.yMax - this.yMin);
    this.scale = Math.min(scaleX, scaleY);
    // Center the world box in the canvas.
    const worldW = (x1 - x0) * this.scale;
    const worldH = (this.yMax - this.yMin) * this.scale;
    this.originX = (w - worldW) / 2 - x0 * this.scale;
    this.originY = (h - worldH) / 2 + this.yMax * this.scale;
  }

  toScreen(x: number, y: number): [number, number] {
    return [this.originX + x * this.scale, this.originY - y * this.scale];
  }

  toWorldX(sx: number): number {
    return (sx - this.originX) / this.scale;
  }

  /** Which input point (if any) is within `radius` px of (sx, sy). */
  hitTest(sx: number, sy: number, radius = 16): 'p' | 'q' | null {
    const { p, q } = this.lastConstruction ?? {};
    for (const [key, pt] of [
      ['q', q],
      ['p', p],
    ] as const) {
      if (!pt) continue;
      const [px, py] = this.toScreen(pt.x, pt.y);
      if (Math.hypot(px - sx, py - sy) <= radius) return key;
    }
    return null;
  }

  private lastConstruction: RealConstruction | null = null;

  draw(state: PlaneState) {
    this.lastConstruction = state.construction;
    if (!this.ctx) return;
    const pal = palette();
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    this.drawAxes(pal);
    this.drawCurve(pal);

    const c = state.construction;
    if (c.kind === 'add' || c.kind === 'double') this.drawLine(c, pal);
    if (c.kind === 'vertical') this.drawVertical(c, pal);

    // Third intersection (way-station), then the reflection to the sum.
    if (c.thirdIntersection) {
      this.drawPoint(c.thirdIntersection, pal.muted, '−(P+Q)', { dashed: true });
      if (c.sum) this.drawReflection(c.thirdIntersection, c.sum, pal);
    }

    if (state.showInverse && c.p) {
      this.drawPoint({ x: c.p.x, y: -c.p.y }, pal.muted, '−P', { dashed: true });
    }

    // Input points on top. When doubling (P == Q) there's a single dot, label P.
    if (c.kind === 'double') {
      if (c.p) this.drawPoint(c.p, pal.accent, 'P = Q', { big: state.dragging != null });
    } else {
      if (c.q) this.drawPoint(c.q, pal.accent2, 'Q', { big: state.dragging === 'q' });
      if (c.p) this.drawPoint(c.p, pal.accent, 'P', { big: state.dragging === 'p' });
    }
    if (c.sum) this.drawPoint(c.sum, pal.success, 'P + Q', { big: true });
  }

  private drawAxes(pal: ReturnType<typeof palette>) {
    const ctx = this.ctx;
    if (!ctx) return;
    const [sx0] = this.toScreen(this.xRange[0], 0);
    const [sx1] = this.toScreen(this.xRange[1], 0);
    const [, sy0] = this.toScreen(0, this.yMax);
    const [, sy1] = this.toScreen(0, this.yMin);
    ctx.strokeStyle = pal.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx0, this.originY);
    ctx.lineTo(sx1, this.originY);
    const [oxScreen] = this.toScreen(0, 0);
    ctx.moveTo(oxScreen, sy0);
    ctx.lineTo(oxScreen, sy1);
    ctx.stroke();
  }

  private drawCurve(pal: ReturnType<typeof palette>) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.strokeStyle = pal.curve;
    ctx.lineWidth = 2;
    const [x0, x1] = this.xRange;
    const steps = 600;
    // Upper then lower branch, broken where the curve doesn't exist.
    for (const sign of [1, -1]) {
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= steps; i += 1) {
        const x = x0 + ((x1 - x0) * i) / steps;
        const r = rhs(this.curve, x);
        if (r < 0) {
          pen = false;
          continue;
        }
        const y = sign * Math.sqrt(r);
        const [sx, sy] = this.toScreen(x, y);
        if (!pen) {
          ctx.moveTo(sx, sy);
          pen = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      }
      ctx.stroke();
    }
  }

  private drawLine(c: RealConstruction, pal: ReturnType<typeof palette>) {
    if (c.lambda === null || !c.p) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const [x0, x1] = this.xRange;
    const yA = c.p.y + c.lambda * (x0 - c.p.x);
    const yB = c.p.y + c.lambda * (x1 - c.p.x);
    const [ax, ay] = this.toScreen(x0, yA);
    const [bx, by] = this.toScreen(x1, yB);
    ctx.strokeStyle = pal.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  private drawVertical(c: RealConstruction, pal: ReturnType<typeof palette>) {
    if (!c.p) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const [sx] = this.toScreen(c.p.x, 0);
    const [, top] = this.toScreen(c.p.x, this.yMax);
    const [, bot] = this.toScreen(c.p.x, this.yMin);
    ctx.strokeStyle = pal.muted;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(sx, bot);
    ctx.stroke();
    ctx.setLineDash([]);
    // "→ O" annotation near the top.
    ctx.fillStyle = pal.muted;
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillText('↑ to O (∞)', sx + 8, top + 16);
  }

  private drawReflection(
    from: { x: number; y: number },
    to: { x: number; y: number },
    pal: ReturnType<typeof palette>,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const [fx, fy] = this.toScreen(from.x, from.y);
    const [tx, ty] = this.toScreen(to.x, to.y);
    ctx.strokeStyle = pal.success;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawPoint(
    pt: { x: number; y: number },
    color: string,
    label: string,
    opts: { dashed?: boolean; big?: boolean } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const [sx, sy] = this.toScreen(pt.x, pt.y);
    const r = opts.big ? 7 : 5;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    if (opts.dashed) {
      ctx.fillStyle = palette().panel;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(label, sx + 10, sy - 8);
  }
}
