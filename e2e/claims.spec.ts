import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Functional gate: every headline verdict, counter and edge-case path this lab
 * advertises, asserted against the *rendered* page.
 *
 * The rule throughout is "check the page against itself": read the numbers the
 * page computed (λ, x₃, y₃, the operation counts, the point menus) and assert
 * they are mutually consistent and satisfy the curve equation, rather than
 * pinning hardcoded strings. A wrong group law then fails here even though every
 * label still looks plausible.
 *
 * The a11y spec (e2e/a11y.spec.ts) stays the accessibility gate; nothing here
 * weakens it.
 */

// ── shared maths (an independent oracle, deliberately not imported from src) ──

const SECP_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
/** The published secp256k1 generator, decimal — the README calls this "the real
 *  Bitcoin/Ethereum curve", so the page had better be showing the real G. */
const SECP_GX = '55066263022277343669578718895168534326250603453777594175500187360389116729240';
const SECP_GY = '32670510020758816978083085130507043184471273380659243275938904335757337482424';

const mod = (x: bigint, p: bigint) => ((x % p) + p) % p;
const onCurveFp = (x: bigint, y: bigint, a: bigint, b: bigint, p: bigint) =>
  mod(y * y, p) === mod(x * x * x + a * x + b, p);
const bitLen = (k: bigint) => (k <= 0n ? 0 : k.toString(2).length);
const popcount = (k: bigint) => (k <= 0n ? 0 : (k.toString(2).match(/1/g) ?? []).length);

/** Real curves offered by the ℝ menu, in menu order. */
const REAL_CURVES = [
  { label: 'y² = x³ − x + 1', a: -1, b: 1 },
  { label: 'y² = x³ − 2x + 2', a: -2, b: 2 },
];
/** Finite-field curves offered by the 𝔽ₚ menu, in menu order. */
const FP_CURVES = [
  { label: 'y² = x³ + 2x + 2 mod 17', a: 2n, b: 2n, p: 17n, points: 19 },
  { label: 'y² = x³ + 3x + 7 mod 97', a: 3n, b: 7n, p: 97n, points: 99 },
  { label: 'secp256k1 (y² = x³ + 7)', a: 0n, b: 7n, p: SECP_P, points: 0 },
];

// ── readout parsing ──────────────────────────────────────────────────────────

/** The `term → value` rows of a readout, keyed by the term (P, Q, λ …, x₃, y₃). */
async function dlRows(scope: Locator): Promise<Record<string, string>> {
  const dls = scope.locator('.dl');
  const n = await dls.count();
  const out: Record<string, string> = {};
  for (let i = 0; i < n; i += 1) {
    const term = (await dls.nth(i).locator('.dt').innerText()).trim();
    out[term] = (await dls.nth(i).locator('.dd').innerText()).trim();
  }
  return out;
}

/** The right-hand side of a "formula = value" row. */
const rhsOf = (s: string) => s.slice(s.lastIndexOf('=') + 1).trim();
const lambdaKey = (rows: Record<string, string>) =>
  Object.keys(rows).find((k) => k.startsWith('λ'));

function realPoint(s: string): { x: number; y: number } {
  const m = /\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(s);
  expect(m, `no point in ${JSON.stringify(s)}`).not.toBeNull();
  return { x: Number(m![1]), y: Number(m![2]) };
}
function fpPoint(s: string): { x: bigint; y: bigint } {
  const m = /\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(s);
  expect(m, `no point in ${JSON.stringify(s)}`).not.toBeNull();
  return { x: BigInt(m![1]), y: BigInt(m![2]) };
}

const realReadout = (page: Page) => page.locator('#cl-panel-real .readout');
const fpReadout = (page: Page) => page.locator('#cl-panel-fp .readout');
const resultMain = (scope: Locator) => scope.locator('.result .res-main');

/** Wait for the first paint of a readout (the panels draw in a rAF callback). */
async function ready(page: Page): Promise<void> {
  await expect(resultMain(realReadout(page))).toBeVisible();
}

/**
 * The whole ℝ chord/tangent verdict, checked against itself: λ from the two
 * input points, x₃ and y₃ from λ, the "P + Q = …" headline from x₃/y₃, and the
 * resulting point back on the curve.
 */
