import { spawn } from "child_process";
import { promises as fs } from "fs";
import type { CloneEvent } from "./types";
import { MarkerParser } from "./parser";

export const GEN_MODEL = "claude-opus-4-8";

async function fileToBase64(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return buf.toString("base64");
}

const GEN_TIMEOUT_MS = 6 * 60 * 1000;

export async function* generate(
  prompt: string,
  tilePaths: string[],
  signal?: AbortSignal
): AsyncGenerator<CloneEvent> {
  if (signal?.aborted) return;
  // Build the stream-json user message: prompt text + screenshot tiles as image blocks.
  const content: any[] = [{ type: "text", text: prompt }];
  for (const p of tilePaths) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: await fileToBase64(p) },
    });
  }
  const userMessage = JSON.stringify({
    type: "user",
    message: { role: "user", content },
  });

  const child = spawn(
    "claude",
    [
      "--print",
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--include-partial-messages",
      "--verbose",
      "--model", GEN_MODEL,
      "--permission-mode", "bypassPermissions",
    ],
    { stdio: ["pipe", "pipe", "pipe"] }
  );

  child.stdin.write(userMessage + "\n");
  child.stdin.end();

  const parser = new MarkerParser();
  const queue: CloneEvent[] = [];
  let resolveWait: (() => void) | null = null;
  let done = false;
  let stderr = "";
  let exitErr: Error | null = null;
  let headHtml = "";
  const sectionHtmls: string[] = [];

  const wake = () => { if (resolveWait) { resolveWait(); resolveWait = null; } };

  const watchdog = setTimeout(() => {
    try { child.kill("SIGTERM"); } catch {}
    exitErr = new Error("Generation timed out");
    done = true;
    wake();
  }, GEN_TIMEOUT_MS);

  let onAbort: (() => void) | undefined;
  if (signal) {
    onAbort = () => {
      try { child.kill("SIGTERM"); } catch {}
      exitErr = new Error("aborted");
      done = true;
      wake();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  }

  let lineBuf = "";
  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let obj: any;
    try { obj = JSON.parse(trimmed); } catch { return; }

    // Extract text + thinking deltas defensively across possible shapes.
    const pushText = (t: string) => { for (const e of parser.push(t)) queue.push(e); };

    // Primary: stream_event deltas — this is where we get incremental text as it's generated.
    // We intentionally do NOT also process obj.type==="assistant" (final assembled message)
    // because --include-partial-messages means the full text is already covered by the deltas,
    // and processing both would cause duplicate head/section events from the MarkerParser.
    if (obj.type === "stream_event" && obj.event) {
      const ev = obj.event;
      if (ev.type === "content_block_delta" && ev.delta) {
        if (ev.delta.type === "text_delta" && ev.delta.text) pushText(ev.delta.text);
        if (ev.delta.type === "thinking_delta" && ev.delta.thinking)
          queue.push({ type: "thought", text: ev.delta.thinking });
      }
    }
    wake();
  };

  child.stdout.on("data", (d: Buffer) => {
    lineBuf += d.toString();
    let idx;
    while ((idx = lineBuf.indexOf("\n")) >= 0) {
      handleLine(lineBuf.slice(0, idx));
      lineBuf = lineBuf.slice(idx + 1);
    }
  });
  child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
  child.on("error", (e) => { clearTimeout(watchdog); exitErr = e; done = true; wake(); });
  child.on("close", (code) => {
    clearTimeout(watchdog);
    if (lineBuf.trim()) handleLine(lineBuf);
    if (code !== 0 && code !== null) exitErr = new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`);
    done = true;
    wake();
  });

  while (true) {
    if (queue.length) {
      const ev = queue.shift()!;
      if (ev.type === "head") headHtml = ev.html;
      else if (ev.type === "section") sectionHtmls.push(ev.html);
      yield ev;
      continue;
    }
    if (done) break;
    await new Promise<void>((res) => { resolveWait = res; });
  }
  clearTimeout(watchdog);
  signal?.removeEventListener("abort", onAbort!);
  if (exitErr) throw exitErr;
  if (!headHtml && sectionHtmls.length === 0) throw new Error("Model produced no output");
  const head = headHtml || `<meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script>`;
  const fullHtml = `<!doctype html>\n<html>\n<head>\n${head}\n</head>\n<body>\n${sectionHtmls.join("\n")}\n</body>\n</html>`;
  yield { type: "done", fullHtml };
}
