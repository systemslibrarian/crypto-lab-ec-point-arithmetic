# What Would Make This Demo a 10/10

## Current Read

I would score the current demo around **8.3/10**.

The core is already strong: the app has the intended four-panel learning arc, exact finite-field arithmetic, a real draggable chord-and-tangent interaction, scalar-multiplication traces, and an ECDLP intuition panel. The verification baseline is also good: `npm test` passes **27/27 tests**, and `npm run build` completes successfully.

The gap to 10/10 is not mostly arithmetic. It is the last layer of teaching clarity, visual polish, browser-level verification, and edge-case discoverability.

## Highest-Leverage Upgrades

### 01. Fix the scalar panel's first impression

Evidence:

- `src/ui/panel-scalar.ts:76` starts the trace at `cursor = steps.length ? 1 : 0`.
- `src/math/curve-fp.ts:96` uses MSB-first double-and-add, where the first operation doubles the identity accumulator.
- In the live page, the initial scalar panel shows `1 doublings`, `0 additions`, and `9 · G = O (infinity)` before the user has stepped through the computation.

Why it matters:

That is mathematically explainable as an intermediate accumulator, but it reads like the demo is saying the final value of `9 * G` is `O`. For a teaching demo, the first glance needs to be impossible to misunderstand.

Make it 10/10:

- Start the scalar trace at cursor `0` and show a neutral ready state: `Ready to compute 9 * G`.
- Rename the live result card from `9 · G = ...` to `current accumulator = ...` until the trace is complete.
- Add a separate final-result card that appears only after `Show all` or when the last step is reached.
- Add a bit tape for `k` so each step visibly consumes one binary digit.
- Show the naive count and double-and-add count side by side for the same `k`, even when only one trace is being animated.

### 02. Make the finite-field chord/tangent visually real

Evidence:

- `src/render/field-grid.ts:77` draws the grid, all curve points, and point highlights.
- `src/ui/panel-add.ts:190` passes only `P`, `Q`, `sum`, and `thirdIntersection` into the grid renderer.
- The renderer comment promises collinear/wrapped-line visualization, but the current grid does not show the modular line itself.

Why it matters:

The central claim is "same group law, different world." The real-number panel makes the chord/tangent obvious; the finite-field panel currently asks the learner to believe the line is there from the formula/readout.

Make it 10/10:

- Compute the modular chord/tangent set for the selected `P` and `Q`.
- Highlight all curve points on that residue-class line.
- Label the way-station as `-(P+Q)` and the reflected result as `P+Q` directly on or beside the lattice.
- For vertical cases, draw a distinct modular vertical line and explain why the result is `O`.
- Keep the exact formula readout, but let the grid carry the same story visually.

### 03. Restore the secp256k1 "real curve" reveal in point-add mode

Evidence:

- `src/ui/panel-add.ts:16` filters finite-field presets down to plottable curves only.
- `src/math/curves.ts:69` marks secp256k1 as `plottable: false`.
- `src/ui/panel-scalar.ts:136` handles non-plottable curves by hiding the lattice while still allowing computation.
- The build brief says secp256k1 should be selectable in finite-field mode as the real-curve reveal.

Why it matters:

The demo promises to bridge toy curves to the genuine cryptographic curve. Scalar multiplication gets that reveal, but point addition, the core interaction, does not.

Make it 10/10:

- Add a non-plotted secp256k1 point-add mode: no lattice, just exact BigInt coordinates and formula readouts.
- Provide preset points such as `G`, `2G`, `3G`, `-G`, and `O`, with a copy button for long coordinates.
- Make the UI explicit: `secp256k1 is too large to draw as a lattice, but the same formulas are running here exactly.`
- Alternatively, adjust the UI/README copy so it no longer implies secp256k1 is available in the point-add toggle.

### 04. Turn scalar multiplication into a comparison, not just a mode switch

Evidence:

- `src/ui/panel-scalar.ts:43` gives step/play controls for one active method.
- `src/ui/panel-scalar.ts:74` chooses either naive or double-and-add for the trace.
- `src/ui/panel-scalar.ts:129` renders counts for only the currently selected method.

Why it matters:

The pedagogical point is the operation-count gap. A mode switch hides the comparison at the exact moment the learner should be seeing it.

Make it 10/10:

- Always show both counts for the selected `k`: naive `k` additions vs. double-and-add `~2 * bitLength(k)` operations.
- Animate one method at a time, but keep the other method's cost visible.
- Add a small asymptotic scale: `k = 9`, `k = 1,000`, `k = 2^128`, `k = secp256k1 order`.
- When naive is capped, present that as the lesson: `This is why we do not compute scalar multiplication by repeated addition.`

### 05. Surface every important edge case as a one-click teaching moment

Evidence:

- The build brief calls out edge cases under `BUILD-FILLED-ec-point-arithmetic.md:170`.
- The current UI covers `P + (-P) = O` well, but several edge cases are either hidden or only implicit.

Make it 10/10:

- Add an `Examples` or `Edge cases` control group in Panel 2:
  - `P + O = P`
  - `P + (-P) = O`
  - `2P = O when y = 0`
  - `P = Q tangent/doubling`
- Add scalar examples in Panel 3:
  - `k = 0 -> O`
  - `k = order -> O`
  - `k = order + 1 -> G`
