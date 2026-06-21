import type { ScrapeResult } from "./types";

export function buildPrompt(scrape: ScrapeResult): string {
  const assets = JSON.stringify(
    {
      logo: scrape.logo,
      images: scrape.images,
      backgroundImages: scrape.backgroundImages,
      colors: scrape.colors,
      fonts: scrape.fonts,
    },
    null,
    2
  );

  return `You are an expert front-end engineer. Clone the homepage shown in the attached screenshots as faithfully as possible (pixel-accurate desktop layout at 1440px width).

SOURCE URL: ${scrape.url}
PAGE TITLE: ${scrape.title}

You are given full-page screenshots (in order, top to bottom) AND the page's real scraped assets and text below. Use the REAL asset URLs and REAL text — do not invent placeholders or lorem ipsum.

REAL ASSETS (JSON):
${assets}

VISIBLE TEXT (use exact copy where it matches the screenshots):
"""
${scrape.text.slice(0, 8000)}
"""

OUTPUT RULES (CRITICAL — follow exactly):
1. Output ONE self-contained HTML document and NOTHING else (no markdown fences, no commentary).
2. Load Tailwind via CDN: <script src="https://cdn.tailwindcss.com"></script>. Add any custom theme via an inline tailwind.config script and any custom CSS via a <style> tag, all inside the HEAD block.
3. Structure the output with these EXACT delimiter markers and nothing outside them:
   <!--HEAD-->
   ...everything that belongs in <head>: meta, Tailwind CDN <script>, Google Font <link>s, tailwind.config script, <style>...
   <!--/HEAD-->
   <!--SECTION:header-->...<!--/SECTION-->
   <!--SECTION:hero-->...<!--/SECTION-->
   <!--SECTION:...-->...<!--/SECTION-->
   (one SECTION block per visual section, in top-to-bottom document order; name each section in lowercase-kebab)
4. Each SECTION block contains only the markup for that section (e.g. a <section>, <header>, or <footer> element). Do NOT include <html>, <head>, or <body> tags inside sections.
5. Use the real image URLs from the assets JSON for <img> src and CSS background-image. Match colors, fonts, spacing, and layout to the screenshots.
6. Make it look complete and polished. Desktop only.

Begin now with <!--HEAD-->.`;
}