async function assertRealAlgebraConsistent(page: Page, a: number, b: number): Promise<void> {
  const rows = await dlRows(realReadout(page));
  const P = realPoint(rows.P);
  const lk = lambdaKey(rows);
  expect(lk, 'a λ row must be shown for a chord/tangent sum').toBeTruthy();
  const lambda = Number(rhsOf(rows[lk!]));
  const x3text = rhsOf(rows['x₃']);
  const y3text = rhsOf(rows['y₃']);
  const x3 = Number(x3text);
  const y3 = Number(y3text);

  if (lk === 'λ (tangent)') {
    // Doubling: the tangent slope, and no separate Q row (P is both operands).
    expect(rows.Q).toBeUndefined();
    expect(lambda).toBeCloseTo((3 * P.x * P.x + a) / (2 * P.y), 2);
    expect(x3).toBeCloseTo(lambda * lambda - 2 * P.x, 2);
  } else {
    const Q = realPoint(rows.Q);
    expect(lambda).toBeCloseTo((Q.y - P.y) / (Q.x - P.x), 2);
    expect(x3).toBeCloseTo(lambda * lambda - P.x - Q.x, 2);
  }
  expect(y3).toBeCloseTo(lambda * (P.x - x3) - P.y, 2);

  // The headline verdict must be exactly the x₃/y₃ the page just derived.
  await expect(resultMain(realReadout(page))).toHaveText(`P + Q = (${x3text}, ${y3text})`);
  // …and that point must actually lie on the curve the page is drawing.
  expect(y3 * y3).toBeCloseTo(x3 * x3 * x3 + a * x3 + b, 1);
}

// ── Page skeleton / README promises ──────────────────────────────────────────

test.describe('page skeleton', () => {
  test('four panels in curriculum order, each with its own exhibit', async ({ page }) => {
    await page.goto('.');
    await ready(page);
    await expect(page.locator('main .panel h2')).toHaveText([
      '1 · What an elliptic curve is',
      '2 · Point addition: the chord-and-tangent rule',
      '3 · Scalar multiplication: k · P',
      '4 · Why you can’t go backwards (ECDLP)',
    ]);
    // The README promises exactly these curve menus.
    await expect(page.locator('#cl-panel-real select option')).toHaveText(
      REAL_CURVES.map((c) => c.label),
    );
    await expect(
      page.locator('#cl-panel-fp select[aria-label="Finite-field curve"] option'),
    ).toHaveText(FP_CURVES.map((c) => c.label));
  });
});

// ── Panel 2 · ℝ ──────────────────────────────────────────────────────────────

