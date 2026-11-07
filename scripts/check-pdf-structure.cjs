// Structural assertions for the generated report PDF. Exits non-zero on any
// failure so regressions cannot slip through silently.
const { PDFParse } = require("pdf-parse");
const fs = require("fs");

(async () => {
  const target = process.argv[2] ?? "data/demo-real-report.pdf";
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(target)) });
  const parsed = await parser.getText();
  const pages = parsed.pages ?? [];
  let failures = 0;
  const check = (name, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
  };

  check("at least 2 pages", pages.length >= 2, `${pages.length} pages`);

  // No blank pages.
  const blank = pages.map((p, i) => ({ i: i + 1, t: (p.text ?? "").trim() })).filter((p) => p.t.length === 0);
  check("no blank pages", blank.length === 0, blank.map((b) => `p${b.i}`).join(","));

  const all = pages.map((p) => p.text ?? "").join("\n");

  // No formatting artifacts.
  check("no double percent signs", !/%%/.test(all), (all.match(/%%/g) ?? []).length + " found");
  check("no raw badge/category tokens", !/\[(?:unverified|confirmed|possible)\]|\((?:iq|scoring|ballhandling|offense|defense)\)/i.test(all));
  check("floating card footnote removed", !/small sample — read with care/.test(all));
  if (/†/.test(all)) check("dagger explained in limitations", /marked † on the summary cards/.test(all));

  // Sequential page labels "Page 1 of N" ... "Page N of N".
  const pageLabels = [];
  for (let i = 0; i < pages.length; i++) {
    const m = (pages[i].text ?? "").match(/Page (\d+) of (\d+)/);
    if (m) pageLabels.push({ page: i + 1, n: Number(m[1]), total: Number(m[2]) });
  }
  check(
    "sequential page labels",
    pageLabels.length === pages.length &&
      pageLabels.every((p) => p.n === p.page && p.total === pages.length),
    pageLabels.map((p) => `${p.n}/${p.total}`).join(","),
  );

  // Section 9 heading must be followed by its body on the same page.
  for (let i = 0; i < pages.length; i++) {
    const t = pages[i].text ?? "";
    if (/9 [·.] Three development priorities/i.test(t)) {
      check("section 9 heading has body on same page", /What we see:|1\. /i.test(t), `page ${i + 1}`);
    }
  }

  // Footer segments present on every page (placement is measured in the generator).
  check("footer band on every page", pages.every((p) => /UNION ELITE/.test(p.text ?? "") && /Private coaching document/.test(p.text ?? "") && /Page \d+ of \d+/.test(p.text ?? "")));

  // Page 1: full band title; pages 2+: continuation header.
  check("page 1 has the band title", /Player Development Report/.test(pages[0]?.text ?? "") && !/continued/.test(pages[0]?.text ?? ""));
  const laterPages = pages.slice(1);
  check(
    "continuation header on every later page",
    laterPages.length > 0 && laterPages.every((p) => /— continued/.test(p.text ?? "") && /UNION ELITE/.test(p.text ?? "")),
    `${laterPages.length} later page(s)`,
  );

  // Team Focus insert page: present with all its sections, on one page.
  const tfPage = pages.findIndex((p) => /Team Focus/.test(p.text ?? ""));
  check("team focus page present", tfPage > 0, tfPage > 0 ? `page ${tfPage + 1}` : "missing");
  if (tfPage > 0) {
    // Letter-spaced labels extract with gaps ("T U R N OV E R S") — compare
    // against whitespace-stripped text.
    const t = (pages[tfPage].text ?? "").replace(/\s+/g, "");
    check("team focus overview cards", /What'sWorking/.test(t) && /FocusAreas/.test(t) && /Suggestions/.test(t), `page ${tfPage + 1}`);
    check("team focus closer-look grid", /ACloserLook/.test(t) && /SHOTMIX/i.test(t) && /DEFENSIVEIMPACT/i.test(t), `page ${tfPage + 1}`);
    const tNext = (pages[tfPage + 1]?.text ?? "").replace(/\s+/g, "");
    check("team focus on one page", !/TeamFocus/.test(tNext), `page ${tfPage + 2} clean`);
  }

  console.log(failures === 0 ? "STRUCTURE PASS" : `STRUCTURE FAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("STRUCTURE ERROR:", e.message); process.exit(2); });
