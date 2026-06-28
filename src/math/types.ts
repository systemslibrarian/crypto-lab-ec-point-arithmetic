// Shared point/curve types for both the real-plane and finite-field worlds.
//
// The identity element O (the "point at infinity") is represented by `null` in
// both worlds. This is deliberate: O has no (x, y) coordinates, so giving it a
// real coordinate would be a lie. Treating it as a distinct sentinel makes the
// group-law edge cases (P + (−P) = O, doubling a 2-torsion point) explicit in
// the code rather than hidden behind a magic coordinate.

/** A point on a curve over the reals, or O (point at infinity) when null. */
export type RealPoint = { x: number; y: number } | null;

/** A point on a curve over 𝔽_p, or O (point at infinity) when null. */
export type FpPoint = { x: bigint; y: bigint } | null;

/** Short Weierstrass curve y² = x³ + ax + b over the reals. */
export interface RealCurve {
  a: number;
  b: number;
}

/** Short Weierstrass curve y² = x³ + ax + b over 𝔽_p. */
export interface FpCurve {
  a: bigint;
  b: bigint;
  p: bigint;
}

/** The geometric construction behind a single point addition over the reals.
 *  Everything the renderer needs to draw the chord/tangent → third point →
 *  reflection, plus the algebraic slope λ used. */
export interface RealConstruction {
  kind: 'add' | 'double' | 'vertical' | 'identity';
  p: RealPoint;
  q: RealPoint;
  /** Slope of the chord (add) or tangent (double); null for vertical/identity. */
  lambda: number | null;
  /** The third intersection of the line with the curve, BEFORE reflection. */
  thirdIntersection: RealPoint;
  /** The sum P + Q (the reflection of the third intersection). */
  sum: RealPoint;
}
