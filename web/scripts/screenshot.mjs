// Full-page screenshots for design review.
//
//   node scripts/screenshot.mjs <url> [label] [--width=1280] [--mobile]
//
// Saves to ../temporary screenshots/screenshot-N[-label].png, auto-incremented
// so an earlier pass is never overwritten and passes can be compared.

import { mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../../temporary screenshots");

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const label = args.find((a) => !a.startsWith("http") && !a.startsWith("--"));
const mobile = args.includes("--mobile");
const widthArg = args.find((a) => a.startsWith("--width="));
const width = mobile ? 390 : Number(widthArg?.split("=")[1] ?? 1280);

mkdirSync(outDir, { recursive: true });

const used = readdirSync(outDir)
  .map((f) => Number(f.match(/^screenshot-(\d+)/)?.[1]))
  .filter((n) => Number.isFinite(n));
const next = (used.length ? Math.max(...used) : 0) + 1;

const name = `screenshot-${next}${label ? `-${label}` : ""}.png`;
const outPath = resolve(outDir, name);

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({
    width,
    height: mobile ? 844 : 900,
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);

  await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
  // Let webfonts settle so type is never captured mid-swap.
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));

  await page.screenshot({ path: outPath, fullPage: true });
  console.log(outPath);
} finally {
  await browser.close();
}
