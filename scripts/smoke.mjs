// Optional browser smoke test — proves the teaching surface actually renders and
// responds in a real browser (jsdom can't run canvas). NOT part of CI, since it
// needs a local Chromium/Edge. Run it manually:
//
//   npm run build && npm run preview &   # serve dist on :4173
//   npm run smoke                        # drives a system browser against it
//
// Requires Playwright + a system browser. Playwright is intentionally NOT a
// dependency (keeps `npm ci`/CI light); install it locally when you want to run
// this:  npm i -D playwright   (it will use your installed Edge/Chrome channel).
//
// Override the target with SMOKE_URL=... (defaults to the local preview server).

import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://localhost:4173/crypto-lab-ec-point-arithmetic/';
const CHANNEL = process.env.SMOKE_CHANNEL || 'msedge';

const results = [];
const ok = (name, cond, extra = '') => results.push({ name, pass: !!cond, extra });

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });

for (const id of ['intro', 'add', 'scalar', 'hard'])
  ok(`panel #${id} present`, await page.locator(`#${id}`).count());
ok('shared header present', await page.locator('.cl-topbar').count());
ok(
  'scripture footer present',
  (await page.locator('.scripture-footer').innerText()).includes('1 Corinthians 10:31'),
);

// Canvas is non-blank (a real graph was drawn, not an empty rect).
const canvasNonBlank = await page.evaluate(() => {
  const c = document.querySelector('#add .curve-canvas');
  if (!c) return false;
  const g = c.getContext('2d');
  const { data } = g.getImageData(0, 0, c.width, c.height);
  let lit = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;
  return lit > 200; // many non-transparent pixels ⇒ something was rendered
});
ok('real curve canvas is non-blank', canvasNonBlank);

// Scalar panel must NOT show a finished answer before the user steps.
const scalarFirst = await page.locator('#scalar .result-card').innerText();
ok(
  'scalar starts in a Ready state (no premature answer)',
  /ready/i.test(scalarFirst),
  scalarFirst.slice(0, 40),
);
await page.locator('#scalar .btn', { hasText: 'Show all' }).click();
const scalarDone = await page.locator('#scalar .result-card').innerText();
ok('scalar shows final k·G after Show all', /9 · G =/.test(scalarDone), scalarDone.slice(0, 40));

// Both cost cards visible simultaneously.
ok('both cost comparisons shown', (await page.locator('#scalar .cmp-card').count()) === 2);

// Edge-case chip works (real plane): tangent.
await page.locator('#add .chip-btn', { hasText: 'Tangent' }).click();
ok(
  'real edge-case chip updates readout',
  /λ \(tangent\)/.test(await page.locator('#add .readout').first().innerText()),
);

// Keyboard: arrow keys switch the ℝ/𝔽ₚ tabs (WAI-ARIA tablist, automatic activation).
await page.locator('#add #cl-tab-real').focus();
await page.keyboard.press('ArrowRight');
ok(
  'ArrowRight selects the 𝔽ₚ tab',
  (await page.locator('#add #cl-tab-fp').getAttribute('aria-selected')) === 'true',
);
ok('𝔽ₚ tabpanel shown after arrow key', await page.locator('#add #cl-panel-fp').isVisible());
ok(
  'roving tabindex: ℝ tab is removed from the tab order',
  (await page.locator('#add #cl-tab-real').getAttribute('tabindex')) === '-1',
);
await page.keyboard.press('ArrowLeft');
ok(
  'ArrowLeft selects the ℝ tab again',
  (await page.locator('#add #cl-tab-real').getAttribute('aria-selected')) === 'true',
);

// secp256k1 numeric point-add reveal.
await page.locator('#add .seg-btn').nth(1).click(); // switch to 𝔽ₚ view
await page.selectOption('#add select[aria-label="Finite-field curve"]', { index: 2 }); // secp256k1
await page.waitForTimeout(100);
const numeric = await page.locator('#add .coord-group').count();
ok('secp256k1 shows numeric coordinate boxes', numeric >= 2);
ok('copy buttons present for big coords', (await page.locator('#add .copy-btn').count()) >= 2);
ok(
  'lattice P/Q menus hidden in secp256k1 mode',
  !(await page.locator('#add select[aria-label="Point P"]').isVisible()),
);
ok('secp256k1 hides the lattice canvas', !(await page.locator('#add .grid-canvas').isVisible()));
ok('no stray empty warn bar', !(await page.locator('#scalar .warn').isVisible()));

// Mobile: no horizontal overflow.
await page.setViewportSize({ width: 375, height: 760 });
await page.waitForTimeout(250);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
ok('no horizontal overflow at 375px', overflow <= 1, `overflow=${overflow}px`);

ok('no console/page errors', errors.length === 0, errors.join(' | '));

await browser.close();

let failed = 0;
console.log(`\n── Smoke check: ${URL} ──`);
for (const r of results) {
  console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.extra ? `  (${r.extra})` : ''}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
