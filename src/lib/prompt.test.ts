import { describe, it, expect } from "vitest";
import { buildPrompt } from "./prompt";
import type { ScrapeResult } from "./types";

const scrape: ScrapeResult = {
  url: "https://themomsco.com/",
  title: "The Moms Co.",
  images: [{ src: "https://x/hero.png", alt: "hero" }],
  backgroundImages: ["https://x/bg.png"],
  logo: "https://x/logo.png",
  text: "Welcome to The Moms Co.",
  colors: ["#327A54"],
  fonts: ["Poppins"],
};

describe("buildPrompt", () => {
  it("includes the marker contract", () => {
    const p = buildPrompt(scrape);
    expect(p).toContain("<!--HEAD-->");
    expect(p).toContain("<!--SECTION:");
    expect(p).toContain("cdn.tailwindcss.com");
  });
  it("includes real asset URLs and text", () => {
    const p = buildPrompt(scrape);
    expect(p).toContain("https://x/hero.png");
    expect(p).toContain("https://x/logo.png");
    expect(p).toContain("Welcome to The Moms Co.");
  });
});
