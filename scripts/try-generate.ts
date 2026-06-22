import { generate } from "../src/lib/generate";

async function main() {
  const prompt = `Output ONE HTML doc using these EXACT markers and nothing else:
<!--HEAD--><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script><!--/HEAD-->
<!--SECTION:hero--><section class="p-10 text-3xl font-bold">Hello from qweek-ui</section><!--/SECTION-->`;
  for await (const e of generate(prompt, [])) {
    if (e.type === "done") console.log("DONE:\n", e.fullHtml);
    else if (e.type === "thought") process.stdout.write("[thought] ");
    else console.log("EVENT:", e.type, (e as any).name ?? "");
  }
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
