// Diagnose reported artifacts in the current demo PDF text layer.
const { PDFParse } = require("pdf-parse");
const fs = require("fs");

(async () => {
  const target = process.argv[2] ?? "data/demo-real-report.pdf";
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(target)) });
  const parsed = await parser.getText();
  const all = parsed.pages.map((p) => p.text ?? "").join("\n");
  const lines = parsed.pages.map((p, i) => ({ page: i + 1, text: (p.text ?? "").trim() }));
  console.log("=== reported artifact scan ===");
  const scan = (name, re) => {
    const hits = [];
    for (const l of lines) {
      const m = l.text.match(re);
      if (m) hits.push(`p${l.page}: ${JSON.stringify(m[0])}`);
    }
    console.log(`${name}: ${hits.length === 0 ? "none" : hits.join(" | ")}`);
  };
  scan("double percent '%%'", /%%/g);
  scan("bracket badges", /\[(?:unverified|confirmed|possible)\]/gi);
  scan("category tokens", /\((?:iq|scoring|ballhandling|offense|defense)\)/gi);
  scan("standalone 't' value", /:\s*t\b|\bt\s*$/gim);
  scan("page labels", /Page \d+ of \d+|\bPage \d+\b/g);
  scan("duplicated brand", /Union Elite[^\n]*Union Elite/gi);
  scan("section 9 heading", /9 · Three development priorities|9\. Three development priorities/gi);
  scan("section 10 heading", /10 · Recommended|10\. Recommended/gi);
  console.log("=== per-page tails (last 120 chars) ===");
  for (const l of lines) console.log(`p${l.page}: …${JSON.stringify(l.text.slice(-120))}`);
  console.log("=== section 9 area ===");
  const ix = all.search(/9 [·.] Three/i);
  if (ix >= 0) console.log(JSON.stringify(all.slice(ix, ix + 400)));
  else console.log("(section 9 heading not found in extraction)");
  console.log("=== assist-to-turnover occurrences ===");
  for (const l of lines) {
    const m = l.text.match(/[^\n]*ssist[^\n]*/gi) ?? [];
    for (const x of m) console.log(`p${l.page}: ${JSON.stringify(x.slice(0, 140))}`);
  }
})().catch((e) => { console.error("DIAG ERROR:", e.message); process.exit(2); });
