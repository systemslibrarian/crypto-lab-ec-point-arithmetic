// Exact point arithmetic on y² = x³ + ax + b over the finite field 𝔽_p.
//
// This is the real cryptographic computation the demo teaches — hand-rolled with
// BigInt so every step is inspectable. No library computes these results (we only
// cross-check them against @noble/curves in the tests). The formulas are the
// standard affine short-Weierstrass group law; the only subtlety is the explicit
// handling of the identity O (null) and the vertical-line case P + (−P) = O.

import { mod, modInv, modSqrt } from './field';
import type { FpCurve, FpPoint } from './types';

export function isIdentity(point: FpPoint): point is null {
  return point === null;
}

/** A curve over 𝔽_p is a valid group iff 4a³ + 27b² ≢ 0 (mod p). */
export function isSingular(curve: FpCurve): boolean {
  const { a, b, p } = curve;
  return mod(4n * a ** 3n + 27n * b ** 2n, p) === 0n;
}

/** Is the affine point on the curve? O is always considered on-curve. */
export function isOnCurve(curve: FpCurve, point: FpPoint): boolean {
  if (isIdentity(point)) return true;
  const { a, b, p } = curve;
  const lhs = mod(point.y * point.y, p);
  const rhs = mod(point.x * point.x * point.x + a * point.x + b, p);
  return lhs === rhs;
}

/** −P (reflection across the x-axis in 𝔽_p). −O = O. */
export function negate(curve: FpCurve, point: FpPoint): FpPoint {
  if (isIdentity(point)) return null;
  return { x: point.x, y: mod(-point.y, curve.p) };
}

function equal(a: FpPoint, b: FpPoint): boolean {
  if (isIdentity(a) || isIdentity(b)) return a === b;
  return a.x === b.x && a.y === b.y;
}

/** P + Q over 𝔽_p, with full identity / vertical-line handling. */
export function add(curve: FpCurve, p1: FpPoint, p2: FpPoint): FpPoint {
  const { a, p } = curve;
  if (isIdentity(p1)) return p2;
  if (isIdentity(p2)) return p1;

  // Vertical line: x1 == x2 but y's are negatives (or both zero) ⇒ sum is O.
  if (p1.x === p2.x && mod(p1.y + p2.y, p) === 0n) {
    return null;
  }

  let lambda: bigint;
  if (equal(p1, p2)) {
    // Tangent (doubling): λ = (3x² + a) / (2y).
    lambda = mod((3n * p1.x * p1.x + a) * modInv(2n * p1.y, p), p);
  } else {
    // Chord: λ = (y2 − y1) / (x2 − x1).
    lambda = mod((p2.y - p1.y) * modInv(p2.x - p1.x, p), p);
  }

  const x3 = mod(lambda * lambda - p1.x - p2.x, p);
  const y3 = mod(lambda * (p1.x - x3) - p1.y, p);
  return { x: x3, y: y3 };
}

/** 2P over 𝔽_p. */
export function double(curve: FpCurve, point: FpPoint): FpPoint {
  return add(curve, point, point);
}

/** A single step of a scalar-multiplication trace. */
export interface ScalarStep {
  /** 'double' or 'add' for double-and-add; 'add' for naive repeated addition. */
  op: 'double' | 'add';
  /** The accumulator after this step. */
  result: FpPoint;
  /** For double-and-add: the bit of k just consumed (MSB→LSB), else undefined. */
  bit?: 0 | 1;
}

/** k·P by naive repeated addition (P + P + … ). O(k) — only for small k.
 *  Returns the running trace so the UI can step through it geometrically. */
export function scalarMulNaive(curve: FpCurve, k: bigint, point: FpPoint): ScalarStep[] {
  const steps: ScalarStep[] = [];
  let acc: FpPoint = null;
  for (let i = 0n; i < k; i += 1n) {
    acc = add(curve, acc, point);
    steps.push({ op: 'add', result: acc });
  }
  return steps;
}

/** k·P by double-and-add (square-and-multiply for the additive group).
 *  O(log k) — the reason scalar multiplication is efficient. MSB-first. */
export function scalarMulDoubleAndAdd(curve: FpCurve, k: bigint, point: FpPoint): ScalarStep[] {
  const steps: ScalarStep[] = [];
  if (k <= 0n) return steps;
  const bits = k.toString(2);
  let acc: FpPoint = null;
  for (const ch of bits) {
    const bit = (ch === '1' ? 1 : 0) as 0 | 1;
    acc = double(curve, acc);
    steps.push({ op: 'double', result: acc, bit });
    if (bit === 1) {
      acc = add(curve, acc, point);
      steps.push({ op: 'add', result: acc, bit });
    }
  }
  return steps;
}

/** k·P (just the result), via double-and-add. Handles k = 0 ⇒ O and k < 0. */
export function scalarMul(curve: FpCurve, k: bigint, point: FpPoint): FpPoint {
  if (k === 0n || isIdentity(point)) return null;
  const neg = k < 0n;
  const steps = scalarMulDoubleAndAdd(curve, neg ? -k : k, point);
  const result = steps.length ? steps[steps.length - 1].result : null;
  return neg ? negate(curve, result) : result;
}

/** Both affine points at a given x on the curve (if x is a residue), else []. */
export function pointsAtX(curve: FpCurve, x: bigint): FpPoint[] {
  const { a, b, p } = curve;
  const rhs = mod(x * x * x + a * x + b, p);
  const y = modSqrt(rhs, p);
  if (y === null) return [];
  if (y === 0n) return [{ x, y: 0n }];
  return [
    { x, y },
    { x, y: mod(-y, p) },
  ];
}

/** Enumerate every affine point on the curve, plus O. Small p only (plotting). */
export function enumeratePoints(curve: FpCurve): FpPoint[] {
  const points: FpPoint[] = [null]; // include O
  for (let x = 0n; x < curve.p; x += 1n) {
    points.push(...pointsAtX(curve, x));
  }
  return points;
}

/** Order of the subgroup generated by P: smallest n>0 with n·P = O. Small only. */
export function pointOrder(curve: FpCurve, point: FpPoint, max = 100000n): bigint {
  if (isIdentity(point)) return 1n;
  let acc: FpPoint = point;
  let n = 1n;
  while (!isIdentity(acc) && n <= max) {
    acc = add(curve, acc, point);
    n += 1n;
  }
  return n;
}
