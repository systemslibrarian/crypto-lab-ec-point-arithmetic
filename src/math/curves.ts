// Curve presets, kept in one registry so adding a named curve later is additive.
// [extension] point — register P-256 / other named curves here without touching
// the renderers or UI.

import type { FpCurve, FpPoint, RealCurve, RealPoint } from './types';

/** A real-plane teaching curve plus a couple of suggested points on it. */
export interface RealPreset {
  id: string;
  label: string;
  curve: RealCurve;
  /** x-domain to render over. */
  xRange: [number, number];
  /** Suggested starting P and Q (x-coordinates; y solved on the upper branch). */
  suggestedX: [number, number];
}

/** A finite-field curve, optionally with a named generator and subgroup order. */
export interface FpPreset {
  id: string;
  label: string;
  curve: FpCurve;
  /** Generator point G, if the curve has a standard one. */
  G?: FpPoint;
  /** Order n of G, if known (so we don't have to walk it for huge curves). */
  order?: bigint;
  /** Can this curve be drawn as a finite lattice? (small p only). */
  plottable: boolean;
}

// ── Real-plane teaching curves ────────────────────────────────────────────────

export const REAL_PRESETS: RealPreset[] = [
  {
    id: 'teach-1',
    label: 'y² = x³ − x + 1',
    curve: { a: -1, b: 1 },
    xRange: [-2, 3.2],
    suggestedX: [-1, 1.5],
  },
  {
    id: 'teach-2',
    label: 'y² = x³ − 2x + 2',
    curve: { a: -2, b: 2 },
    xRange: [-1.8, 3],
    suggestedX: [0, 2],
  },
];

// ── Finite-field curves ───────────────────────────────────────────────────────

/** The classic textbook curve y² = x³ + 2x + 2 over 𝔽_17. G = (5, 1), order 19. */
export const TOY_FP: FpPreset = {
  id: 'fp-17',
  label: 'y² = x³ + 2x + 2 mod 17',
  curve: { a: 2n, b: 2n, p: 17n },
  G: { x: 5n, y: 1n },
  order: 19n,
  plottable: true,
};

/** A slightly larger teaching field for a denser lattice. */
export const TOY_FP_97: FpPreset = {
  id: 'fp-97',
  label: 'y² = x³ + 3x + 7 mod 97',
  curve: { a: 3n, b: 7n, p: 97n },
  G: { x: 3n, y: 25n },
  order: 99n,
  plottable: true,
};

/** secp256k1 — the real Bitcoin/Ethereum curve. Not plottable as a lattice. */
export const SECP256K1: FpPreset = {
  id: 'secp256k1',
  label: 'secp256k1 (y² = x³ + 7)',
  curve: {
    a: 0n,
    b: 7n,
    p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn,
  },
  G: {
    x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
    y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
  },
  order: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,
  plottable: false,
};

export const FP_PRESETS: FpPreset[] = [TOY_FP, TOY_FP_97, SECP256K1];

/** Solve the upper-branch y for a real-curve x (used to place suggested points). */
export function realPointAtX(curve: RealCurve, x: number): RealPoint {
  const r = x * x * x + curve.a * x + curve.b;
  if (r < 0) return null;
  return { x, y: Math.sqrt(r) };
}
