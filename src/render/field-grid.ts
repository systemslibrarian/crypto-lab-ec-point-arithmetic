// Canvas renderer for a curve over 𝔽_p as a finite lattice of points. Same group
// law as the real plane, but the "line" through P and Q wraps around mod p, so
// instead of a straight chord we highlight the collinear points and mark the
// third intersection and its reflection — making "same algebra, wrapped picture"
// visible. Small p only (the toggle hides this for secp256k1).

import { enumeratePoints } from '../math/curve-fp';
import type { FpCurve, FpPoint } from '../math/types';
import { palette } from '../ui/dom';

export interface GridState {
  p: FpPoint;
  q: FpPoint;
  sum: FpPoint;
  thirdIntersection: FpPoint;
}

export class FieldGridRenderer {
  private ctx: CanvasRenderingContext2D | null;
  private cell = 20;
  private margin = 28;
  private points: { x: bigint; y: bigint }[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private curve: FpCurve,
  ) {
    // Null in non-canvas environments (e.g. jsdom tests); draw becomes a no-op.
    this.ctx = canvas.getContext('2d');
    this.setCurve(curve);
  }

  setCurve(curve: FpCurve) {
    this.curve = curve;
    this.points = enumeratePoints(curve).filter(
      (pt): pt is { x: bigint; y: bigint } => pt !== null,
    );
    this.resize();
  }

  resize() {
    if (!this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const p = Number(this.curve.p);
    const w = this.canvas.clientWidth || 420;
    const avail = w - 2 * this.margin;
    this.cell = Math.max(6, Math.floor(avail / p));
    const size = this.margin * 2 + this.cell * p;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.canvas.style.height = `${size}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private cellXY(x: bigint, y: bigint): [number, number] {
    const p = Number(this.curve.p);
    const sx = this.margin + (Number(x) + 0.5) * this.cell;
    const sy = this.margin + (p - 1 - Number(y) + 0.5) * this.cell;
    return [sx, sy];
  }

  /** Curve point nearest a click, within half a cell. */
  hitTest(sx: number, sy: number): FpPoint {
    let best: FpPoint = null;
    let bestD = this.cell;
    for (const pt of this.points) {
      const [px, py] = this.cellXY(pt.x, pt.y);
      const d = Math.hypot(px - sx, py - sy);
      if (d < bestD) {
        bestD = d;
        best = pt;
      }
    }
    return best;
  }

  draw(state: GridState) {
    const ctx = this.ctx;
    if (!ctx) return;
    const pal = palette();
    const p = Number(this.curve.p);
    const size = this.margin * 2 + this.cell * p;
    ctx.clearRect(0, 0, size, size);

    // Grid.
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= p; i += 1) {
      const o = this.margin + i * this.cell;
      ctx.beginPath();
      ctx.moveTo(this.margin, o);
      ctx.lineTo(this.margin + p * this.cell, o);
      ctx.moveTo(o, this.margin);
      ctx.lineTo(o, this.margin + p * this.cell);
      ctx.stroke();
    }

    // All curve points.
    for (const pt of this.points) this.dot(pt, pal.curve, 0.42);

    // Highlights.
    const mark = (pt: FpPoint, color: string, ring = false) => {
      if (!pt) return;
      this.dot(pt, color, 0.7, ring);
    };
    mark(state.thirdIntersection, pal.muted, true);
    mark(state.sum, pal.success);
    mark(state.q, pal.accent2);
    mark(state.p, pal.accent);
  }

  private dot(pt: FpPoint, color: string, scale: number, ring = false) {
    if (!pt) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const [sx, sy] = this.cellXY(pt.x, pt.y);
    const r = this.cell * scale * 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    if (ring) {
      ctx.fillStyle = palette().panel;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

export interface Highlight {
  point: FpPoint;
  color: string;
  label?: string;
  ring?: boolean;
}

/** One-shot lattice draw used by the scalar-mult and ECDLP panels (non-interactive). */
export function renderLattice(canvas: HTMLCanvasElement, curve: FpCurve, highlights: Highlight[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const pal = palette();
  const dpr = window.devicePixelRatio || 1;
  const p = Number(curve.p);
  const margin = 24;
  const w = canvas.clientWidth || 360;
  const cell = Math.max(5, Math.floor((w - 2 * margin) / p));
  const size = margin * 2 + cell * p;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.height = `${size}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const xy = (x: bigint, y: bigint): [number, number] => [
    margin + (Number(x) + 0.5) * cell,
    margin + (p - 1 - Number(y) + 0.5) * cell,
  ];

  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= p; i += 1) {
    const o = margin + i * cell;
    ctx.beginPath();
    ctx.moveTo(margin, o);
    ctx.lineTo(margin + p * cell, o);
    ctx.moveTo(o, margin);
    ctx.lineTo(o, margin + p * cell);
    ctx.stroke();
  }

  for (const pt of enumeratePoints(curve)) {
    if (!pt) continue;
    const [sx, sy] = xy(pt.x, pt.y);
    ctx.beginPath();
    ctx.arc(sx, sy, cell * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = pal.curve;
    ctx.fill();
  }

  for (const h of highlights) {
    if (!h.point) continue;
    const [sx, sy] = xy(h.point.x, h.point.y);
    ctx.beginPath();
    ctx.arc(sx, sy, cell * 0.36, 0, Math.PI * 2);
    if (h.ring) {
      ctx.fillStyle = pal.panel;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = h.color;
      ctx.stroke();
    } else {
      ctx.fillStyle = h.color;
      ctx.fill();
    }
    if (h.label) {
      ctx.fillStyle = h.color;
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(h.label, sx + cell * 0.5, sy - cell * 0.4);
    }
  }
}