test.describe('panel 2 — point addition over ℝ', () => {
  test('the opening chord: λ, x₃, y₃ and the P + Q verdict agree, and the sum is on the curve', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    const rows = await dlRows(realReadout(page));
    // Both operands must themselves satisfy y² = x³ − x + 1.
    for (const s of [rows.P, rows.Q]) {
      const pt = realPoint(s);
      expect(pt.y * pt.y).toBeCloseTo(pt.x * pt.x * pt.x - pt.x + 1, 2);
    }
    await assertRealAlgebraConsistent(page, REAL_CURVES[0].a, REAL_CURVES[0].b);
  });

  test('tangent example: P = Q switches to the tangent slope and stays consistent', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    await page.locator('#cl-panel-real .chip-btn', { hasText: 'Tangent (P = Q)' }).click();
    const rows = await dlRows(realReadout(page));
    expect(Object.keys(rows)).toContain('λ (tangent)');
    await assertRealAlgebraConsistent(page, REAL_CURVES[0].a, REAL_CURVES[0].b);
    // The doubling checkbox is the same state, so it must now read as checked.
    await expect(page.locator('#cl-panel-real .check input').first()).toBeChecked();
  });

  test('P + (−P) = O reaches the identity and says why (chip and button agree)', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    for (const control of [
      page.locator('#cl-panel-real .chip-btn', { hasText: 'P + (−P) = O' }),
      page.locator('#cl-panel-real button', { hasText: 'Show P + (−P) = O' }),
    ]) {
      await page.locator('#cl-panel-real button', { hasText: 'Reset' }).click();
      await control.click();
      const rows = await dlRows(realReadout(page));
      const P = realPoint(rows.P);
      const Q = realPoint(rows.Q);
      // Q really is the reflection of P — that is *why* the line is vertical.
      expect(Q.x).toBeCloseTo(P.x, 3);
      expect(Q.y).toBeCloseTo(-P.y, 3);
      // No λ / x₃ / y₃: there is no third affine point to reflect.
      expect(lambdaKey(rows)).toBeUndefined();
      expect(rows['x₃']).toBeUndefined();
      await expect(resultMain(realReadout(page))).toHaveText('P + Q = O');
      await expect(realReadout(page).locator('.res-note')).toContainText(
        'the line is vertical and meets the curve at no third affine point',
      );
    }
  });

  test('2P = O: doubling a y = 0 point is the 2-torsion case, not a tangent', async ({ page }) => {
    await page.goto('.');
    await ready(page);
    await page.locator('#cl-panel-real .chip-btn', { hasText: '2P = O (y = 0)' }).click();
    const rows = await dlRows(realReadout(page));
    const P = realPoint(rows.P);
    expect(P.y).toBeCloseTo(0, 3);
    // y = 0 means x is a genuine root of the cubic — the page did not just park
    // the point on the axis.
    expect(P.x * P.x * P.x + REAL_CURVES[0].a * P.x + REAL_CURVES[0].b).toBeCloseTo(0, 2);
    expect(lambdaKey(rows)).toBeUndefined();
    await expect(resultMain(realReadout(page))).toHaveText('P + Q = O');
    await expect(realReadout(page).locator('.res-note')).toContainText('point at infinity O');
  });

  test('keyboard drag moves P, flips its branch, and the algebra follows', async ({ page }) => {
    await page.goto('.');
    await ready(page);
    const before = await dlRows(realReadout(page));
    const P0 = realPoint(before.P);
    const Q0 = realPoint(before.Q);

    await page.locator('#cl-panel-real canvas').focus();
    await page.keyboard.press('ArrowRight');
    let rows = await dlRows(realReadout(page));
    expect(realPoint(rows.P).x).toBeGreaterThan(P0.x);
    expect(realPoint(rows.Q).x).toBeCloseTo(Q0.x, 3); // unshifted arrows move P only
    await assertRealAlgebraConsistent(page, REAL_CURVES[0].a, REAL_CURVES[0].b);

    const upper = realPoint((await dlRows(realReadout(page))).P);
    await page.keyboard.press('ArrowUp');
    rows = await dlRows(realReadout(page));
    const flipped = realPoint(rows.P);
    expect(flipped.x).toBeCloseTo(upper.x, 3);
    expect(flipped.y).toBeCloseTo(-upper.y, 3); // same x, other branch
    await assertRealAlgebraConsistent(page, REAL_CURVES[0].a, REAL_CURVES[0].b);

    await page.keyboard.press('Shift+ArrowRight');
    rows = await dlRows(realReadout(page));
    expect(realPoint(rows.Q).x).toBeGreaterThan(Q0.x); // Shift moves Q
    expect(realPoint(rows.P).x).toBeCloseTo(flipped.x, 3);
    await assertRealAlgebraConsistent(page, REAL_CURVES[0].a, REAL_CURVES[0].b);
  });

  test('Randomize keeps both operands on the curve; Reset restores the opening points', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    const opening = await dlRows(realReadout(page));

    let moved = false;
    for (let i = 0; i < 5; i += 1) {
      await page.locator('#cl-panel-real button', { hasText: 'Randomize' }).click();
      const rows = await dlRows(realReadout(page));
      for (const s of [rows.P, rows.Q]) {
        const pt = realPoint(s);
        expect(pt.y * pt.y).toBeCloseTo(pt.x * pt.x * pt.x - pt.x + 1, 1);
      }
      if (rows.P !== opening.P) moved = true;
    }
    expect(moved, 'Randomize must actually move the points').toBe(true);

    await page.locator('#cl-panel-real button', { hasText: 'Reset' }).click();
    const rows = await dlRows(realReadout(page));
    expect(rows.P).toBe(opening.P);
    expect(rows.Q).toBe(opening.Q);
  });

  test('the second preset really is a different curve, and its sum lands on it', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    await page.locator('#cl-panel-real select').selectOption({ index: 1 });
    await expect(resultMain(realReadout(page))).toBeVisible();
    await assertRealAlgebraConsistent(page, REAL_CURVES[1].a, REAL_CURVES[1].b);
    const rows = await dlRows(realReadout(page));
    const P = realPoint(rows.P);
    // On curve 2 (y² = x³ − 2x + 2) but *not* on curve 1 — the menu switched worlds.
    expect(P.y * P.y).toBeCloseTo(P.x * P.x * P.x - 2 * P.x + 2, 2);
  });

  test('the “show −P” toggle changes what is drawn', async ({ page }) => {
    await page.goto('.');
    await ready(page);
    const canvas = page.locator('#cl-panel-real canvas');
    const snap = () => canvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    const before = await snap();
    await page.locator('#cl-panel-real .check input').nth(1).check();
    expect(await snap()).not.toBe(before);
  });
});

// ── Panel 2 · 𝔽ₚ ─────────────────────────────────────────────────────────────

