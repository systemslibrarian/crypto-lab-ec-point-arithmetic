import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function checkGradientContrast(page: Page, selector: string) {
  const ratio = await page.evaluate((sel) => {
    function getLuminance(r: number, g: number, b: number) {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }
    const el = document.querySelector(sel);
    if (!el) return 0;
    const style = window.getComputedStyle(el);
    const colorMatch = style.color.match(/\d+/g);
    if (!colorMatch) return 0;
    const [cr, cg, cb] = colorMatch.map(Number);
    const textLum = getLuminance(cr, cg, cb);

    const bgStyle = window.getComputedStyle(document.body);
    const bgMatch = bgStyle.backgroundColor.match(/\d+/g);
    if (!bgMatch) return 0;
    const [br, bg, bb] = bgMatch.map(Number);
    const bgLum = getLuminance(br, bg, bb);

    const L1 = Math.max(textLum, bgLum);
    const L2 = Math.min(textLum, bgLum);
    return (L1 + 0.05) / (L2 + 0.05);
  }, selector);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}

/**
 * WCAG regression gate. Deploys are already gated on the algebraic unit tests;
 * this gates them on accessibility the same way. Scans the full page in both
 * themes with every collapsible / hidden region revealed.
 *
 * This lab has no <details>. Its point-addition exhibit is a two-tab tablist
 * (ℝ teaching curve / 𝔽ₚ lattice) where the inactive tabpanel and several
 * controls (warn bar, secp preset picker, bit tape, numeric note) are toggled
 * via the [hidden] attribute. We clear every [hidden] up front so both tab
 * panels and all their controls are scanned, and neutralize animations /
 * transitions so nothing is scanned mid-flight.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function neutralizeMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function revealAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('details')) {
      (details as HTMLDetailsElement).open = true;
    }
    // Reveal every [hidden] region: the inactive tabpanel and its controls.
    for (const el of document.querySelectorAll<HTMLElement>('[hidden]')) {
      el.hidden = false;
    }
    // Also clear any inline display:none that class/state toggles may have set.
    for (const el of document.querySelectorAll<HTMLElement>('[style*="display"]')) {
      if (el.style && el.style.display === 'none') el.style.display = '';
    }
  });
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

async function runSuite(page: Page): Promise<void> {
  await neutralizeMotion(page);
  await expect(page.locator('h1')).toBeVisible();
  await checkGradientContrast(page, '.scripture-footer');
  await revealAll(page);
  await scan(page);
}

test('no WCAG A/AA violations in dark theme', async ({ page }) => {
  await page.goto('.');
  await runSuite(page);
});

test('no WCAG A/AA violations in light theme', async ({ page }) => {
  await page.goto('.');
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await runSuite(page);
});
