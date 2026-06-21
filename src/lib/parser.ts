import type { CloneEvent } from "./types";

export class MarkerParser {
  private buffer = "";
  private head: string | null = null;
  private sections: { name: string; html: string }[] = [];

  push(textChunk: string): CloneEvent[] {
    this.buffer += textChunk;
    const events: CloneEvent[] = [];
    let madeProgress = true;
    while (madeProgress) {
      madeProgress = false;

      if (this.head === null) {
        const m = /<!--HEAD-->([\s\S]*?)<!--\/HEAD-->/.exec(this.buffer);
        if (m) {
          this.head = m[1].trim();
          events.push({ type: "head", html: this.head });
          this.buffer = this.buffer.slice(m.index + m[0].length);
          madeProgress = true;
          continue;
        }
      }

      const s = /<!--SECTION:([\s\S]*?)-->([\s\S]*?)<!--\/SECTION-->/.exec(this.buffer);
      if (s) {
        const name = s[1].trim();
        const html = s[2].trim();
        this.sections.push({ name, html });
        events.push({ type: "section", name, html });
        this.buffer = this.buffer.slice(s.index + s[0].length);
        madeProgress = true;
      }
    }
    return events;
  }

  assemble(): string {
    const parts: string[] = [];
    if (this.head !== null) parts.push(this.head);
    for (const sec of this.sections) parts.push(sec.html);
    return parts.join("\n");
  }
}
