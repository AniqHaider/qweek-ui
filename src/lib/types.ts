export type Stage = "capturing" | "scraping" | "generating";

export interface ScrapeResult {
  url: string;
  title: string;
  images: { src: string; alt: string }[];
  backgroundImages: string[];
  logo: string | null;
  text: string;
  colors: string[];
  fonts: string[];
}

export interface CaptureResult {
  tiles: string[];
  pageHeight: number;
}

export type CloneEvent =
  | { type: "stage"; stage: Stage }
  | { type: "thought"; text: string }
  | { type: "head"; html: string }
  | { type: "section"; name: string; html: string }
  | { type: "done"; fullHtml: string }
  | { type: "error"; message: string };

export function sseLine(e: CloneEvent): string {
  return `data: ${JSON.stringify(e)}\n\n`;
}
