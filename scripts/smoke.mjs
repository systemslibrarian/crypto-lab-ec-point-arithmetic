// Optional browser smoke test — proves the teaching surface actually renders and
// responds in a real browser (jsdom can't run canvas). NOT part of CI, since it
// needs a local Chromium/Edge. Run it manually:
//
//   npm run build && npm run preview &   # serve dist on :4701
//   npm run smoke                        # drives a system browser against it
//
// Requires Playwright + a system browser. Playwright is intentionally NOT a
// dependency (keeps `npm ci`/CI light); install it locally when you want to run
// this:  npm i -D playwright   (it will use your installed Edge/Chrome channel).
//
// Override the target with SMOKE_URL=... (defaults to the local preview server).

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Own the server this suite tests.
 *
 * This file used to point at a fixed localhost port and assume a preview was
 * already serving it, without checking whose server answered. A port held by
 * another project -- or by a sibling lab previewed on the same workstation --
 * answers the goto, and every assertion after it describes someone else's
 * page. Port 4630 is this lab's own in the fleet registry
 * (crypto-lab/tools/playwright-ports.json); it was 4701, which the registry assigns to
 * crypto-lab-stream-ward.
 * --strictPort refuses to move, so a collision now fails loudly here instead
 * of testing the wrong app quietly.
 *
 * Set SMOKE_URL to point this at an already-running server; CI does.
 */
const OWN_PORT = 4630;
const URL = process.env.SMOKE_URL ?? `http://localhost:${OWN_PORT}/crypto-lab-ec-point-arithmetic/`;
let ownServer = null;

async function reachable(u) {
  try {
    return (await fetch(u, { redirect: 'follow' })).ok;
  } catch {
    return false;
  }
}

async function startOwnServer() {
  if (!existsSync(join(REPO_ROOT, 'dist', 'index.html'))) {
    const built = spawnSync('npm', ['run', 'build'], { cwd: REPO_ROOT, encoding: 'utf8' });
    if (built.status !== 0) {
      console.error('FAIL: could not build before starting the preview server');
      console.error((built.stdout ?? '') + (built.stderr ?? ''));
      process.exit(1);
    }
  }
  const child = spawn('npm', ['run', 'preview', '--', '--port', String(OWN_PORT), '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    if (await reachable(URL)) return child;
    if (child.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`FAIL: preview did not come up on port ${OWN_PORT} within 30s.`);
  console.error('      --strictPort does not move, so this is a port collision or a build fault:');
  console.error(log.trim() || '      (the server printed nothing)');
  try {
    if (child.exitCode === null) process.kill(child.pid);
  } catch {
    /* already gone */
  }
  process.exit(1);
}

/* By pid, and only the child this process started -- never by pattern. */
function stopOwnServer() {
  if (ownServer?.exitCode === null) {
    try {
      process.kill(ownServer.pid);
    } catch {
      /* already gone */
    }
  }
}

if (!process.env.SMOKE_URL) ownServer = await startOwnServer();

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
stopOwnServer();

console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
