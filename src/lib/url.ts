export function normalizeUrl(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) throw new Error("Invalid URL");
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid URL");
  }
  return parsed.toString();
}
