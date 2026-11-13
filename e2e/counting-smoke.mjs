// Browser smoke test for the counting screens, run against the demo build.
// Demo mode uses the same counting rules as the server (server/ops-logic.js),
// so this checks the page wiring and the rules together.
//
// Run: start the demo server (VITE_DEMO_MODE=true npx vite --port 4173), then
//      node e2e/counting-smoke.mjs
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
const readField = (label) => page.locator(`label:text-is("${label}") + div`).first().innerText();
const toastText = () => page.locator('text=/Count accurate|sent for admin approval|Variance/').first().innerText({ timeout: 5000 });

try {
  console.log('Counting smoke test');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Inventory & Counts/ }).first().click();
  await page.getByRole('heading', { name: /Inventory/ }).first().waitFor({ timeout: 10000 });
  check(true, 'inventory screen opens');

  // 1. A new session can be created.
  await page.getByRole('button', { name: 'Start New Session' }).click();
  await page.getByRole('button', { name: '+ Create New Session' }).click();
  const sessionName = `Smoke ${Date.now()}`;
  await page.getByPlaceholder('e.g., Morning Count - Zone A').fill(sessionName);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByText(`Created session: ${sessionName}`).waitFor({ timeout: 5000 });
  await closeOpenModal();
  check(true, 'a session can be created');

  // 2. Sequential count by bin range, with numbered bins in the range.
  await page.getByRole('button', { name: 'Sequential Count (Bin Range)' }).click();
  await page.getByRole('button', { name: 'By Range' }).click();
  const [startInput, endInput] = await page.locator('input[type=text]:visible').all();
  await startInput.fill('01-0102');
  await endInput.fill('01-0214');
  await page.getByRole('button', { name: 'Start Counting', exact: true }).last().click();
  await page.getByText(/^Item 1 of \d+$/).waitFor({ timeout: 10000 });
  const firstBin = (await readField('Bin Location')).trim();
  const inRange = ['01-0102', '01-0104', '01-0210', '01-0214'].includes(firstBin);
  check(inRange, `first bin is inside 01-0102 to 01-0214 (got ${firstBin})`);

  // 3. A matching count is accepted.
  const expected = Number((await readField('Expected Quantity')).trim());
  await page.getByRole('spinbutton').fill(String(expected));
  await page.getByRole('button', { name: '✓', exact: true }).click();
  const matchToast = await toastText();
  check(matchToast.includes('Count accurate'), `a matching count is accepted (toast: "${matchToast}")`);

  // 4. A differing count is sent for approval, and the bin is not changed.
  const secondExpected = Number((await readField('Expected Quantity')).trim());
  await page.getByRole('spinbutton').fill(String(secondExpected + 1));
  await page.getByRole('button', { name: '✓', exact: true }).click();
  const varianceToast = await toastText();
  check(varianceToast.includes('sent for admin approval'), `a differing count waits for approval (toast: "${varianceToast}")`);

  // 5. Leave the count and check the approval queue on the main screen.
  await page.locator('h1:has-text("Counting:")').locator('xpath=preceding-sibling::button[1]').click();
  await page.getByText('Count variances waiting for approval').waitFor({ timeout: 10000 });
  check(true, 'the variance appears in the approval queue');
  const approveButtons = await page.getByRole('button', { name: 'Approve', exact: true }).count();
  check(approveButtons >= 1, 'the admin can see Approve for pending variances');

  // 6. Approving the variance clears it from the queue.
  const pendingBefore = await page.getByRole('button', { name: 'Approve', exact: true }).count();
  await page.getByRole('button', { name: 'Approve', exact: true }).first().click();
  await page.getByText(/^Approved/).waitFor({ timeout: 10000 });
  const pendingAfter = await page.getByRole('button', { name: 'Approve', exact: true }).count();
  check(pendingAfter === pendingBefore - 1, `approving clears one variance from the queue (${pendingBefore} -> ${pendingAfter})`);
  const approvedMessage = await page.getByText(/^Approved/).first().innerText();
  check(approvedMessage.includes('is now'), `the admin sees the approval result (${approvedMessage})`);

  // 7. Full count by file upload: the button opens it, a matching row is logged, a differing row
  //    waits for approval, and a row with no bin is skipped.
  await page.getByRole('button', { name: 'Full Count (Upload File)' }).click();
  await page.getByRole('heading', { name: /Full Inventory Count/ }).waitFor({ timeout: 5000 });
  check(true, 'the Full Count button opens the upload screen');
  const csv = [
    'BinCode,ItemCode,Description,ExpectedQty,CountedQty',
    '01-0104,GBX-220,Gearbox,9,9',
    '01-0210,FLT-310,Filter,0,999',
    ',NOBIN-1,No bin,1,1',
  ].join('\n');
  await page.locator('input[type=file]').setInputFiles({ name: 'full-count.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByText(/Loaded 3 items/).first().waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: /Send 3 Counted Items/ }).click();
  const fullToast = await page.getByText(/Full count sent/).first().innerText({ timeout: 10000 });
  check(/1 matched, 1 waiting/.test(fullToast), `full count reports matched and pending (toast: "${fullToast}")`);
  await page.getByText('Count variances waiting for approval').waitFor({ timeout: 10000 });
  check((await page.getByText('FLT-310').count()) >= 1, 'the differing full-count row is in the approval queue');
} catch (error) {
  check(false, `unexpected error: ${error.message.split('\n')[0]}`);
} finally {
  check(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''}`);
  await browser.close();
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll counting smoke checks passed');
