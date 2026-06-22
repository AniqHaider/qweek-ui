import { spawn } from "child_process";
import { promises as fs } from "fs";
import type { CloneEvent } from "./types";
import { MarkerParser } from "./parser";

export const GEN_MODEL = "claude-opus-4-8";

async function fileToBase64(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return buf.toString("base64");
}

export async function* generate(
  prompt: string,
  tilePaths: string[]
): AsyncGenerator<CloneEvent> {
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

  const wake = () => { if (resolveWait) { resolveWait(); resolveWait = null; } };

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
  child.on("error", (e) => { exitErr = e; done = true; wake(); });
  child.on("close", (code) => {
    if (lineBuf.trim()) handleLine(lineBuf);
    if (code !== 0 && code !== null) exitErr = new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`);
    done = true;
    wake();
  });

  while (true) {
    if (queue.length) { yield queue.shift()!; continue; }
    if (done) break;
    await new Promise<void>((res) => { resolveWait = res; });
  }
  if (exitErr) throw exitErr;
  yield { type: "done", fullHtml: wrapHtml(parser.assemble()) };
}

function wrapHtml(body: string): string {
  // If the model already emitted a HEAD block, parser.assemble() begins with head content.
  // Wrap head + sections into a valid document.
  const headMatch = /<\s*meta|<\s*script|<\s*style|<\s*link|<\s*title/i.test(body);
  if (!headMatch) {
    return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head><body>${body}</body></html>`;
  }
  // Heuristic: first head-ish content up to first top-level section element becomes <head>.
  return `<!doctype html><html><head>${extractHead(body)}</head><body>${extractBody(body)}</body></html>`;
}

// The parser joins head first then sections. We re-split on the first section-like element.
function extractHead(body: string): string {
  const idx = body.search(/<(section|header|footer|main|div)[\s>]/i);
  return idx > 0 ? body.slice(0, idx) : body;
}
function extractBody(body: string): string {
  const idx = body.search(/<(section|header|footer|main|div)[\s>]/i);
  return idx > 0 ? body.slice(idx) : "";
}
