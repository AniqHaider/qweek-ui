import { NextRequest } from "next/server";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { normalizeUrl } from "@/lib/url";
import { captureAndScrape } from "@/lib/capture";
import { buildPrompt } from "@/lib/prompt";
import { generate } from "@/lib/generate";
import { sseLine, type CloneEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const encoder = new TextEncoder();

  const ac = new AbortController();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: CloneEvent) => controller.enqueue(encoder.encode(sseLine(e)));
      const jobDir = path.join(os.tmpdir(), "qweek-ui", `${Date.now()}`);
      try {
        const url = normalizeUrl(raw);
        send({ type: "stage", stage: "capturing" });
        const { capture, scrape } = await captureAndScrape(url, jobDir);
        send({ type: "stage", stage: "scraping" });
        const prompt = buildPrompt(scrape);
        send({ type: "stage", stage: "generating" });
        for await (const e of generate(prompt, capture.tiles, ac.signal)) {
          send(e);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
        fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
      }
    },
    cancel() { ac.abort(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
