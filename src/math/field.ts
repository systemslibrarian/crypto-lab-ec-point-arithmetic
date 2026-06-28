// Exact arithmetic in the finite field 𝔽_p, hand-rolled with BigInt.
//
// This is the inspectable heart of the finite-field side of the demo: there is
// no floating point here and nothing is delegated to a library. Modular inverse
// is the extended Euclidean algorithm; modular square root is Tonelli–Shanks
// (with the common p ≡ 3 (mod 4) fast path). Every step is the textbook step.

/** Least non-negative residue of a mod p (handles negative a). */
export function mod(a: bigint, p: bigint): bigint {
  const r = a % p;
  return r >= 0n ? r : r + p;
}

/** Modular exponentiation: base^exp mod p, by square-and-multiply. */
export function modPow(base: bigint, exp: bigint, p: bigint): bigint {
  if (p === 1n) return 0n;
  let result = 1n;
  let b = mod(base, p);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % p;
    e >>= 1n;
    b = (b * b) % p;
  }
  return result;
}

/** Modular inverse of a mod p via the extended Euclidean algorithm.
 *  Throws if a is not invertible (gcd(a, p) ≠ 1) — e.g. a ≡ 0. */
export function modInv(a: bigint, p: bigint): bigint {
  let [oldR, r] = [mod(a, p), p];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  if (oldR !== 1n) {
    throw new Error(`${a} has no inverse mod ${p} (not coprime)`);
  }
  return mod(oldS, p);
}

/** Legendre symbol (a/p) for odd prime p: 0 if a≡0, 1 if QR, −1 if non-residue. */
export function legendre(a: bigint, p: bigint): -1 | 0 | 1 {
  const ls = modPow(a, (p - 1n) / 2n, p);
  if (ls === 0n) return 0;
  return ls === 1n ? 1 : -1;
}

/** True if a is a quadratic residue mod p (has a square root in 𝔽_p). */
export function isQuadraticResidue(a: bigint, p: bigint): boolean {
  return legendre(a, p) !== -1;
}

/** A modular square root of n mod odd prime p, or null if none exists.
 *  Returns the root in [0, p); the other root is p − r. Tonelli–Shanks. */
export function modSqrt(n: bigint, p: bigint): bigint | null {
  const a = mod(n, p);
  if (a === 0n) return 0n;
  if (p === 2n) return a;
  if (legendre(a, p) !== 1) return null;

  // Fast path: p ≡ 3 (mod 4) ⇒ root = a^((p+1)/4).
  if (p % 4n === 3n) {
    return modPow(a, (p + 1n) / 4n, p);
  }

  // General Tonelli–Shanks. Write p − 1 = q · 2^s with q odd.
  let q = p - 1n;
  let s = 0n;
  while (q % 2n === 0n) {
    q /= 2n;
    s += 1n;
  }

  // Find a quadratic non-residue z.
  let z = 2n;
  while (legendre(z, p) !== -1) z += 1n;

  let m = s;
  let c = modPow(z, q, p);
  let t = modPow(a, q, p);
  let r = modPow(a, (q + 1n) / 2n, p);

  while (t !== 1n) {
    // Find least i in (0, m) with t^(2^i) ≡ 1.
    let i = 0n;
    let t2 = t;
    while (t2 !== 1n) {
      t2 = (t2 * t2) % p;
      i += 1n;
      if (i === m) return null; // should not happen for a genuine residue
    }
    const b = modPow(c, modPow(2n, m - i - 1n, p - 1n), p);
    m = i;
    c = (b * b) % p;
    t = (t * c) % p;
    r = (r * b) % p;
  }
  return r;
}
