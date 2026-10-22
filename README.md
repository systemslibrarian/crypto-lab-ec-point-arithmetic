# crypto-lab-ec-point-arithmetic

## What It Is

This is an interactive visualizer for **elliptic-curve point addition** and **scalar multiplication**. It shows short-Weierstrass addition (y² = x³ + ax + b) over the real numbers, where you can drag points along a smooth curve, and over a finite field 𝔽ₚ, where the same form of formulas runs in exact `BigInt` arithmetic (modular inverse via the extended Euclidean algorithm, modular square roots via Tonelli–Shanks). These are **different groups**: the lab's real and finite-field presets even use different curve coefficients. It is a teaching tool, not a cryptographic library. Point addition can be undone when a summand is known: from Q = P + R and P, compute R = Q − P. In a suitable large finite-field subgroup, computing Q = k·P is practical while recovering k from P and Q is the **elliptic-curve discrete logarithm problem (ECDLP)**. The secp256k1 finite-field results are cross-checked against `@noble/curves` in the test suite.

## When to Use It

- **Learning ECC before ECDSA or ECDH.** The group law is the prerequisite for both; see point addition and doubling geometrically first, and signatures/key-exchange become far easier to follow.
- **Understanding the scalar-recovery problem.** Step through double-and-add and watch the operation count stay near log₂k. The small teaching groups can be searched; security relies on the hardness of recovering k in an appropriately chosen large subgroup.
- **Connecting the picture to the algebra.** The λ, x₃, y₃ formulas update in lockstep with the geometry, so the equations stop being arbitrary.
- **Comparing real and finite-field groups.** The ℝ ↔ 𝔽ₚ toggle reuses the interaction and the form of the addition formulas; it does not turn the smooth real curve into the same group of finite points.
- **When NOT to use it:** this is not a key-agreement, signing, or discrete-log-attack tool. For ECDH and a real ECDLP brute-forcer use [Curve Lens](https://systemslibrarian.github.io/crypto-lab-curve-lens/); for signatures use ECDSA Forge. And never treat any of this as production code — it is a browser teaching demo, deliberately variable-time and un-hardened.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-ec-point-arithmetic](https://systemslibrarian.github.io/crypto-lab-ec-point-arithmetic/)**

Four panels. Panel 1 introduces the curve. Panel 2 is the core: drag P and Q along a real curve (or pick them from menus / use arrow keys) and watch the chord or tangent, the third intersection, the reflection, and the algebra all update live — then flip the **Over ℝ ↔ Over 𝔽ₚ** switch to run the same addition on a finite point lattice. Panel 3 computes k·P by both naive repeated addition and double-and-add, stepping through the trace and showing the operation-count gap. Panel 4 builds ECDLP intuition by walking a small subgroup until it lands on the target point, then contrasts that with secp256k1's ~2²⁵⁶ order. Controls include the curve presets (toy 𝔽₁₇, 𝔽₉₇, and secp256k1), the scalar k, the addition method, and the doubling / show-−P toggles.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-ec-point-arithmetic
cd crypto-lab-ec-point-arithmetic
npm install
npm run dev
```

There are no environment variables. `npm test` runs the Vitest suite (field arithmetic, the real and finite-field group laws, double-and-add vs. naive equivalence, and the secp256k1 cross-check against `@noble/curves`); `npm run build` typechecks and produces the static `dist/`. An optional `npm run smoke` drives a real browser over the built site (canvas rendering, the core interactions, mobile layout); it needs a local Chromium/Edge and `npm i -D playwright`, and is kept out of CI to stay light.

## Sources and Scope

- [SEC 1, version 2.0 (21 May 2009)](https://www.secg.org/sec1-v2.pdf), §§2.2.1 and 3.2.1, specifies finite-field elliptic-curve groups and public keys of the form Q = dG.
- Paar, Pelzl, and Güneysu, [_Understanding Cryptography_, second edition (2024)](https://link.springer.com/book/10.1007/978-3-662-69007-9), chapter 9, distinguishes the geometric intuition from the finite-field group and scalar-recovery problem.

The toy groups and the real-plane construction are for learning. The difficulty claim applies to suitable large subgroups and assumptions, not to point addition or every elliptic curve.

## Related Demos

- [crypto-lab-curve-lens](https://systemslibrarian.github.io/crypto-lab-curve-lens/) — the next step: finite-field point clouds, curve comparison, a real ECDLP brute-forcer, and live ECDH across P-256, Curve25519, and secp256k1.
- [crypto-lab-ecdsa-forge](https://systemslibrarian.github.io/crypto-lab-ecdsa-forge/) — what the group law is used for: ECDSA signing, verification, and nonce-reuse forgery.
- [crypto-lab-ed25519-forge](https://systemslibrarian.github.io/crypto-lab-ed25519-forge/) — EdDSA on the twisted-Edwards form of the same idea.

## Part of the Crypto-Lab Suite

> One of 170+ live browser demos at
> [systemslibrarian.github.io/crypto-lab](https://systemslibrarian.github.io/crypto-lab/)
> — spanning Atbash (600 BCE) through NIST FIPS 203/204/205 (2024).

---

_"Whether you eat or drink, or whatever you do, do all to the glory of God." — 1 Corinthians 10:31_
