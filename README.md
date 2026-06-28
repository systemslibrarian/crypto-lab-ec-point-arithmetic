# crypto-lab-ec-point-arithmetic

## What It Is

This is an interactive visualizer for the two operations every elliptic-curve cryptosystem is built on: **elliptic-curve point addition** and **scalar multiplication**. It implements the short-Weierstrass group law (y² = x³ + ax + b) twice — once over the real numbers, where addition is the geometric chord-and-tangent construction you can drag with your mouse, and once over a finite field 𝔽ₚ, where the identical algebra runs in exact `BigInt` arithmetic (modular inverse via the extended Euclidean algorithm, modular square roots via Tonelli–Shanks). It is a teaching tool, not a cryptographic library: it builds the intuition that scalar multiplication k·P is cheap while inverting it — the **elliptic-curve discrete logarithm problem (ECDLP)** — is not. The finite-field results for the real curve **secp256k1** are cross-checked against `@noble/curves` in the test suite, so the arithmetic shown is the genuine article.

## When to Use It

- **Learning ECC before ECDSA or ECDH.** The group law is the prerequisite for both; see point addition and doubling geometrically first, and signatures/key-exchange become far easier to follow.
- **Understanding why scalar multiplication is one-way.** Step through double-and-add and watch the operation count stay near log₂k while the result scatters unpredictably — the asymmetry at the heart of ECC.
- **Connecting the picture to the algebra.** The λ, x₃, y₃ formulas update in lockstep with the geometry, so the equations stop being arbitrary.
- **Seeing that 𝔽ₚ is the same group.** The ℝ ↔ 𝔽ₚ toggle reuses the same interaction, making "the smooth curve and the lattice obey one law" concrete.
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

There are no environment variables. `npm test` runs the Vitest suite (field arithmetic, the real and finite-field group laws, double-and-add vs. naive equivalence, and the secp256k1 cross-check against `@noble/curves`); `npm run build` typechecks and produces the static `dist/`.

## Part of the Crypto-Lab Suite

> One of 60+ live browser demos at
> [systemslibrarian.github.io/crypto-lab](https://systemslibrarian.github.io/crypto-lab/)
> — spanning Atbash (600 BCE) through NIST FIPS 203/204/205 (2024).

---

_"Whether you eat or drink, or whatever you do, do all to the glory of God." — 1 Corinthians 10:31_
