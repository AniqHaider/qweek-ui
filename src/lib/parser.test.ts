import { describe, it, expect } from "vitest";
import { MarkerParser } from "./parser";

describe("MarkerParser", () => {
  it("emits head once when the HEAD block closes", () => {
    const p = new MarkerParser();
    expect(p.push("<!--HEAD-->abc")).toEqual([]);
    const events = p.push("def<!--/HEAD-->");
    expect(events).toEqual([{ type: "head", html: "abcdef" }]);
  });

  it("emits a section with its name", () => {
    const p = new MarkerParser();
    const events = p.push("<!--SECTION:hero--><div>hi</div><!--/SECTION-->");
    expect(events).toEqual([{ type: "section", name: "hero", html: "<div>hi</div>" }]);
  });

  it("emits multiple blocks across chunk boundaries, each once", () => {
    const p = new MarkerParser();
    let all: any[] = [];
    all = all.concat(p.push("<!--HEAD-->H<!--/HEAD--><!--SECT"));
    all = all.concat(p.push("ION:a-->A<!--/SECTION--><!--SECTION:b-->B"));
    all = all.concat(p.push("<!--/SECTION-->"));
    expect(all).toEqual([
      { type: "head", html: "H" },
      { type: "section", name: "a", html: "A" },
      { type: "section", name: "b", html: "B" },
    ]);
  });

  it("assembles the full file from head + sections", () => {
    const p = new MarkerParser();
    p.push("<!--HEAD-->H<!--/HEAD--><!--SECTION:a-->A<!--/SECTION-->");
    expect(p.assemble()).toBe("H\nA");
  });
});