async function openFp(page: Page): Promise<void> {
  await page.goto('.');
  await ready(page);
  await page.locator('#cl-tab-fp').click();
  await expect(page.locator('#cl-tab-fp')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#cl-panel-fp')).toBeVisible();
  await expect(page.locator('#cl-panel-real')).toBeHidden();
}

const fpSel = (page: Page, which: 'P' | 'Q') =>
  page.locator(`#cl-panel-fp select[aria-label="Point ${which}"]`);

test.describe('panel 2 — the same group law over 𝔽ₚ', () => {
  test('opens on a prompt, and the point menu holds exactly the curve’s points', async ({
    page,
  }) => {
    await openFp(page);
    await expect(fpReadout(page)).toContainText('Pick points P and Q on the lattice.');
    await expect(fpSel(page, 'P').locator('option')).toHaveCount(FP_CURVES[0].points);
    // Every listed point is O or a genuine solution of y² = x³ + 2x + 2 mod 17.
    const labels = await fpSel(page, 'P').locator('option').allTextContents();
    expect(labels[0]).toBe('O (∞)');
    const { a, b, p } = FP_CURVES[0];
    for (const label of labels.slice(1)) {
      const pt = fpPoint(label);
      expect(onCurveFp(pt.x, pt.y, a, b, p), `${label} off curve`).toBe(true);
    }
  });

  test('chord over 𝔽ₚ: λ, x₃, y₃ are exact mod p and the sum is on the curve', async ({ page }) => {
    await openFp(page);
    await fpSel(page, 'Q').selectOption({ label: '(6, 3)' });
    const rows = await dlRows(fpReadout(page));
    const P = fpPoint(rows.P);
    const Q = fpPoint(rows.Q);
    const { a, b, p } = FP_CURVES[0];
    const lambda = BigInt(rhsOf(rows['λ (chord)']));
    const x3 = BigInt(rhsOf(rows['x₃']));
    const y3 = BigInt(rhsOf(rows['y₃']));

    expect(mod(lambda * (Q.x - P.x), p)).toBe(mod(Q.y - P.y, p)); // λ·Δx ≡ Δy
    expect(x3).toBe(mod(lambda * lambda - P.x - Q.x, p));
    expect(y3).toBe(mod(lambda * (P.x - x3) - P.y, p));
    expect(onCurveFp(x3, y3, a, b, p)).toBe(true);
    await expect(resultMain(fpReadout(page))).toHaveText(`P + Q = (${x3}, ${y3})`);
  });

  test('doubling over 𝔽ₚ uses the tangent formula, exactly', async ({ page }) => {
    await openFp(page);
    await page.locator('#cl-panel-fp .chip-btn', { hasText: 'Doubling (P = Q)' }).click();
    const rows = await dlRows(fpReadout(page));
    const P = fpPoint(rows.P);
    expect(fpPoint(rows.Q)).toEqual(P);
    const { a, b, p } = FP_CURVES[0];
    const lambda = BigInt(rhsOf(rows['λ (tangent)']));
    const x3 = BigInt(rhsOf(rows['x₃']));
    const y3 = BigInt(rhsOf(rows['y₃']));

    expect(mod(lambda * 2n * P.y, p)).toBe(mod(3n * P.x * P.x + a, p)); // λ·2y ≡ 3x² + a
    expect(x3).toBe(mod(lambda * lambda - 2n * P.x, p));
    expect(y3).toBe(mod(lambda * (P.x - x3) - P.y, p));
    expect(onCurveFp(x3, y3, a, b, p)).toBe(true);
    await expect(resultMain(fpReadout(page))).toHaveText(`P + Q = (${x3}, ${y3})`);
  });

  test('P + (−P) = O over 𝔽ₚ reaches the identity and says why', async ({ page }) => {
    await openFp(page);
    await page.locator('#cl-panel-fp .chip-btn', { hasText: 'P + (−P) = O' }).click();
    const rows = await dlRows(fpReadout(page));
    const P = fpPoint(rows.P);
    const Q = fpPoint(rows.Q);
    const { p } = FP_CURVES[0];
    expect(Q.x).toBe(P.x);
    expect(mod(P.y + Q.y, p)).toBe(0n); // genuinely y and −y mod p
    expect(rows['x₃']).toBeUndefined();
    await expect(resultMain(fpReadout(page))).toHaveText('P + Q = O');
    await expect(fpReadout(page).locator('.res-note')).toContainText(
      'The vertical line has no third point — the sum is the point at infinity.',
    );
  });

  // Regression: this example used to render the "pick two points" prompt from a
  // fresh load, because choosing O did not count as "Q was chosen".
  test('P + O = P shows the identity verdict from a fresh load', async ({ page }) => {
    await openFp(page);
    const chosenP = (await fpSel(page, 'P').locator('option:checked').textContent()) ?? '';
    expect(chosenP).toMatch(/^\(\d+, \d+\)$/);
    await page.locator('#cl-panel-fp .chip-btn', { hasText: 'P + O = P' }).click();
    await expect(fpReadout(page)).not.toContainText('Pick points P and Q');
    await expect(fpReadout(page).locator('.mono').first()).toHaveText(`P + O = ${chosenP}`);
    await expect(fpReadout(page)).toContainText(
      'O is the identity: adding it returns P unchanged.',
    );
  });

  // Regression: the "Q was chosen" flag used to leak across a curve change, so
  // the fresh lattice opened on "P + O = P" instead of the prompt.
  test('switching curve repopulates the lattice menu and returns to the prompt', async ({
    page,
  }) => {
    await openFp(page);
    await page.locator('#cl-panel-fp .chip-btn', { hasText: 'P + O = P' }).click();
    await expect(fpReadout(page)).toContainText('P + O =');

    await page
      .locator('#cl-panel-fp select[aria-label="Finite-field curve"]')
      .selectOption({ index: 1 });
    await expect(fpReadout(page)).toContainText('Pick points P and Q on the lattice.');
    await expect(fpSel(page, 'P').locator('option')).toHaveCount(FP_CURVES[1].points);
    const { a, b, p } = FP_CURVES[1];
    const labels = await fpSel(page, 'P').locator('option').allTextContents();
    for (const label of labels.slice(1)) {
      const pt = fpPoint(label);
      expect(onCurveFp(pt.x, pt.y, a, b, p), `${label} off curve`).toBe(true);
    }
    // …and the new curve still adds correctly.
    await fpSel(page, 'Q').selectOption({ index: 2 });
    const rows = await dlRows(fpReadout(page));
    const x3 = BigInt(rhsOf(rows['x₃']));
    const y3 = BigInt(rhsOf(rows['y₃']));
    expect(onCurveFp(x3, y3, a, b, p)).toBe(true);
  });
});

// ── Panel 2 · secp256k1 (numeric mode) ───────────────────────────────────────

/** The three coordinate groups of the secp readout, in order: P, Q, P + Q. */
async function coordGroup(page: Page, i: number): Promise<{ x: bigint; y: bigint } | null> {
  const group = page.locator('#cl-panel-fp .coord-group').nth(i);
  const vals = group.locator('.coord-val');
  if ((await vals.count()) === 0) return null; // O
  return { x: BigInt(await vals.nth(0).innerText()), y: BigInt(await vals.nth(1).innerText()) };
}

async function openSecp(page: Page): Promise<void> {
  await openFp(page);
  await page
    .locator('#cl-panel-fp select[aria-label="Finite-field curve"]')
    .selectOption({ index: 2 });
  await expect(page.locator('#cl-panel-fp .coord-group').first()).toBeVisible();
}

test.describe('panel 2 — secp256k1 in exact 256-bit arithmetic', () => {
  test('shows the real generator, hides the lattice, and its G + 2G is on the curve', async ({
    page,
  }) => {
    await openSecp(page);
    await expect(page.locator('#cl-panel-fp canvas')).toBeHidden();
    await expect(page.locator('#cl-panel-fp .note').first()).toContainText(
      'far too large to draw as a lattice',
    );

    const P = await coordGroup(page, 0);
    expect(P!.x.toString()).toBe(SECP_GX);
    expect(P!.y.toString()).toBe(SECP_GY);
    for (const i of [0, 1, 2]) {
      const pt = await coordGroup(page, i);
      expect(onCurveFp(pt!.x, pt!.y, 0n, 7n, SECP_P), `group ${i} off curve`).toBe(true);
    }
  });

  test('G + G reproduces the page’s own 2G, and G + (−G) = O, and G + O = G', async ({ page }) => {
    await openSecp(page);
    // The opening state is P = G, Q = 2G (2G computed by the page's scalar
    // multiplication), so 2G is a value the page derived, not one we asserted.
    const twoG = await coordGroup(page, 1);

    const setQ = page.locator('#cl-panel-fp .fp-presets .control-row').nth(1);
    await setQ.locator('button', { hasText: /^G$/ }).click();
    // Doubling G through the chord-and-tangent readout must land on that same 2G.
    expect(await coordGroup(page, 2)).toEqual(twoG);

    await setQ.locator('button', { hasText: '−G' }).click();
    await expect(resultMain(fpReadout(page))).toHaveText('P + Q = O (point at infinity)');
    const negG = await coordGroup(page, 1);
    expect(negG!.x).toBe(BigInt(SECP_GX));
    expect(mod(negG!.y + BigInt(SECP_GY), SECP_P)).toBe(0n);

    await setQ.locator('button', { hasText: /^O$/ }).click();
    expect(await coordGroup(page, 1)).toBeNull();
    expect(await coordGroup(page, 2)).toEqual({ x: BigInt(SECP_GX), y: BigInt(SECP_GY) });
  });
});

// ── Panel 3 · scalar multiplication ──────────────────────────────────────────

const kInput = (page: Page) => page.locator('#scalar input[type=text]');
const cmpCard = (page: Page, i: number) => page.locator('#scalar .cmp-card').nth(i);

/** The cost cards, parsed: naive additions, and doublings/adds/total. */
async function costs(page: Page) {
  const naive = /(\S+) additions/.exec(await cmpCard(page, 0).locator('.cmp-cost').innerText())![1];
  const d = /(\d+) doublings \+ (\d+) adds = (\d+) ops/.exec(
    await cmpCard(page, 1).locator('.cmp-cost').innerText(),
  )!;
  return { naive, dbl: Number(d[1]), add: Number(d[2]), total: Number(d[3]) };
}

async function setK(page: Page, k: string): Promise<void> {
  await kInput(page).fill(k);
  await kInput(page).press('Enter');
  await expect(page.locator('#scalar .result-card')).toContainText(/./);
}

test.describe('panel 3 — k · P, and the cost gap that makes ECC practical', () => {
  test('the two cost cards are internally consistent with k and with each other', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    for (const k of ['9', '19', '255', '1000']) {
      await setK(page, k);
      const kk = BigInt(k);
      const c = await costs(page);
      expect(c.naive).toBe(k); // repeated addition = k additions
      expect(c.dbl).toBe(bitLen(kk)); // one doubling per bit
      expect(c.add).toBe(popcount(kk)); // one add per 1-bit
      expect(c.dbl + c.add).toBe(c.total); // the parts sum to the whole
      expect(c.total).toBeLessThan(Number(kk)); // …and it is the cheaper route
    }
  });

  test('Show all: the verdict, the live counters, the trace and the bit tape all agree', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    await expect(page.locator('#scalar .result-card')).toContainText('Press Step or Show all');

    await page.locator('#scalar button', { hasText: 'Show all' }).click();
    const c = await costs(page);
    const card = page.locator('#scalar .result-card');
    await expect(card).toHaveClass(/done/);
    await expect(card.locator('.rc-label')).toHaveText('9 · G =');
    const answer = await card.locator('.mono').innerText();

    // Live counters must equal the advertised cost, exactly.
    await expect(cmpCard(page, 1).locator('.cmp-live')).toHaveText(
      `${c.dbl} dbl, ${c.add} add done`,
    );
    // One trace row per operation, and the last one is the answer.
    await expect(page.locator('#scalar .trace-row')).toHaveCount(c.total);
    await expect(page.locator('#scalar .trace-row').last().locator('.dim')).toHaveText(answer);

    // The bit tape is k in binary, and every bit has been consumed.
    const bits = await page.locator('#scalar .bt-bit').allInnerTexts();
    expect(bits.join('')).toBe((9).toString(2));
    expect(bits.length).toBe(c.dbl);
    await expect(page.locator('#scalar .bt-bit.done')).toHaveCount(c.dbl - 1);
    await expect(page.locator('#scalar .bt-bit.cur')).toHaveCount(1);

    // Every accumulator in the trace is a point on the curve (or O).
    const { a, b, p } = FP_CURVES[0];
    for (const s of await page.locator('#scalar .trace-row .dim').allInnerTexts()) {
      if (s.startsWith('O')) continue;
      const pt = fpPoint(s);
      expect(onCurveFp(pt.x, pt.y, a, b, p), `${s} off curve`).toBe(true);
    }
  });

  test('Step advances one operation at a time and reaches the same answer as Show all', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    await page.locator('#scalar button', { hasText: 'Show all' }).click();
    const answer = await page.locator('#scalar .result-card .mono').innerText();
    const total = (await costs(page)).total;

    await page.locator('#scalar button', { hasText: 'Reset' }).click();
    await expect(page.locator('#scalar .trace-row')).toHaveCount(0);
    const step = page.locator('#scalar button', { hasText: 'Step' });
    for (let i = 1; i <= total; i += 1) {
      await step.click();
      await expect(page.locator('#scalar .trace-row')).toHaveCount(i);
      await expect(page.locator('#scalar .result-card')).toHaveClass(
        i === total ? /done/ : /progress/,
      );
    }
    await expect(step).toBeDisabled(); // no stepping past the end
    await expect(page.locator('#scalar .result-card .mono')).toHaveText(answer);
  });

  test('repeated addition and double-and-add reach the same point by different costs', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    const method = page.locator('#scalar select[aria-label=Method]');

    await page.locator('#scalar button', { hasText: 'Show all' }).click();
    const fast = await page.locator('#scalar .result-card .mono').innerText();
    const fastOps = await page.locator('#scalar .trace-row').count();
    await expect(cmpCard(page, 1)).toHaveClass(/sel/);

    await method.selectOption('naive');
    await expect(cmpCard(page, 0)).toHaveClass(/sel/);
    await expect(page.locator('#scalar .bit-tape')).toBeHidden(); // no bits to consume
    await page.locator('#scalar button', { hasText: 'Show all' }).click();
    const slow = await page.locator('#scalar .result-card .mono').innerText();
    const slowOps = await page.locator('#scalar .trace-row').count();

    expect(slow).toBe(fast); // same group element…
    expect(slowOps).toBe(9); // …k additions…
    expect(fastOps).toBeLessThan(slowOps); // …at a real cost gap
    await expect(cmpCard(page, 0).locator('.cmp-live')).toHaveText(`${slowOps} done`);
  });

  test('the three worked examples land on the values they promise', async ({ page }) => {
    await page.goto('.');
    await ready(page);
    // Read G off the 𝔽ₚ point menu so "k = order + 1 → G" is checked against a
    // value the page produced, not a constant we chose.
    await page.locator('#cl-tab-fp').click();
    await expect(fpSel(page, 'P').locator('option')).not.toHaveCount(0);
    const G = (await fpSel(page, 'P').locator('option:checked').textContent()) ?? '';
    const order = await fpSel(page, 'P').locator('option').count();

    const showAll = page.locator('#scalar button', { hasText: 'Show all' });
    const card = page.locator('#scalar .result-card');

    await page.locator('#scalar .chip-btn', { hasText: 'k = 0 → O' }).click();
    await expect(kInput(page)).toHaveValue('0');
    await expect(card).toHaveClass(/done/);
    await expect(card).toContainText('0 · G =');
    await expect(card.locator('.mono')).toHaveText('O (∞)');

    await page.locator('#scalar .chip-btn', { hasText: 'k = order → O' }).click();
    // The order the chip uses is the size of the subgroup the menu enumerates.
    await expect(kInput(page)).toHaveValue(String(order));
    await showAll.click();
    await expect(card.locator('.rc-label')).toHaveText(`${order} · G =`);
    await expect(card.locator('.mono')).toHaveText('O (∞)');

    await page.locator('#scalar .chip-btn', { hasText: 'k = order + 1 → G' }).click();
    await expect(kInput(page)).toHaveValue(String(order + 1));
    await showAll.click();
    await expect(card.locator('.rc-label')).toHaveText(`${order + 1} · G =`);
    await expect(card.locator('.mono')).toHaveText(G); // back to the generator
  });

  test('repeated addition refuses a large k, and says how cheap the alternative is', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    await page.locator('#scalar select[aria-label=Method]').selectOption('naive');
    await setK(page, '5000');

    const warn = page.locator('#scalar .warn');
    await expect(warn).toBeVisible();
    const c = await costs(page);
    await expect(warn).toContainText('k = 5000 is too large for repeated addition');
    await expect(warn).toContainText('it would take 5000 steps');
    // The number the warning quotes must be the same number the cost card shows.
    await expect(warn).toContainText(`Double-and-add needs only about ${c.total} operations`);
    expect(c.total).toBe(bitLen(5000n) + popcount(5000n));

    // The refusal is real: nothing to step through.
    await expect(page.locator('#scalar .trace-row')).toHaveCount(0);
    await expect(page.locator('#scalar button', { hasText: 'Step' })).toBeDisabled();

    // Dropping back under the cap clears the warning and computes again.
    await setK(page, '1000');
    await expect(warn).toBeHidden();
    await page.locator('#scalar button', { hasText: 'Show all' }).click();
    await expect(page.locator('#scalar .trace-row')).toHaveCount(1000);
    await expect(page.locator('#scalar .result-card')).toHaveClass(/done/);
  });

  // Regression: render() used to read `preset.curve` inside its requestAnimationFrame
  // callback, so a lattice frame queued for a toy curve could fire after the menu had
  // already moved to secp256k1. renderLattice then tried to draw a p × p grid with
  // p ≈ 2²⁵⁶ and the tab froze. Doing both actions in one task makes that race certain.
  test('switching to secp256k1 with a lattice frame in flight does not freeze the page', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    await page.evaluate(() => {
      const showAll = Array.from(document.querySelectorAll('#scalar button')).find((b) =>
        b.textContent?.includes('Show all'),
      ) as HTMLButtonElement;
      showAll.click(); // queues a lattice frame for the toy curve
      const sel = document.querySelector('#scalar select[aria-label="Curve"]') as HTMLSelectElement;
      sel.value = '2'; // …and swaps in secp256k1 before that frame runs
      sel.dispatchEvent(new Event('change'));
    });
    // Any of these only resolve if the queued frame did not lock up the main thread.
    await expect(page.locator('#scalar canvas')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('#scalar .result-card')).toContainText('Press Step or Show all', {
      timeout: 10_000,
    });
    await page.locator('#scalar button', { hasText: 'Show all' }).click({ timeout: 10_000 });
    await expect(page.locator('#scalar .result-card')).toHaveClass(/done/);
  });

  test('the larger toy curve and secp256k1 both close the loop at k = order', async ({ page }) => {
    test.slow();
    await page.goto('.');
    await ready(page);
    const card = page.locator('#scalar .result-card');

    await page.locator('#scalar select[aria-label=Curve]').selectOption({ index: 1 });
    await page.locator('#scalar .chip-btn', { hasText: 'k = order → O' }).click();
    await expect(kInput(page)).toHaveValue(String(FP_CURVES[1].points));
    await page.locator('#scalar button', { hasText: 'Show all' }).click();
    await expect(card.locator('.mono')).toHaveText('O (∞)');

    await page.locator('#scalar select[aria-label=Curve]').selectOption({ index: 2 });
    await expect(page.locator('#scalar canvas')).toBeHidden(); // no lattice for secp256k1
    await page.locator('#scalar .chip-btn', { hasText: 'k = order → O' }).click();
    const n = BigInt(await kInput(page).inputValue());
    expect(n).toBeGreaterThan(2n ** 255n); // the real ~2²⁵⁶ group order
    await page.locator('#scalar button', { hasText: 'Show all' }).click();
    await expect(card.locator('.mono')).toHaveText('O (∞)');
    const c = await costs(page);
    expect(c.dbl).toBe(bitLen(n));
    expect(c.naive).toBe(`~2^${bitLen(n) - 1}`); // brute force is off the scale
  });
});

