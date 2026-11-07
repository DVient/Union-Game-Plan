// §14 verification: extract the generated PDF's text and check reading level
// (Flesch–Kincaid grade) is appropriate for a 14–15-year-old (target ≤ 9).
const { PDFParse } = require("pdf-parse");
const fs = require("fs");

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/u, "").replace(/^y/u, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

(async () => {
  const target = process.argv[2] ?? "data/sample-report.pdf";
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(target)) });
  const parsed = await parser.getText();
  // Reading level is defined for prose. Exclude headings, card labels, table
  // cells and legends: a fragment counts as prose only when it ends in
  // terminal punctuation and carries at least eight words.
  const rawLines = parsed.text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const sentences = [];
  for (const line of rawLines) {
    for (const part of line.split(/(?<=[.!?])\s+/u)) {
      const w = part.match(/[A-Za-z][A-Za-z'-]*|\d+(?:\.\d+)?/gu) ?? [];
      if (w.length >= 8 && /[.!?]$/u.test(part.trim())) sentences.push(part);
    }
  }
  const text = sentences.join(" ");
  const words = text.match(/[A-Za-z][A-Za-z'-]*|\d+(?:\.\d+)?/gu) ?? [];
  const syllableTotal = words.reduce((a, w) => a + syllables(w), 0);
  const wps = words.length / Math.max(1, sentences.length);
  const spw = syllableTotal / Math.max(1, words.length);
  const grade = 0.39 * wps + 11.8 * spw - 15.59;
  console.log(`words: ${words.length}, sentences: ${sentences.length}`);
  console.log(`words/sentence: ${wps.toFixed(2)}, syllables/word: ${spw.toFixed(2)}`);
  console.log(`Flesch-Kincaid grade: ${grade.toFixed(1)} (grade 9 text suits 14-15-year-old readers; pass <= 9.5)`);
  console.log(grade <= 9.5 ? "READABILITY PASS" : grade <= 10.5 ? "READABILITY BORDERLINE — consider simplifying" : "READABILITY FAIL — simplify the report language");
  process.exit(grade <= 9.5 ? 0 : 1);
})().catch((e) => { console.error("READABILITY ERROR:", e.message); process.exit(2); });
