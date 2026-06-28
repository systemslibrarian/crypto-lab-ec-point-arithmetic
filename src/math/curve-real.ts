// Point arithmetic on a short Weierstrass curve y² = x³ + ax + b over the REALS.
//
// This world exists purely to build geometric intuition — it uses `number`, not
// exact arithmetic, and is never presented as the cryptographic computation (see
// curve-fp.ts for that). What it gives the renderer is the *construction*: the
// chord (or tangent), the third intersection of that line with the curve, and the
// reflection across the x-axis that defines P + Q.

import type { RealConstruction, RealCurve, RealPoint } from './types';

/** True for the identity O. */
export function isIdentity(p: RealPoint): p is null {
  return p === null;
}

/** y² = x³ + ax + b — the right-hand side at x. */
export function rhs(curve: RealCurve, x: number): number {
  return x * x * x + curve.a * x + curve.b;
}

/** A curve is singular (not a group) iff its discriminant 4a³ + 27b² = 0. */
export function isSingular(curve: RealCurve): boolean {
  const d = 4 * curve.a ** 3 + 27 * curve.b ** 2;
  return Math.abs(d) < 1e-12;
}

/** The two y-values at x (upper, then lower), or null if x is left of the curve. */
export function yAt(curve: RealCurve, x: number): [number, number] | null {
  const r = rhs(curve, x);
  if (r < 0) return null;
  const y = Math.sqrt(r);
  return [y, -y];
}

/** −P is the reflection of P across the x-axis. −O = O. */
export function negate(p: RealPoint): RealPoint {
  if (isIdentity(p)) return null;
  return { x: p.x, y: -p.y };
}

const EPS = 1e-9;

function samePoint(p: { x: number; y: number }, q: { x: number; y: number }): boolean {
  return Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS;
}

/** Full construction for P + Q, including the geometry the renderer draws.
 *  Handles the identity, the vertical-line case (P + (−P) = O), the chord case
 *  (P ≠ Q), and the tangent/doubling case (P = Q). */
export function addConstruction(curve: RealCurve, p: RealPoint, q: RealPoint): RealConstruction {
  // Identity cases: P + O = P, O + Q = Q.
  if (isIdentity(p) || isIdentity(q)) {
    return {
      kind: 'identity',
      p,
      q,
      lambda: null,
      thirdIntersection: null,
      sum: isIdentity(p) ? q : p,
    };
  }

  // Vertical line: same x, opposite (or zero) y ⇒ the line misses a third affine
  // point and the sum is O. This includes P + (−P) and doubling a y = 0 point.
  if (Math.abs(p.x - q.x) < EPS && Math.abs(p.y + q.y) < EPS) {
    return { kind: 'vertical', p, q, lambda: null, thirdIntersection: null, sum: null };
  }

  // Slope: chord for distinct points, tangent (via the derivative) for doubling.
  const doubling = samePoint(p, q);
  const lambda = doubling ? (3 * p.x * p.x + curve.a) / (2 * p.y) : (q.y - p.y) / (q.x - p.x);

  const x3 = lambda * lambda - p.x - q.x;
  // The line meets the curve a third time at (x3, yLine); P + Q is its reflection.
  const yLine = p.y + lambda * (x3 - p.x);
  const sum: RealPoint = { x: x3, y: -yLine };

  return {
    kind: doubling ? 'double' : 'add',
    p,
    q,
    lambda,
    thirdIntersection: { x: x3, y: yLine },
    sum,
  };
}

/** P + Q over the reals (just the resulting point). */
export function add(curve: RealCurve, p: RealPoint, q: RealPoint): RealPoint {
  return addConstruction(curve, p, q).sum;
}

/** 2P over the reals. */
export function double(curve: RealCurve, p: RealPoint): RealPoint {
  return addConstruction(curve, p, p).sum;
}
