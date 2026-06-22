"use client";
import { useEffect, useRef, useState } from "react";

type SectionItem = { name: string; html: string };

export default function CloneView() {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [thoughts, setThoughts] = useState<string>("");
  const [head, setHead] = useState<string>("");
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [fullHtml, setFullHtml] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [showCode, setShowCode] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const runningRef = useRef(false);

  const srcDoc =
    head || sections.length
      ? `<!doctype html><html><head>${head}</head><body>${sections
          .map((s) => s.html)
          .join("\n")}</body></html>`
      : "";

  function start() {
    if (!url.trim() || running) return;
    setRunning(true);
    runningRef.current = true;
    setError("");
    setStage("starting");
    setThoughts("");
    setHead("");
    setSections([]);
    setFullHtml("");
    const es = new EventSource(`/api/clone/stream?url=${encodeURIComponent(url)}`);
    esRef.current = es;
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.type === "stage") setStage(e.stage);
      else if (e.type === "thought") setThoughts((t) => t + e.text);
      else if (e.type === "head") setHead(e.html);
      else if (e.type === "section") setSections((s) => [...s, { name: e.name, html: e.html }]);
      else if (e.type === "done") {
        setFullHtml(e.fullHtml);
        runningRef.current = false;
        setRunning(false);
        es.close();
      } else if (e.type === "error") {
        setError(e.message);
        runningRef.current = false;
        setRunning(false);
        es.close();
      }
    };
    es.onerror = () => {
      if (runningRef.current) setError("Connection lost");
      runningRef.current = false;
      setRunning(false);
      es.close();
    };
  }

  useEffect(() => () => { esRef.current?.close(); }, []);

  function download() {
    const blob = new Blob([fullHtml], { type: "text/html" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "clone.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function openTab() {
    const w = window.open();
    if (w) { w.document.open(); w.document.write(fullHtml); w.document.close(); }
  }

  const started = running || !!srcDoc || !!error;

  if (!started) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-6xl font-serif tracking-tight">Clone a website.</h1>
        <p className="text-gray-500">Paste any URL. Get an editable HTML copy in minutes.</p>
        <div className="flex w-full max-w-2xl gap-2">
          <input
            className="flex-1 rounded-xl border px-4 py-3 outline-none"
            placeholder="https://themomsco.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && start()}
          />
          <button onClick={start} className="rounded-xl bg-black px-6 py-3 text-white">
            Clone
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="grid h-screen grid-cols-[320px_1fr]">
      <aside className="overflow-y-auto border-r p-4 text-sm">
        <div className="mb-2 font-semibold">{url}</div>
        <div className="mb-4 text-gray-500">Stage: {running ? stage : error ? "error" : "done"}</div>
        {error && <div className="mb-4 rounded bg-red-50 p-2 text-red-600">{error}</div>}
        <div className="mb-2 font-medium">Sections</div>
        <ul className="mb-4 space-y-1">
          {sections.map((s, i) => (
            <li key={s.name + i} className="text-green-700">&#10003; {s.name}</li>
          ))}
          {running && <li className="text-gray-400">…generating</li>}
        </ul>
        {thoughts && (
          <>
            <div className="mb-1 font-medium">Thought Process</div>
            <pre className="whitespace-pre-wrap text-xs text-gray-500">{thoughts}</pre>
          </>
        )}
        {fullHtml && (
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => setShowCode((v) => !v)} className="rounded border px-3 py-2">
              {showCode ? "Hide" : "View"} code
            </button>
            <button onClick={() => navigator.clipboard.writeText(fullHtml)} className="rounded border px-3 py-2">
              Copy code
            </button>
            <button onClick={download} className="rounded border px-3 py-2">Download .html</button>
            <button onClick={openTab} className="rounded border px-3 py-2">Open in new tab</button>
          </div>
        )}
      </aside>
      <section className="overflow-hidden bg-gray-100">
        {showCode ? (
          <pre className="h-full overflow-auto bg-gray-900 p-4 text-xs text-gray-100">{fullHtml}</pre>
        ) : (
          <iframe title="preview" className="h-full w-full bg-white" srcDoc={srcDoc} />
        )}
      </section>
    </main>
  );
}
