import { chromium } from "playwright";
import { promises as fs } from "fs";
import path from "path";
import type { CaptureResult, ScrapeResult } from "./types";

const TILE_HEIGHT = 1400;
const MAX_TILES = 12;

export async function captureAndScrape(
  url: string,
  outDir: string
): Promise<{ capture: CaptureResult; scrape: ScrapeResult }> {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: TILE_HEIGHT } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // Trigger lazy-loading: scroll to bottom in steps, then back to top.
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let y = 0;
        const step = () => {
          window.scrollBy(0, 800);
          y += 800;
          if (y < document.body.scrollHeight) setTimeout(step, 100);
          else resolve();
        };
        step();
      });
    });
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Full-page screenshot, then slice into tiles.
    const fullPath = path.join(outDir, "full.png");
    await page.screenshot({ path: fullPath, fullPage: true });
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);

    // Slice using clip screenshots: scroll page to each tile's Y offset, then capture
    // a viewport-sized clip starting at y=0. Viewport height == TILE_HEIGHT so the full
    // clip is always valid. Use actual scrollY to handle bottom-clamp correctly (no gaps).
    const tileCount = Math.min(MAX_TILES, Math.ceil(pageHeight / TILE_HEIGHT));
    const tiles: string[] = [];
    for (let i = 0; i < tileCount; i++) {
      const targetY = i * TILE_HEIGHT;
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(150);
      const actualY = await page.evaluate(() => window.scrollY);
      const h = Math.min(TILE_HEIGHT, pageHeight - actualY);
      if (h <= 10) break;
      const tilePath = path.join(outDir, `tile-${i}.png`);
      await page.screenshot({ path: tilePath, clip: { x: 0, y: 0, width: 1440, height: h } });
      tiles.push(tilePath);
    }
    // Reset scroll to top after tiling.
    await page.evaluate(() => window.scrollTo(0, 0));

    // Scrape assets + text + tokens in the page context.
    const scrapeData = await page.evaluate(() => {
      const abs = (u: string) => {
        try { return new URL(u, location.href).href; } catch { return u; }
      };
      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => ({ src: abs(img.currentSrc || img.src || ""), alt: img.alt || "" }))
        .filter((i) => i.src && !i.src.startsWith("data:"));
      const backgroundImages: string[] = [];
      for (const el of Array.from(document.querySelectorAll("*")).slice(0, 4000)) {
        const bg = getComputedStyle(el as Element).backgroundImage;
        const m = /url\(["']?(.*?)["']?\)/.exec(bg);
        if (m && m[1] && !m[1].startsWith("data:")) backgroundImages.push(abs(m[1]));
      }
      const logoEl =
        document.querySelector("header img, [class*='logo'] img, a[href='/'] img") ||
        document.querySelector("img");
      const colorCounts: Record<string, number> = {};
      const fontSet = new Set<string>();
      for (const el of Array.from(document.querySelectorAll("*")).slice(0, 4000)) {
        const cs = getComputedStyle(el as Element);
        colorCounts[cs.color] = (colorCounts[cs.color] || 0) + 1;
        if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)")
          colorCounts[cs.backgroundColor] = (colorCounts[cs.backgroundColor] || 0) + 1;
        if (cs.fontFamily) fontSet.add(cs.fontFamily.split(",")[0].replace(/["']/g, "").trim());
      }
      const colors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c]) => c);
      return {
        title: document.title,
        images: images.slice(0, 120),
        backgroundImages: Array.from(new Set(backgroundImages)).slice(0, 60),
        logo: logoEl ? abs((logoEl as HTMLImageElement).src) : null,
        text: (document.body.innerText || "").replace(/\n{3,}/g, "\n\n"),
        colors,
        fonts: Array.from(fontSet).slice(0, 12),
      };
    });

    const scrape: ScrapeResult = { url, ...scrapeData };
    return { capture: { tiles, pageHeight }, scrape };
  } finally {
    await browser.close();
  }
}