// ── Panel 4 · ECDLP ──────────────────────────────────────────────────────────

const ecdlpStatus = (page: Page) => page.locator('#hard .ecdlp-status');

/** Step the subgroup walk until it lands on Q; returns the click count. */
async function walkToTarget(page: Page, limit: number): Promise<number> {
  const step = page.locator('#hard button', { hasText: 'Step' });
  for (let i = 1; i <= limit; i += 1) {
    await step.click();
    const text = await ecdlpStatus(page).innerText();
    if (text.includes('Found after')) return i;
    expect(text).toContain(`Tried ${i} / ${limit} multiples — no match yet.`);
  }
  return -1;
}

test.describe('panel 4 — why you cannot go backwards', () => {
  test('the walk lands on Q, and the step count it reports is the count it took', async ({
    page,
  }) => {
    test.slow();
    await page.goto('.');
    await ready(page);
    const order = 99;
    await expect(ecdlpStatus(page)).toContainText('Recovering it is the ECDLP.');
    await expect(ecdlpStatus(page)).not.toContainText('Found');

    const clicks = await walkToTarget(page, order);
    expect(clicks, 'the walk must terminate inside the subgroup').toBeGreaterThan(0);
    // The reported k is exactly the number of steps that were actually taken.
    await expect(ecdlpStatus(page).locator('.found')).toHaveText(
      `✓ Found after ${clicks} steps: k = ${clicks}. On this toy curve (order ${order}) brute force is trivial.`,
    );
    await expect(page.locator('#hard button', { hasText: 'Step' })).toBeDisabled();
  });

  test('a new secret resets the search and is still found by walking', async ({ page }) => {
    test.slow();
    await page.goto('.');
    await ready(page);
    await walkToTarget(page, 99);
    await expect(ecdlpStatus(page)).toContainText('Found after');

    await page.locator('#hard button', { hasText: 'New secret' }).click();
    await expect(ecdlpStatus(page)).not.toContainText('Found');
    await expect(ecdlpStatus(page)).not.toContainText('Tried');
    await expect(page.locator('#hard button', { hasText: 'Step' })).toBeEnabled();

    const clicks = await walkToTarget(page, 99);
    expect(clicks).toBeGreaterThan(0);
    await expect(ecdlpStatus(page)).toContainText(`Found after ${clicks} steps: k = ${clicks}.`);
  });

  test('Walk runs the search on a timer and pauses where it left off', async ({ page }) => {
    await page.goto('.');
    await ready(page);
    const walk = page.locator('#hard button', { hasText: 'Walk the subgroup' });
    await walk.click();
    await expect(page.locator('#hard .control-row button').first()).toHaveText('Pause ⏸');
    await expect(ecdlpStatus(page)).toContainText('multiples — no match yet.');

    const pause = page.locator('#hard .control-row button').first();
    await pause.click();
    await expect(pause).toHaveText('Walk the subgroup ▶');
    const frozen = await ecdlpStatus(page).innerText();
    await page.waitForTimeout(600);
    expect(await ecdlpStatus(page).innerText()).toBe(frozen); // really stopped
    const tried = Number(/Tried (\d+) \/ 99/.exec(frozen)![1]);
    expect(tried).toBeGreaterThan(0);
    expect(tried).toBeLessThan(99);
  });

  test('the scale table is self-consistent: the generic attack really is about √n', async ({
    page,
  }) => {
    await page.goto('.');
    await ready(page);
    const rows = page.locator('#hard table.cmp tbody tr');
    await expect(rows).toHaveCount(2);

    const toy = await rows.nth(0).locator('td').allInnerTexts();
    expect(toy[0]).toContain('𝔽₉₇');
    const n = Number(toy[1]);
    const attack = Number(/(\d+)/.exec(toy[2])![1]);
    expect(attack).toBe(Math.round(Math.sqrt(n))); // ≈ √n, as the header promises
    // …and n is the order the walk actually searches over.
    await expect(ecdlpStatus(page)).not.toContainText('Tried');
    await page.locator('#hard button', { hasText: 'Step' }).click();
    await expect(ecdlpStatus(page)).toContainText(`Tried 1 / ${n} multiples`);

    const secp = await rows.nth(1).locator('td').allInnerTexts();
    expect(secp[1]).toContain('2²⁵⁶');
    expect(secp[2]).toContain('2¹²⁸'); // half the exponent = √n
  });
});
