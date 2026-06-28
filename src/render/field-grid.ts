// Canvas renderer for a curve over 𝔽_p as a finite lattice of points. Same group
// law as the real plane, but the "line" through P and Q wraps around mod p, so
// instead of a straight chord we highlight the collinear points and mark the
// third intersection and its reflection — making "same algebra, wrapped picture"
// visible. Small p only (the toggle hides this for secp256k1).

import { enumeratePoints } from '../math/curve-fp';
import { mod, modInv } from '../math/field';
import type { FpCurve, FpPoint } from '../math/types';
import { palette } from '../ui/dom';

export interface GridState {
  p: FpPoint;
  q: FpPoint;
  sum: FpPoint;
  thirdIntersection: FpPoint;
}

/** The residue-class line through P and Q over 𝔽_p, as one cell per column.
 *  Returns the set of (x, y) the line passes through (it "wraps" mod p), plus a
 *  flag for the vertical case. Empty when P or Q is the identity. */
function modularLine(
  curve: FpCurve,
  P: FpPoint,
  Q: FpPoint,
): { cells: { x: bigint; y: bigint }[]; vertical: boolean; verticalX: bigint } {
  if (!P || !Q) return { cells: [], vertical: false, verticalX: 0n };
  const { a, p } = curve;
  // Vertical line: same x, negated y (or doubling a y=0 point).
  if (P.x === Q.x && mod(P.y + Q.y, p) === 0n) {
    return { cells: [], vertical: true, verticalX: P.x };
  }
  let lambda: bigint;
  if (P.x === Q.x && P.y === Q.y) {
    lambda = mod((3n * P.x * P.x + a) * modInv(2n * P.y, p), p);
  } else {
    lambda = mod((Q.y - P.y) * modInv(Q.x - P.x, p), p);
  }
  const cells: { x: bigint; y: bigint }[] = [];
  for (let x = 0n; x < p; x += 1n) {
    cells.push({ x, y: mod(lambda * (x - P.x) + P.y, p) });
  }
  return { cells, vertical: false, verticalX: 0n };
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

    // The residue-class line through P and Q — drawn first, faintly, as small
    // ticks so the "wrapped chord" is visible behind the points it meets.
    const line = modularLine(this.curve, state.p, state.q);
    ctx.fillStyle = pal.accent;
    for (const cell of line.cells) {
      const [lx, ly] = this.cellXY(cell.x, cell.y);
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(1.5, this.cell * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
    if (line.vertical) {
      const [vx, top] = this.cellXY(line.verticalX, BigInt(p - 1));
      const [, bot] = this.cellXY(line.verticalX, 0n);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = pal.muted;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(vx, top - this.cell * 0.5);
      ctx.lineTo(vx, bot + this.cell * 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;

    // All curve points.
    for (const pt of this.points) this.dot(pt, pal.curve, 0.42);

    // Highlights, with labels so the construction reads without the side panel.
    this.dot(state.thirdIntersection, pal.muted, 0.7, true, '−(P+Q)');
    this.dot(state.sum, pal.success, 0.7, false, 'P+Q');
    this.dot(state.q, pal.accent2, 0.7, false, 'Q');
    this.dot(state.p, pal.accent, 0.7, false, 'P');
  }

  private dot(pt: FpPoint, fill: string, scale: number, ring = false, label?: string) {
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
      ctx.strokeStyle = fill;
      ctx.stroke();
    } else {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (label) {
      ctx.fillStyle = fill;
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(label, sx + r + 2, sy - r);
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
