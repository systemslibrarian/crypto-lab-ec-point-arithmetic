# BUILD (FILLED): crypto-lab-ec-point-arithmetic

## Proposal artifact — review before building. Differentiation from Curve Lens is the load-bearing decision.

---

## RECOMMENDED OUTPUTS (answers to the demo prompt's 6 asks)

**1. Final display title:** **Elliptic Curve Point Arithmetic**

- Catalog card title (short): **Point Arithmetic**
- `<title>`: `Elliptic Curve Point Arithmetic — crypto-lab`

**2. High-level architecture:** hand-rolled, separately-testable math modules (real-plane
geometry + exact 𝔽_p arithmetic), two Canvas renderers (continuous plane / finite grid),
thin UI panels. `@noble/curves` used ONLY as a known-answer oracle in tests (secp256k1),
never to compute what the demo claims to teach. Full layout in ARCHITECTURE below.

**3. Core interaction (the "aha"):** a draggable real-plane canvas. Grab P or Q; the chord
(or tangent when P=Q) redraws live, the third intersection −(P+Q) appears, it reflects to
the sum P+Q, and the algebraic formula (λ, x₃, y₃) updates in the same frame. One toggle
swaps ℝ → 𝔽_p, reusing the identical two-point interaction on the finite point set so
"same group law" lands without a second mental model.

**4. UI layout:** single-column flow of 4 panels (Intro → Point Addition → Scalar
Multiplication → Why Reversing Is Hard). Canvas left / formula+controls right per panel ≥640px;
stacks vertically below 640px. Full detail in UI below.

**5. Rendering / field-arithmetic tech:** Canvas 2D for both curve and grid (crisp dragging,
devicePixelRatio-aware). Real-plane math in `number`; 𝔽_p math in `BigInt` with hand-rolled
modular inverse (egcd) and square root (Tonelli–Shanks). secp256k1 available in 𝔽_p mode for
realism; validated against `@noble/curves` in tests.

**6. Pedagogical notes:** lead with geometry over ℝ (intuition), reveal algebra alongside it,
THEN show the finite field (realism). Toy curve is the default everywhere; secp256k1 is an
opt-in "this is the real thing" reveal, not the teaching surface. Formulas are shown beside
the geometry, never instead of it. ECDLP is taught as intuition ("the walk scatters"), NOT
re-implemented as a brute-forcer — that's Curve Lens's job.

---

## REPO block

- **Repo name:** `crypto-lab-ec-point-arithmetic`
- **About / one-liner:** `Interactive elliptic-curve point addition and scalar multiplication — the geometric group law over ℝ and the identical algebra over 𝔽_p. Hand-rolled, inspectable arithmetic, no backend.`
- **Catalog category label:** `FOUNDATIONS` (cross-tags: `KEY EXCHANGE | SIGNATURES`)
  - ⚠️ OPEN: the catalog has no `FOUNDATIONS` category today. Alternatives: use `KEY EXCHANGE`
    (groups it beside Curve Lens) or add a new `FOUNDATIONS` bucket. Your call.
- **Catalog card title:** `Point Arithmetic`
- **Tags (3–4):** `Group Law · Chord-and-Tangent · Scalar Mult · 𝔽_p`
- **Accent (`--accent`):** `#9f88ff` (purple) — distinct from Curve Lens's teal `#35d6bb` so the
  two sit apart on the index; stays inside the suite's 4-color palette
  (`#35d6bb`/`#9f88ff`/`#ff6b7f`/`#ffb84d`). OPEN if you'd rather it match teal.
- **Favicon emoji:** `➕` (point addition) — alt: `〰️` (the curve).

---

## SCOPE

**IN scope**

- Point addition over ℝ as the chord-and-tangent construction: line through P,Q → third
  intersection → reflect across x-axis → P+Q. Live while dragging.
- Doubling (P=Q) via the tangent line.
- The full group law made visible: identity O (point at infinity), inverses (−P is the
  reflection), P+(−P)=O shown as the vertical chord escaping to infinity, associativity noted.
- Algebraic formulas shown side-by-side and updating in lockstep with the geometry
  (slope λ for add vs. double, x₃ = λ²−x₁−x₂, y₃ = λ(x₁−x₃)−y₁).
