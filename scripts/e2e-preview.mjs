import { chromium } from "playwright";
import fs from "node:fs/promises";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SCREENSHOT_DIR || "artifacts/rf-preview";
await fs.mkdir(outputDir, { recursive: true });

const report = {
  baseURL,
  desktop: {},
  mobile: {},
  consoleErrors: [],
  pageErrors: [],
  unexpectedExternalRequests: [],
  passed: false,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function trackPage(page) {
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (
      !url.startsWith(baseURL) &&
      !url.startsWith("data:") &&
      !url.startsWith("blob:") &&
      !url.startsWith("chrome-extension:")
    ) {
      report.unexpectedExternalRequests.push(url);
    }
  });
}

async function noHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${label}: horizontal overflow (${dimensions.scrollWidth} > ${dimensions.clientWidth})`
  );
}

async function waitForModule(page) {
  const loader = page.locator(".wms-loading-shell");
  if (await loader.count()) {
    await loader.waitFor({ state: "detached", timeout: 10000 });
  }
  await page.waitForTimeout(80);
}

async function assertHeading(page, expected) {
  await page.locator(".wms-page-heading strong").filter({ hasText: expected }).waitFor({ state: "visible" });
}

async function clickDesktopNav(page, label, expectedHeading) {
  await page.locator(".wms-sidebar").getByRole("button", { name: label, exact: true }).click();
  await assertHeading(page, expectedHeading);
  await waitForModule(page);
  await noHorizontalOverflow(page, expectedHeading);
}

const browser = await chromium.launch({ headless: true });

try {
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const desktop = await desktopContext.newPage();
  trackPage(desktop);

  await desktop.goto(baseURL, { waitUntil: "networkidle" });
  await assertHeading(desktop, "Warehouse control centre");
  await desktop.getByText("DEMO · SAFE MODE", { exact: true }).waitFor({ state: "visible" });
  await noHorizontalOverflow(desktop, "desktop dashboard");
  await desktop.screenshot({ path: `${outputDir}/dashboard-desktop.png`, fullPage: true });

  const storageKeys = await desktop.evaluate(() => Object.keys(localStorage));
  for (const key of ["rf_purchase_orders", "rf_sales_orders", "rf_bins", "rf_cycle_counts"]) {
    assert(storageKeys.includes(key), `Missing seeded preview storage key: ${key}`);
  }

  await clickDesktopNav(desktop, "Receiving / GRPO", "Receiving / GRPO");
  await desktop.getByText("PO-48217", { exact: true }).first().click();
  await desktop.getByText("Items to Receive", { exact: true }).waitFor({ state: "visible" });
  await desktop.getByRole("button", { name: "Receive", exact: true }).first().click();
  await desktop.getByText("Quantity Received", { exact: true }).waitFor({ state: "visible" });
  await desktop.screenshot({ path: `${outputDir}/receiving-desktop.png`, fullPage: true });
  await desktop.getByRole("button", { name: "Confirm Receive to Staging", exact: true }).click();
  await desktop.waitForFunction(() => {
    const pos = JSON.parse(localStorage.getItem("rf_purchase_orders") || "[]");
    const po = pos.find((candidate) => candidate.poNumber === "PO-48217");
    const item = po?.items.find((candidate) => candidate.ItemCode === "PTO-850-A");
    return item?.ReceivedQty === 6;
  });

  await clickDesktopNav(desktop, "Picking", "Order picking");
  await desktop.getByRole("button", { name: "Start Picking", exact: true }).first().click();
  await desktop.getByRole("button", { name: "Confirm Pick", exact: true }).waitFor({ state: "visible" });
  await desktop.screenshot({ path: `${outputDir}/picking-desktop.png`, fullPage: true });
  await desktop.getByRole("button", { name: "Confirm Pick", exact: true }).click();
  await desktop.waitForFunction(() => {
    const orders = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");
    const so = orders.find((candidate) => candidate.soNumber === "SO-73111");
    return so?.items?.some((item) => item.ItemCode === "GBX-220" && item.DeliveredQty === 1);
  });

  await clickDesktopNav(desktop, "Scan & Inquiry", "Scan & inquiry");
  const lookup = desktop.getByPlaceholder("Enter item or bin code");
  await lookup.fill("01-0210");
  await lookup.press("Enter");
  await desktop.getByText("Bin Contents (1 items)", { exact: true }).waitFor({ state: "visible" });
  await desktop.screenshot({ path: `${outputDir}/scan-desktop.png`, fullPage: true });
  await desktop.getByRole("button", { name: "Clear", exact: true }).click();
  await lookup.fill("NO-DEMO-ITEM");
  await lookup.press("Enter");
  await desktop.getByText(/No bin or item found for code:/).waitFor({ state: "visible" });
  await noHorizontalOverflow(desktop, "scan desktop");

  await clickDesktopNav(desktop, "Inventory & Counts", "Inventory & cycle counts");
  await desktop.getByRole("button", { name: "Count", exact: true }).first().click();
  await desktop.getByText("Physical Count", { exact: true }).waitFor({ state: "visible" });
  await desktop.screenshot({ path: `${outputDir}/inventory-desktop.png`, fullPage: true });
  const physicalCount = desktop.getByPlaceholder("Enter counted quantity");
  await physicalCount.fill("18");
  await desktop.getByRole("button", { name: "Submit Count", exact: true }).click();
  await desktop.waitForFunction(() => {
    const counts = JSON.parse(localStorage.getItem("rf_cycle_counts") || "[]");
    return counts.some((count) => count.id === "demo-cc-3" && count.Status === "completed" && count.CountedQty === 18);
  });

  await clickDesktopNav(desktop, "Transactions", "Transactions");

  await clickDesktopNav(desktop, "Exports", "Exports");
  for (const name of [/Download Updated CSV/, /Download Receiving Log CSV/, /Download Cycle Count Log CSV/]) {
    const downloadPromise = desktop.waitForEvent("download");
    await desktop.getByRole("button", { name }).click();
    const download = await downloadPromise;
    assert(Boolean(download.suggestedFilename()), `Export did not produce a filename for ${name}`);
  }

  await clickDesktopNav(desktop, "Settings", "Settings & access");

  await clickDesktopNav(desktop, "Shipping", "Shipping operations");
  await desktop.screenshot({ path: `${outputDir}/shipping-desktop-before.png`, fullPage: true });

  const createShipment = desktop.getByRole("button", { name: /Create Shipment/ }).first();
  await createShipment.waitFor({ state: "visible" });
  await createShipment.click();
  await desktop.getByText(/Preview shipment created/).first().waitFor({ state: "visible", timeout: 5000 });
  await desktop.screenshot({ path: `${outputDir}/shipping-desktop-after.png`, fullPage: true });

  const shipmentPersisted = await desktop.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");
    return orders.some((order) => String(order.shipmentPin || "").startsWith("DEMO-"));
  });
  assert(shipmentPersisted, "Simulated shipment did not persist to isolated preview storage");

  await desktop.reload({ waitUntil: "networkidle" });
  await assertHeading(desktop, "Warehouse control centre");

  await desktop.keyboard.press("Tab");
  const focusTag = await desktop.evaluate(() => document.activeElement?.tagName || "");
  assert(focusTag !== "BODY", "Keyboard navigation did not move focus away from the document body");

  report.desktop = {
    dashboard: true,
    allMajorNavigation: true,
    receivingSimulation: true,
    pickingSimulation: true,
    successfulAndUnsuccessfulInquiry: true,
    cycleCountPersistence: true,
    exportDownloads: true,
    shippingSimulation: true,
    localStoragePersistence: true,
    noHorizontalOverflow: true,
    keyboardFocus: true,
    reducedMotionContext: true,
  };
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const mobile = await mobileContext.newPage();
  trackPage(mobile);

  await mobile.goto(baseURL, { waitUntil: "networkidle" });
  await assertHeading(mobile, "Warehouse control centre");
  await noHorizontalOverflow(mobile, "mobile dashboard");
  await mobile.screenshot({ path: `${outputDir}/dashboard-mobile.png`, fullPage: false });

  await mobile.locator(".wms-mobile-dock").getByRole("button", { name: "Count", exact: true }).click();
  await assertHeading(mobile, "Inventory & cycle counts");
  await waitForModule(mobile);
  await noHorizontalOverflow(mobile, "mobile inventory");
  await mobile.screenshot({ path: `${outputDir}/inventory-mobile.png`, fullPage: false });

  await mobile.getByRole("button", { name: "Open navigation" }).click();
  await mobile.locator(".wms-drawer-panel").getByRole("button", { name: "Shipping", exact: true }).click();
  await assertHeading(mobile, "Shipping operations");
  await waitForModule(mobile);
  await noHorizontalOverflow(mobile, "mobile shipping");
  await mobile.screenshot({ path: `${outputDir}/shipping-mobile.png`, fullPage: false });

  report.mobile = {
    dashboard: true,
    inventory: true,
    drawerNavigation: true,
    shipping: true,
    noHorizontalOverflow: true,
    touchLayout: true,
  };
  await mobileContext.close();

  const external = [...new Set(report.unexpectedExternalRequests)];
  report.unexpectedExternalRequests = external;
  assert(external.length === 0, `Unexpected external requests in demo mode: ${external.join(", ")}`);
  assert(report.pageErrors.length === 0, `Page errors: ${report.pageErrors.join(" | ")}`);
  assert(report.consoleErrors.length === 0, `Console errors: ${report.consoleErrors.join(" | ")}`);

  report.passed = true;
} finally {
  await fs.writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