- Add short explanatory badges for each state so the edge case feels like a feature of the group, not a failure.

### 06. Add a guided "aha path"

Why it matters:

The demo is accurate, but a 10/10 teaching demo actively choreographs the learner's first minute. Right now the user has to infer the best path through the controls.

Make it 10/10:

- Add a compact guided sequence at the top or inside Panel 2:
  1. Drag `P` and watch the chord move.
  2. Turn on doubling and see the tangent.
  3. Show `-P` and then `P + (-P) = O`.
  4. Switch to `F_p` and choose two lattice points.
  5. Step through `k * G` and compare operation counts.
- Do this without a marketing-style hero or tutorial wall. Think small checklist/chips, not a modal tour.
- Let users restart the guided path without resetting the whole app.

### 07. Strengthen accessibility beyond the current baseline

Evidence:

- `src/ui/panel-add.ts:51` and `src/ui/panel-add.ts:57` use live status readouts, which is good.
- `src/ui/panel-add.ts:220` implements the world switch as a `tablist`, but it does not implement full tab keyboard behavior.
- `src/ui/panel-add.ts:310` provides finite-field select menus as a keyboard path, which is good.
- `styles/main.css:290` wraps long coordinates with `word-break`, while the build brief asks for horizontally scrollable monospace boxes and copy affordances for huge coordinates.

Make it 10/10:

- Either implement real tablist keyboard semantics or change the world switch to plain segmented buttons.
- Add browser tests for keyboard-only use: focus canvas, move points, switch modes, select finite-field points, step scalar multiplication.
- Add non-visual summaries for canvas-only states: current construction, selected points, result, and edge-case explanation.
- For secp256k1-sized coordinates, use scrollable monospace blocks plus copy buttons instead of hard line breaking.
- Verify contrast and color independence in both themes; keep point roles labeled by text/shape, not color alone.

### 08. Add browser-level visual and interaction tests

Evidence:

- `src/ui/ui.test.ts:5` is a jsdom smoke test that confirms the app mounts.
- The renderers intentionally no-op when `canvas.getContext('2d')` is unavailable.
- Unit tests strongly cover math, but they do not prove the visual teaching surface works in a real browser.

Make it 10/10:

- Add Playwright tests for:
  - app loads with all four panels visible;
  - real canvas is nonblank;
  - finite lattice is nonblank;
  - mode switch updates the readout;
  - scalar `Show all` reaches the same result as the math function;
  - mobile viewport has no obvious overflow or overlapping controls;
  - theme toggle preserves contrast and canvas visibility.
- Add a simple canvas-pixel nonblank check so regressions cannot ship a blank graph.
- Capture desktop and mobile screenshots as review artifacts.

### 09. Upgrade the visual language while preserving the Crypto-Lab shell

Evidence:

- `styles/main.css:52` uses a system sans stack.
- The UI is clean and readable, but the in-demo surface is mostly cards, controls, and canvases.

Make it 10/10:

- Give the math surfaces a stronger identity: labeled construction phases, equation strips, and more intentional point labels.
- Use a distinctive but readable type pairing for the demo body and formulas, while keeping the shared header untouched.
- Replace emoji-led buttons where useful with consistent icon/text treatments.
- Add meaningful motion: when `P + Q` changes, briefly animate the third intersection reflecting into the final sum.
- On mobile, consider sticky compact controls for the active panel so the canvas and formula do not feel disconnected.

### 10. Add shareable state and example presets

Why it matters:

Teaching demos become much more useful when a teacher or README can link directly to an exact state.

Make it 10/10:

- Encode selected panel, mode, curve, `P`, `Q`, method, and `k` in URL query/hash state.
- Add example links such as:
  - `#add-real-doubling`
  - `#add-fp-vertical`
  - `#scalar-secp256k1`
  - `#ecdlp-toy-walk`
- Keep the defaults simple; make deep links optional.

## Quick Win Order

1. Fix the scalar panel labeling/initial state.
2. Show both naive and double-and-add counts at the same time.
3. Add one-click edge-case examples.
4. Add labels/legend to the finite-field lattice.
5. Add Playwright smoke tests for rendered canvases and mobile layout.
6. Add secp256k1 numeric point-add mode or tighten the copy around where secp256k1 appears.
7. Add guided checklist chips for the intended learning path.
8. Improve long-coordinate handling with scroll/copy affordances.

## 10/10 Acceptance Bar

The demo is a 10/10 when all of these are true:

- A first-time learner can explain chord, tangent, reflection, `O`, and `k * P` after one guided pass.
- Every edge case in the build brief is reachable from the UI in one click or one obvious control path.
- The finite-field mode visually demonstrates the same group law, not just the same formula.
- Scalar multiplication clearly contrasts repeated addition with double-and-add on the same screen.
- secp256k1 is either honestly available as an exact numeric reveal or not implied by the point-add UI copy.
- Keyboard-only users can complete the core learning path.
- Browser-level tests prove the canvases render, controls work, and mobile layout does not break.
- `npm test` and `npm run build` remain clean.

## Bottom Line

The current demo is already a credible, technically solid ECC teaching tool. To become a 10/10, it needs to make the invisible parts unmistakably visible: the scalar trace should never look wrong at first glance, the finite-field chord should be drawn as a real teaching object, the operation-count gap should be side-by-side, and the edge cases should be celebrated instead of hidden.
