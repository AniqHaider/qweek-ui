# qweek-ui

> **Windows?** See [SETUP-WINDOWS.md](SETUP-WINDOWS.md).

Paste a URL → get a self-contained Tailwind-CDN HTML clone of its homepage, rendered live as it generates. Backend generation runs on your Claude Max subscription via the `claude` CLI (no API key).

## Prerequisites
- Bun, Node 18+
- `claude` CLI installed and logged in (Max subscription)
- `bunx playwright install chromium` (one-time)

## Run
```bash
bun install
bun run dev
```
Open the printed URL, paste a website URL, click Clone.

## How it works
1. Playwright captures full-page screenshot tiles + scrapes real assets/text (`src/lib/capture.ts`).
2. A prompt with the screenshots and real assets is sent to `claude` (`src/lib/generate.ts`), which streams back one HTML file using `<!--HEAD-->` / `<!--SECTION:name-->` markers.
3. The SSE route (`src/app/api/clone/stream`) forwards events; the client renders completed sections progressively into an iframe.

## Limits (v1)
Homepage only, desktop only. No mobile, multi-page, or in-place editing yet.