- A single ℝ ↔ 𝔽_p toggle that reuses the same interaction on a small finite curve, so students
  see the algebra is identical and the picture just becomes a lattice of points.
- Scalar multiplication k·P two ways: naive repeated addition (geometric, step-through) and
  double-and-add (the efficient method), with a step trace.
- ECDLP intuition (light): given P and Q=k·P, show that the additive walk scatters
  unpredictably and brute force/baby-step-giant-step blow up — explained and lightly
  illustrated, contrasting toy order vs. secp256k1's ~2²⁵⁶.
- secp256k1 selectable in 𝔽_p mode as the "real curve" reveal.

**NON-GOALS** (one-line "what this isn't" note in UI, each pointing to the right demo)

- ECDH / key agreement → that's **Curve Lens**.
- A full ECDLP brute-force _solver_ UI → also **Curve Lens** (this demo only builds the intuition).
- Signatures → **ECDSA Forge**.
- Production/constant-time guarantees → this is a teaching visualizer, not a library.

---

## SECURITY / CORRECTNESS INVARIANTS (load-bearing; baked into architecture)

1. The teaching subject — point add, double, negate, scalar-mult — is **hand-rolled and
   inspectable** in small modules. No library computes what the demo claims to teach.
2. 𝔽_p arithmetic is **exact** (BigInt). Modular inverse via egcd, modular sqrt via
   Tonelli–Shanks. No floating point anywhere in the finite-field path.
3. Real-plane math uses `number` and is for **illustration only**; it is never presented as the
   cryptographic computation. The UI labels which world it's in at all times.
4. Every point used in arithmetic is **provably on the curve**; the API cannot construct an
   off-curve point in the correct path (constructor validates y² = x³+ax+b; identity is its own
   type/sentinel, not a magic coordinate).
5. Singular curves (4a³+27b² ≡ 0) are **rejected** — they aren't groups; the demo refuses to
   teach a lie.
6. secp256k1 results are cross-checked against `@noble/curves` in tests; a failing vector fails
   the build, so the "real curve" claim is test-backed.
7. No backend, no network, no persistence, no telemetry. Everything runs in the browser.

---

## ARCHITECTURE

```
src/
  math/
    types.ts          — RealPoint | FpPoint | Identity(O) sentinel; branded on-curve types
    field.ts          — BigInt mod, modInv (egcd), modSqrt (Tonelli–Shanks), helpers
    curve-real.ts     — add/double/negate over ℝ + geometry helpers that RETURN the
                        construction (slope, third point, reflection) for the renderer
    curve-fp.ts       — exact add/double/negate over 𝔽_p; scalarMul (naive + double-and-add)
                        returning a step trace
    curves.ts         — presets: toy real curve(s), small 𝔽_p curve(s), secp256k1 params
  render/
    plane.ts          — Canvas renderer: axes, smooth curve, P/Q, chord/tangent, third point,
                        reflection, O-at-infinity affordance; devicePixelRatio-aware
    field-grid.ts     — Canvas renderer: finite point lattice, same construction overlaid
  ui/
    panel-intro.ts
    panel-add.ts      — the draggable core interaction
    panel-scalar.ts   — k·P step-through (naive + double-and-add)
    panel-hard.ts     — ECDLP intuition
    controls.ts       — curve picker, ℝ/𝔽_p toggle, formula readout
  main.ts             — mounts at #app, wires panels
index.html            — content at id="app"; :root defines --accent: #9f88ff; NO header/footer
tests/ (or *.test.ts next to source, matching curve-lens convention)
```

---

## UI

- **Panel 1 — Introduction.** The Weierstrass equation, one smooth curve over ℝ, a sentence on
  "real crypto runs this over a finite field" with a forward pointer to Panel 2's toggle.
- **Panel 2 — Point Addition (core).** Canvas with draggable P and Q. Live chord → third
  intersection → reflection → P+Q. Toggle "Double (P=Q)" shows the tangent. Right rail shows λ,
  x₃, y₃ updating in lockstep. The ℝ ↔ 𝔽_p switch lives here; in 𝔽_p the same click-two-points
  flow runs on the lattice. Buttons: randomize points, reset, "show −P", "show P+(−P)=O".
- **Panel 3 — Scalar Multiplication.** Pick P and k. Two sub-modes: _Repeated addition_ (draws
  P, 2P, 3P… each as a construction) and _Double-and-add_ (the efficient trace). Step / play /
  reset. Shows the operation count contrast (k−1 adds vs ~log₂k).
