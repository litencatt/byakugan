import pkg from "/Users/nakamura.k/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js";
const { chromium } = pkg;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://localhost:3001");

// Wait for data to load (process grid appears)
await page.waitForFunction(() => {
  const grid = document.getElementById("process-grid");
  return grid && !grid.textContent.includes("Connecting");
}, { timeout: 15000 }).catch(() => {});

// Enable demo mode
await page.click("#demo-toggle");
await page.waitForTimeout(800);

// Ensure table/list view (button shows "Card" when in list mode)
const btnText = await page.textContent("#view-toggle");
if (btnText && !btnText.includes("Card")) {
  await page.click("#view-toggle");
  await page.waitForTimeout(500);
}

await page.waitForTimeout(1000);
await page.screenshot({ path: "docs/demo.png", fullPage: false });
await browser.close();
console.log("Screenshot saved to docs/demo.png");
