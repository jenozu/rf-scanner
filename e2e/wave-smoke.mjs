// Browser smoke test for pick waves, run against the demo build.
// Demo mode uses the same wave rules as the server (server/ops-logic.js), so this checks
// the picking page wiring and the rules together.
//
// Run: start the demo server (VITE_DEMO_MODE=true npx vite --port 4173), then
//      node e2e/wave-smoke.mjs
// Env: BASE_URL (default http://127.0.0.1:4173), CHROME_PATH (optional browser binary).
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const failures = [];
const pageErrors = [];
const check = (ok, message) => {
  if (ok) console.log(`  ok   ${message}`);
  else { console.log(`  FAIL ${message}`); failures.push(message); }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => pageErrors.push(e.message));

const closeOpenModal = async () => {
  const modal = page.locator('.fixed.inset-0 button').first();
  if (await modal.isVisible().catch(() => false)) await modal.click();
};

try {
  console.log('Wave smoke test');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await closeOpenModal();
  await page.getByRole('button', { name: /Picking/ }).first().click();
  await page.getByRole('heading', { name: 'Sales Order Picking' }).waitFor({ timeout: 10000 });
  check(true, 'picking screen opens');

  // 1. Tick two sales orders and build a wave (the demo user is an admin).
  const boxes = page.getByRole('checkbox');
  const count = await boxes.count();
  check(count >= 2, `sales orders have tick boxes (${count})`);
  if (count >= 2) {
    await boxes.nth(0).check();
    await boxes.nth(1).check();
  }
  await page.getByRole('button', { name: 'Create wave' }).click();
  await page.getByText(/Wave \S+ created/).first().waitFor({ timeout: 5000 });
  check(true, 'a wave is created from the ticked orders');

  // 2. The wave shows up with its orders and progress; its orders are marked as in a wave.
  const waveCard = page.locator('h3:has-text("Wave")').first();
  check(await waveCard.isVisible(), 'the wave is listed under Waves');
  check((await page.getByText(/In wave \S+/).count()) >= 2, 'both orders are marked as in a wave');

  // 3. The same orders cannot go in a second wave: their tick boxes are disabled.
  const disabledCount = await page.locator('input[type="checkbox"]:disabled').count();
  check(disabledCount >= 2, 'orders already in a wave cannot be ticked again');

  // 4. Picking the wave walks through its lines in bin order.
  await page.getByRole('button', { name: 'Pick wave' }).first().click();
  await page.getByText('Pick from this location').or(page.getByText('Assign a bin below')).first().waitFor({ timeout: 5000 });
  check(true, 'picking the wave opens its first line');

  // 5. Leaving the wave returns to the list without losing it.
  await page.getByRole('button', { name: /Back to Sales Orders/ }).click();
  check(await page.getByRole('button', { name: 'Pick wave' }).first().isVisible(), 'back on the list, the wave is still there');

  // 6. A wave whose lines already have picks cannot be deleted (the demo orders are part-delivered).
  const deleteBtn = page.locator('.border-purple-500').getByRole('button', { name: 'Delete' }).first();
  check(await deleteBtn.isDisabled(), 'a wave with picked lines cannot be deleted');

  check(pageErrors.length === 0, 'no uncaught page errors');
  if (pageErrors.length) console.log('  page errors:', pageErrors);
} catch (error) {
  check(false, `wave smoke test stopped: ${error.message}`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll wave smoke checks passed');