- **Panel 4 — Why Reversing Is Hard.** Given P and Q=k·P on the toy curve, reveal the walk and
  how nP scatters; state baby-step-giant-step ≈ √n and contrast toy order with secp256k1 ~2²⁵⁶.
  Explicitly labeled "intuition, not a solver — see Curve Lens to actually brute-force one."
- Each non-goal gets a one-line "what this isn't / see X" note. Below 640px every panel stacks
  canvas-over-controls.

---

## VISUAL SEMANTICS

Not an attack demo — color tracks **role in the construction**, not success/failure:

- Input points P, Q → `--accent`.
- Construction line (chord/tangent) → neutral.
- Third intersection −(P+Q) → muted / dashed (a way-station, not the answer).
- The result P+Q → highlighted (the payoff).
  The one inversion to get right: **P+(−P)=O must not read as an error.** The vertical chord
  "running off the top" plus a clear "= O (point at infinity)" badge is the correct, intended
  state — present it as a feature of the group, not a failure. Identity, role, and on/off-curve
  status are always conveyed by icon + text + color together (WCAG 1.4.1); verify in grayscale and
  deuteranopia.

---

## EDGE CASES (each: defined behavior + teaching tooltip)

- **P + (−P):** vertical chord → result O; badge explains the point at infinity.
- **P = Q (doubling):** tangent line; tooltip on why the slope uses the derivative.
- **Doubling a 2-torsion point (y=0):** tangent is vertical → 2P = O.
- **Adding O:** O is the identity; P + O = P, shown without geometry.
- **Dragging off the curve (ℝ):** drag is constrained to the curve (x drives, y solved), so an
  off-curve point can't enter arithmetic; tooltip explains why.
- **𝔽_p, x with no square root (non-residue):** that x has no points; excluded from the lattice.
- **Singular curve (4a³+27b²=0):** rejected with a tooltip — not a group.
- **k = 0 → O; k ≥ subgroup order → wraps** (and is noted).

---

## TESTING (Vitest, run before done)

- `field`: modInv round-trips (a·a⁻¹≡1), modSqrt² ≡ input for residues, non-residue detected.
- `curve-real`: known small sums; commutativity P+Q=Q+P; P+(−P)=O; P+O=P; doubling matches the
  tangent formula (within float tolerance).
- `curve-fp`: exact KATs; commutativity, associativity, identity, inverse laws; doubling 2-torsion
  → O; double-and-add ≡ naive repeated addition for many k.
- `curve-fp` real-curve: secp256k1 small multiples (G,2G,…) cross-checked against `@noble/curves`;
  base-point order spot-check. A mismatch fails the build.
- `ui`: one jsdom smoke test that the add panel mounts and updates the formula readout on input.
- Report the count + coverage when done.

---

## ACCESSIBILITY / MOBILE

- Drag has a keyboard equivalent (focus a point, arrow keys to move along the curve; Enter to
  pick in 𝔽_p). Visible focus rings on all controls.
- State by icon + text + color, never color alone.
- Long numeric coordinates (secp256k1) in a horizontally-scrollable monospace box with a copy
  button, not wrapped.
- Real `<input>`/`<label>` controls. Layout stacks cleanly below 640px.

---

## EXTENSION SEAMS (mark, don't build)

- Projective/Jacobian coordinate view (why production avoids inversions) — keep `curve-fp` point
  type behind a small interface so an alternate representation is additive. `// [extension] point`
- Montgomery ladder as a third scalar-mult mode — `panel-scalar` sub-mode registry. `// [extension] point`
- Additional named curves (P-256, etc.) — `curves.ts` is a registry keyed by name. `// [extension] point`

---

## DEFINITION OF DONE

- `npm run dev` serves the working demo.
- The drag-the-points core interaction produces the intended "aha"; ℝ↔𝔽_p toggle works.
- Tests pass (state count + coverage).
- Content mounts at `id="app"`; `:root` defines `--accent: #9f88ff`.
- NO header, theme toggle, README, or scripture footer here — Parts 0 + A–E apply those next.

`✓ crypto-lab-ec-point-arithmetic — demo logic + UI + tests complete, ready for Parts 0 + A–E`
