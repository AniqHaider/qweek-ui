import { describe, it, expect } from "vitest";
import { normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("adds https:// when scheme is missing", () => {
    expect(normalizeUrl("themomsco.com")).toBe("https://themomsco.com/");
  });
  it("keeps an existing https scheme", () => {
    expect(normalizeUrl("https://themomsco.com")).toBe("https://themomsco.com/");
  });
  it("trims whitespace", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com/");
  });
  it("throws on empty input", () => {
    expect(() => normalizeUrl("")).toThrow("Invalid URL");
  });
  it("throws on non-http scheme", () => {
    expect(() => normalizeUrl("ftp://example.com")).toThrow("Invalid URL");
  });
});
