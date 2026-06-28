import { secp256k1 } from '@noble/curves/secp256k1';
import { describe, expect, it } from 'vitest';
import {
  add,
  double,
  enumeratePoints,
  isOnCurve,
  isSingular,
  negate,
  pointOrder,
  scalarMul,
  scalarMulDoubleAndAdd,
  scalarMulNaive,
} from './curve-fp';
import { SECP256K1, TOY_FP } from './curves';
import type { FpPoint } from './types';

const toy = TOY_FP.curve; // y² = x³ + 2x + 2 mod 17, G = (5,1), order 19
const G = TOY_FP.G!;

describe('finite-field group law (toy curve 𝔽_17)', () => {
  it('flags singular curves and accepts the toy curve', () => {
    expect(isSingular({ a: 0n, b: 0n, p: 17n })).toBe(true);
    expect(isSingular(toy)).toBe(false);
  });

  it('every enumerated point is on the curve, and there are order-many of them', () => {
    const pts = enumeratePoints(toy);
    for (const pt of pts) expect(isOnCurve(toy, pt)).toBe(true);
    expect(BigInt(pts.length)).toBe(TOY_FP.order!); // 18 affine + O = 19
  });

  it('identity and inverse laws hold', () => {
    expect(add(toy, G, null)).toEqual(G);
    expect(add(toy, null, G)).toEqual(G);
    expect(add(toy, G, negate(toy, G))).toBeNull(); // P + (−P) = O
  });

  it('is commutative and associative', () => {
    const twoG = double(toy, G);
    const threeG = add(toy, twoG, G);
    expect(add(toy, G, twoG)).toEqual(add(toy, twoG, G)); // commutative
    // (G + 2G) + 3G == G + (2G + 3G)
    const left = add(toy, add(toy, G, twoG), threeG);
    const right = add(toy, G, add(toy, twoG, threeG));
    expect(left).toEqual(right);
  });

  it('G has the stated order: order·G = O', () => {
    expect(pointOrder(toy, G)).toBe(TOY_FP.order!);
    expect(scalarMul(toy, TOY_FP.order!, G)).toBeNull();
  });

  it('double-and-add agrees with naive repeated addition for all k < order', () => {
    for (let k = 1n; k < TOY_FP.order!; k += 1n) {
      const naive = scalarMulNaive(toy, k, G);
      const naiveResult = naive[naive.length - 1].result;
      expect(scalarMul(toy, k, G)).toEqual(naiveResult);
    }
  });

  it('doubling a 2-torsion point (y = 0) yields O', () => {
    // Find any point with y = 0 on a curve that has one: y²=x³+x ⇒ x=0 ⇒ (0,0).
    const c = { a: 1n, b: 0n, p: 17n };
    const T: FpPoint = { x: 0n, y: 0n };
    expect(isOnCurve(c, T)).toBe(true);
    expect(double(c, T)).toBeNull();
  });

  it('k = 0 gives O and negative k negates', () => {
    expect(scalarMul(toy, 0n, G)).toBeNull();
    expect(scalarMul(toy, -3n, G)).toEqual(negate(toy, scalarMul(toy, 3n, G)));
  });

  it('double-and-add trace records the bits of k', () => {
    const steps = scalarMulDoubleAndAdd(toy, 0b1011n, G); // k = 11
    const doubles = steps.filter((s) => s.op === 'double').length;
    expect(doubles).toBe(4); // 4 bits ⇒ 4 doublings
  });
});

describe('secp256k1 cross-checked against @noble/curves', () => {
  const c = SECP256K1.curve;
  const base: FpPoint = SECP256K1.G!;

  it('the base point is on the curve', () => {
    expect(isOnCurve(c, base)).toBe(true);
  });

  it('matches @noble for a range of small base-point multiples', () => {
    for (let k = 1n; k <= 20n; k += 1n) {
      const ours = scalarMul(c, k, base)!;
      const ref = secp256k1.ProjectivePoint.BASE.multiply(k).toAffine();
      expect(ours.x).toBe(ref.x);
      expect(ours.y).toBe(ref.y);
    }
  });

  it('matches @noble for a large random-ish scalar', () => {
    const k = 0x123456789abcdef0fedcba9876543210deadbeefcafef00dn;
    const ours = scalarMul(c, k, base)!;
    const ref = secp256k1.ProjectivePoint.BASE.multiply(k).toAffine();
    expect(ours.x).toBe(ref.x);
    expect(ours.y).toBe(ref.y);
  });
});
