const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  const page = await context.newPage();
  await page.goto("https://peoplehr.ditstek.com/report/add");

  console.log("➡️ Please manually log in if you're not already logged in.");
  console.log("⚠️ After login, press ENTER in this terminal to save session.");

  process.stdin.once("data", async () => {
    await context.storageState({ path: "auth.json" });
    console.log("✅ Session saved to auth.json");
    await browser.close();
    process.exit();
  });
})();
