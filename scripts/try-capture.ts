import { captureAndScrape } from "../src/lib/capture";
import path from "path";
import os from "os";

async function main() {
  const url = process.argv[2] || "https://themomsco.com/";
  const out = path.join(os.tmpdir(), "qweek-ui", "try-capture");
  const { capture, scrape } = await captureAndScrape(url, out);
  console.log("tiles:", capture.tiles.length, "pageHeight:", capture.pageHeight);
  console.log("images:", scrape.images.length, "logo:", scrape.logo);
  console.log("colors:", scrape.colors.slice(0, 4));
  console.log("text length:", scrape.text.length);
  console.log("out dir:", out);
}
main();
