import { describe, expect, it } from 'vitest';
import { isQuadraticResidue, legendre, mod, modInv, modPow, modSqrt } from './field';

describe('mod', () => {
  it('returns the least non-negative residue, including for negatives', () => {
    expect(mod(7n, 5n)).toBe(2n);
    expect(mod(-1n, 17n)).toBe(16n);
    expect(mod(-18n, 17n)).toBe(16n);
    expect(mod(0n, 17n)).toBe(0n);
  });
});

describe('modPow', () => {
  it('matches direct exponentiation for small cases', () => {
    expect(modPow(2n, 10n, 1000n)).toBe(24n); // 1024 mod 1000
    expect(modPow(3n, 0n, 7n)).toBe(1n);
  });
  it('satisfies Fermat: a^(p-1) ≡ 1 for prime p and a≠0', () => {
    const p = 97n;
    for (let a = 1n; a < p; a += 1n) {
      expect(modPow(a, p - 1n, p)).toBe(1n);
    }
  });
});

describe('modInv', () => {
  it('round-trips: a · a⁻¹ ≡ 1 (mod p) for every nonzero a', () => {
    const p = 97n;
    for (let a = 1n; a < p; a += 1n) {
      const inv = modInv(a, p);
      expect(mod(a * inv, p)).toBe(1n);
    }
  });
  it('throws for a non-invertible element', () => {
    expect(() => modInv(0n, 17n)).toThrow();
  });
});

describe('legendre / modSqrt', () => {
  it('classifies residues and non-residues consistently', () => {
    const p = 97n;
    for (let a = 1n; a < p; a += 1n) {
      const isQr = isQuadraticResidue(a, p);
      const root = modSqrt(a, p);
      if (isQr) {
        expect(root).not.toBeNull();
        expect(mod(root! * root!, p)).toBe(mod(a, p));
      } else {
        expect(root).toBeNull();
        expect(legendre(a, p)).toBe(-1);
      }
    }
  });

  it('works on a p ≡ 1 (mod 4) prime (general Tonelli–Shanks path)', () => {
    const p = 13n; // 13 ≡ 1 (mod 4)
    const root = modSqrt(10n, p); // 6² = 36 ≡ 10
    expect(root).not.toBeNull();
    expect(mod(root! * root!, p)).toBe(10n);
  });

  it('handles a square root on the secp256k1 field', () => {
    const p = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
    const a = mod(123456789n * 123456789n, p);
    const root = modSqrt(a, p);
    expect(root).not.toBeNull();
    expect(mod(root! * root!, p)).toBe(a);
  });
});
