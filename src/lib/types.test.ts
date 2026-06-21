import { describe, it, expect } from "vitest";
import { sseLine } from "./types";

describe("sseLine", () => {
  it("formats an event as an SSE data line", () => {
    expect(sseLine({ type: "stage", stage: "capturing" })).toBe(
      'data: {"type":"stage","stage":"capturing"}\n\n'
    );
  });
});
