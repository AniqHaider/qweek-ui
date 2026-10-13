# qweek-ui — Windows setup

Paste a website URL → get a self-contained, Tailwind-CDN **HTML clone of its homepage**, rendered live as it generates.
Playwright screenshots + scrapes the page; the **`claude` CLI** (your Claude subscription — no API key) writes the HTML and
streams it back; a Next.js app shows it progressively in an iframe.

> **Hard requirement:** generation runs through the `claude` command-line tool, logged in to a Claude subscription. The
> UI starts without it, but **cloning cannot work on a PC that has no Claude Code installed and signed in**. Everything else
> (capture, parser, tests, build) works without it.

> **Status.** On macOS I verified from a **fresh clone**: `bun install`, `bun run test` (**12 tests pass**) and
> `bun run build`. I did not run a live clone for this guide (it needs the Claude CLI and takes minutes). The Windows
> steps follow official docs and have **not been run on a real Windows PC yet**.

## 1. Install the tools (PowerShell)

```powershell
winget install --id Git.Git -e
winget install --id Oven-sh.Bun -e
winget install --id OpenJS.NodeJS.LTS -e        # Node 18+ required; 22 LTS recommended
```

Close and reopen PowerShell, then check `git --version ; bun --version ; node --version`.

### Claude Code CLI (needed for generation)

Install the **native Windows build** (it provides a real `claude.exe`), then sign in once:

```powershell
irm https://claude.ai/install.ps1 | iex
claude            # follow the browser login with your Claude subscription, then exit
claude --version
```

Why the native build: `src\lib\generate.ts` starts it with `spawn("claude", …)` and **no shell**. On Windows, Node can't
launch the `claude.cmd` shim that an `npm install -g` creates, so use the native `claude.exe`. (If you can only use the npm
shim, change that `spawn` call to pass `{ shell: true }` — untested.)

## 2. Get the code and install

```powershell
mkdir C:\dev ; cd C:\dev
git clone https://github.com/AniqHaider/qweek-ui.git
cd qweek-ui
bun install
bunx playwright install chromium        # one-time: downloads the browser Playwright uses to capture pages
```

## 3. Run

```powershell
bun run dev
```

Open **http://localhost:3000** (use the URL it prints), paste a site URL, click **Clone**. You'll see the page assemble
section by section.

| Command | What it does |
|---|---|
| `bun run dev` | Next.js dev server (port 3000) |
| `bun run build` / `bun run start` | Production build / serve it |
| `bun run test` | Vitest — expect **4 files, 12 tests passed** |
| `bun run lint` | ESLint |

## 4. Things you may want to change

| What | Where |
|---|---|
| Model used for generation (`GEN_MODEL`, currently `claude-opus-4-8`) | `src\lib\generate.ts` — set to a model your subscription can use |
| Generation timeout (6 minutes) | `GEN_TIMEOUT_MS` in the same file |
| Capture logic (screenshot tiles, asset scraping) | `src\lib\capture.ts` |
| Prompt sent to Claude | `src\lib\prompt.ts` |

Limits of v1: homepage only, desktop only; no mobile, multi-page or in-place editing. Design notes are in
`docs\superpowers\specs\` and the implementation plan in `docs\superpowers\plans\`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `spawn claude ENOENT` / `EINVAL` | `claude.exe` isn't on PATH for the terminal running `bun run dev`, or only the npm `.cmd` shim exists — install the native build (section 1), reopen PowerShell. |
| Clone starts, then "Generation timed out" | Large sites can exceed 6 min — raise `GEN_TIMEOUT_MS`; also confirm `claude` is logged in (`claude --version`, run any prompt). |
| Model errors from the CLI | Your account may not have the model in `GEN_MODEL`; change it (section 4). |
| `Executable doesn't exist at …chromium…` | Run `bunx playwright install chromium`. |
| Capture fails on some sites | Sites with bot protection can block headless Chromium — try another URL. |
| `bun` / `node` "not recognized" | Close and reopen PowerShell. |
| Port 3000 in use | `bun run dev -- --port 3100` |
| `sharp` / native module install warnings | Safe to ignore; `package.json` already lists them under `trustedDependencies`. |
