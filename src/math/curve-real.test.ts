import { describe, expect, it } from 'vitest';
import { add, addConstruction, double, isSingular, negate } from './curve-real';
import type { RealCurve, RealPoint } from './types';

const curve: RealCurve = { a: -1, b: 1 }; // y² = x³ − x + 1, nonsingular

function onCurve(p: RealPoint): boolean {
  if (p === null) return true;
  const lhs = p.y * p.y;
  const rhs = p.x ** 3 + curve.a * p.x + curve.b;
  return Math.abs(lhs - rhs) < 1e-6;
}

// A couple of points actually on the curve.
const P: RealPoint = { x: 0, y: 1 }; // 1 = 0 − 0 + 1 ✓
const Q: RealPoint = { x: 1, y: 1 }; // 1 = 1 − 1 + 1 ✓

describe('real curve group law', () => {
  it('rejects singular curves via the discriminant', () => {
    expect(isSingular({ a: 0, b: 0 })).toBe(true); // 4·0 + 27·0 = 0
    expect(isSingular(curve)).toBe(false);
  });

  it('P + O = P and O + P = P', () => {
    expect(add(curve, P, null)).toEqual(P);
    expect(add(curve, null, P)).toEqual(P);
  });

  it('P + (−P) = O (the vertical line)', () => {
    const c = addConstruction(curve, P, negate(P));
    expect(c.kind).toBe('vertical');
    expect(c.sum).toBeNull();
  });

  it('is commutative: P + Q = Q + P, and the sum lies on the curve', () => {
    const pq = add(curve, P, Q);
    const qp = add(curve, Q, P);
    expect(pq).not.toBeNull();
    expect(onCurve(pq)).toBe(true);
    expect(pq!.x).toBeCloseTo(qp!.x, 9);
    expect(pq!.y).toBeCloseTo(qp!.y, 9);
  });

  it('doubling uses the tangent and lands on the curve', () => {
    const c = addConstruction(curve, P, P);
    expect(c.kind).toBe('double');
    expect(c.lambda).not.toBeNull();
    expect(onCurve(double(curve, P))).toBe(true);
  });

  it('the third intersection is the un-reflected sum', () => {
    const c = addConstruction(curve, P, Q);
    expect(c.thirdIntersection).not.toBeNull();
    expect(c.sum!.x).toBeCloseTo(c.thirdIntersection!.x, 9);
    expect(c.sum!.y).toBeCloseTo(-c.thirdIntersection!.y, 9);
    expect(onCurve(c.thirdIntersection)).toBe(true);
  });
});
