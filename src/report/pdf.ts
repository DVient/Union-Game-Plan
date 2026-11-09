// PDF report generation (plan §10): eleven sections, A4, plain language for a
// 14–15-year-old (§10/§12), built ONLY from the stored snapshot — regeneration
// never touches the API (plan §5).
//
// Presentation (coach feedback, round 2): BI-style KPI cards with centred
// values, double-spaced bullets with clean indentation (no pdfkit `indent`),
// a footer band that mirrors the header, no raw confidence/category tokens in
// the text, no trailing blank pages, and a dashboard-style shot-chart widget
// (the Superstat API has no shot-chart image endpoint — the chart is drawn
// from the documented play-by-play coordinates with exact FIBA geometry).
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import PDFDocument from "pdfkit";
import { PDFDocument as PdfLibDoc, StandardFonts, rgb } from "pdf-lib";
import type { PlayerStats } from "../stats/compute.js";
import type { DevelopmentPriority } from "./priorities.js";
import type { TeamFocus } from "./team-focus.js";

export interface AiSnapshot {
  providerId: string;
  note: string | null;
  findings: Array<{ category: string; claim: string; citation: string; confidence: string }>;
  citations: Record<string, string>;
}

export interface ShotEvent {
  id: string;
  type: string;
  success: boolean;
  /** Fraction of the FULL court length (0..1) from a baseline. */
  x: number;
  /** Fraction of the court width (0..1) from a sideline. */
  y: number;
  /** Period the shot occurred in (for per-period basket-side inference). */
  periodNumber?: number | null;
  /** True when the team attacked the x≈1 baseline in this shot's period. */
  attacksRight?: boolean;
}

export interface ReportPdfInput {
  reportId: string;
  generatedAt: string;
  playerName: string;
  jerseyNumber: string | null;
  teamName: string;
  mode: "mock" | "live";
  games: Array<{ playedAt: string; opponentName: string; teamScore: number | null; opponentScore: number | null }>;
  stats: PlayerStats;
  ai: AiSnapshot | null;
  priorities: DevelopmentPriority[];
  /** Team-level focus page data (inserted as its own page in every report). */
  teamFocus?: TeamFocus;
  outPath: string;
  /** Optional colour club logo (JPEG/PNG) for the continuation headers. */
  logoPath?: string | null;
  /** Optional white club logo (PNG) for the page-1 green band. */
  logoBandPath?: string | null;
  /** Player's located shot events (team side, all selected matches) for the shot chart. */
  shotEvents?: Array<ShotEvent & { periodNumber?: number | null; attacksRight?: boolean }>;
}

/** Union Elite brand + widget palette. */
const UE_GREEN = "#1E5A38";
const UE_OFFWHITE = "#F4F5F4";
const UE_GREY = "#4B5563";
const INK = "#17202A";
const WIDGET_BG = "#F9FBFB";
const WIDGET_TEXT = "#1E293B";
const MADE_GREEN = "#1B4D3E";
const MISS_RED = "#DC2626";
const CARD_BORDER = "#E5E7EB";
const CARD_SUB = "#4B5563";
const UNVERIFIED_GREY = "#6B7280";
/** Court markings — readable greys, still subordinate to the shot markers. */
const COURT_LINE = "#7C8A93";
const COURT_FAINT = "#A5AEB4";
/** Solid (print-safe) stand-in for the old translucent drop shadow. */
const SHADOW_GREY = "#DCE3E7";
const MARGIN = 50;
const USABLE = 495; // A4 width 595.28 - 2 * 50
const FOOTER_BAND_H = 26;

/** Exact FIBA half-court measurements (metres). */
const COURT = {
  halfLength: 14,
  width: 15,
  basketFromBaseline: 1.575,
  basketRadius: 0.2286,
  backboardFromBaseline: 1.2,
  paintLength: 5.8,
  paintWidth: 4.9,
  ftCircleRadius: 1.8,
  threeRadius: 6.75,
  cornerFromSideline: 0.9,
  restrictedRadius: 1.25,
};

/** Build the content pages (no footer). Returns the PDF bytes; pages counted via pageAdded. */
function buildContentBuffer(input: ReportPdfInput): Promise<{ buffer: Buffer; pages: number }> {
  return new Promise<{ buffer: Buffer; pages: number }>((resolve, reject) => {
    // Top margin is small: only page 1 carries the title band, and its content
    // start is positioned explicitly below the band.
    const doc = new PDFDocument({ size: "A4", margins: { top: 64, bottom: 64, left: MARGIN, right: MARGIN } });
    const chunks: Buffer[] = [];
    let pages = 1;
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("pageAdded", () => {
      pages++;
      // Continuation header for every page after the first: distinct from the
      // page-1 green band, but clearly the same document. Drawn within the
      // writable area with the flow position saved/restored (drawing below the
      // bottom margin inside this event would recurse into auto-pagination).
      // Width-aware: works for portrait content pages and any landscape page.
      const savedX = doc.x, savedY = doc.y;
      const usable = doc.page.width - 2 * MARGIN;
      const dates = input.games.map((g) => g.playedAt.slice(0, 10)).sort();
      const hasColourLogo = typeof input.logoPath === "string" && input.logoPath.length > 0 && existsSync(input.logoPath);
      let logoWidth = 0;
      if (hasColourLogo) {
        try {
          const measurable = doc as PDFKit.PDFDocument & { openImage(src: string): { width: number; height: number } };
          const img = measurable.openImage(input.logoPath!);
          logoWidth = 30 * (img.width / img.height);
          doc.image(input.logoPath!, MARGIN, 18, { height: 30 });
        } catch { /* a broken logo must never fail the report */ }
      }
      const textWidth = usable - (logoWidth > 0 ? logoWidth + 16 : 0);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(UE_GREEN)
        .text("Player Development Report — continued", MARGIN, 22, { width: textWidth, align: "right", lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor(UE_GREY)
        .text(`${input.playerName}${input.jerseyNumber ? ` (#${input.jerseyNumber})` : ""} · ${input.teamName} · ${dates[0] ?? "?"}–${dates[dates.length - 1] ?? "?"}`, MARGIN, 37, { width: textWidth, align: "right", lineBreak: false });
      doc.moveTo(MARGIN, 52).lineTo(MARGIN + usable, 52).lineWidth(1).strokeColor(UE_GREEN).stroke();
      doc.x = savedX; doc.y = savedY;
    });
    doc.on("end", () => resolve({ buffer: Buffer.concat(chunks), pages }));
    doc.on("error", reject);

    const bottomLimit = (): number => doc.page.height - FOOTER_BAND_H - 20;

  /** Start a new page only when the next block would not fit (no blank tail pages). */
  const ensureSpace = (h: number): void => {
    if (doc.y + h > bottomLimit()) doc.addPage();
  };

  /** Reset pen to the left margin — every helper ends here so indentation never leaks. */
  const homeX = (): void => { doc.x = MARGIN; };

  const H = (text: string, spaceFor = 70): void => {
    ensureSpace(spaceFor);
    doc.moveDown(0.9);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(UE_GREEN).text(text);
    const ruleY = doc.y + 2;
    doc.moveTo(MARGIN, ruleY).lineTo(MARGIN + USABLE, ruleY).lineWidth(1).strokeColor(UE_GREEN).stroke();
    doc.moveDown(0.5).font("Helvetica").fontSize(10.5).fillColor(INK);
    homeX();
  };
  /** Exact greedy word-wrap line count — mirrors pdfkit's wrapping, so card
   * heights derived from it cannot overflow. */
  const wrapLines = (text: string, width: number, font: string, size: number): number => {
    doc.font(font).fontSize(size);
    const space = doc.widthOfString(" ");
    let lines = 1, lineW = 0;
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const w = doc.widthOfString(word);
      if (lineW === 0) { lineW = w; continue; }
      if (lineW + space + w <= width) lineW += space + w;
      else { lines++; lineW = w; }
    }
    return lines;
  };
  const P = (text: string): void => {
    ensureSpace(30);
    doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(text, { lineGap: 3 });
    homeX();
  };
  /** Business-format bullets: real air between items, clean left alignment. */
  const B = (items: string[]): void => {
    doc.font("Helvetica").fontSize(10.5).fillColor(INK);
    items.forEach((item, i) => {
      ensureSpace(34);
      if (i > 0) doc.moveDown(0.85);
      doc.x = MARGIN + 14;
      doc.text(`•  ${item}`, { lineGap: 3 });
      doc.x = MARGIN;
    });
    doc.moveDown(0.2);
  };
  const KV = (rows: Array<[string, string]>): void => {
    doc.font("Helvetica").fontSize(10);
    for (const [k, v] of rows) {
      ensureSpace(18);
      doc.fillColor(UE_GREY).text(k, { continued: true }).fillColor(INK).text(`  ${v}`, { lineGap: 3 });
    }
    doc.moveDown(0.2);
    homeX();
  };
  /** Clean confidence suffix: no brackets, no category tokens. */
  const finding = (claim: string, confidence: string): void => {
    ensureSpace(40);
    const colour = confidence === "confirmed" ? UE_GREEN : confidence === "possible" ? CARD_SUB : UNVERIFIED_GREY;
    doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(claim, { continued: true, lineGap: 3 });
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(colour).text(`   ${confidence}`, { lineGap: 3 });
    doc.x = MARGIN;
    doc.moveDown(0.25);
  };

  /** BI-style KPI card row: label + value centred horizontally and vertically. */
  const kpiCards = (cards: Array<{ label: string; value: string; low?: boolean }>): void => {
    const perRow = 4;
    const gap = 10;
    const w = (USABLE - gap * (perRow - 1)) / perRow;
    const h = 54;
    for (let i = 0; i < cards.length; i += perRow) {
      ensureSpace(h + 12);
      const row = cards.slice(i, i + perRow);
      const yTop = doc.y + 4;
      row.forEach((card, j) => {
        const x = MARGIN + j * (w + gap);
        doc.roundedRect(x, yTop, w, h, 7).fillColor("#FFFFFF").fill().lineWidth(1).strokeColor(CARD_BORDER).stroke();
        doc.roundedRect(x, yTop, w, 3.5, 2).fillColor(UE_GREEN).fill();
        const labelW = w - 12;
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(UE_GREY)
          .text(card.label.toUpperCase(), x + 6, yTop + 11, { width: labelW, align: "center", characterSpacing: 0.7, lineBreak: false });
        if (card.low) {
          // Value centred as a unit with a small superscript dagger after it.
          doc.font("Helvetica-Bold").fontSize(17);
          const valueW = doc.widthOfString(card.value);
          doc.font("Helvetica").fontSize(9);
          const daggerW = doc.widthOfString("†");
          const startX = x + (w - (valueW + daggerW)) / 2;
          doc.font("Helvetica-Bold").fontSize(17).fillColor(UE_GREEN).text(card.value, startX, yTop + 26, { lineBreak: false });
          doc.font("Helvetica").fontSize(9).fillColor(UE_GREY).text("†", startX + valueW, yTop + 28, { lineBreak: false });
        } else {
          doc.font("Helvetica-Bold").fontSize(17).fillColor(UE_GREEN)
            .text(card.value, x + 6, yTop + 26, { width: labelW, align: "center", lineBreak: false });
        }
      });
      doc.y = yTop + h + 8;
      doc.x = MARGIN;
    }
    homeX();
  };

  /** Dashboard-style shot-chart widget with FIBA-accurate geometry. */
  const drawShotChartWidget = (shots: ShotEvent[], unlocated: number): void => {
    const pad = 14;
    const headerH = 26;
    const metricsH = 74;
    const chartMaxH = 300;
    const widgetH = pad + headerH + chartMaxH + metricsH + pad;
    ensureSpace(widgetH + 10);

    // Container: solid light-grey shadow stand-in (print-safe), white card, subtle border.
    const wx = MARGIN, wy = doc.y + 6;
    doc.roundedRect(wx + 3, wy + 3, USABLE, widgetH, 10).fillColor(SHADOW_GREY).fill();
    doc.roundedRect(wx, wy, USABLE, widgetH, 10).fillColor("#FFFFFF").fill().lineWidth(1).strokeColor(CARD_BORDER).stroke();

    // Header row: title left, legend, summary right — measured, no overlaps.
    const headerY = wy + pad - 2;
    doc.font("Helvetica-Bold").fontSize(13).fillColor(WIDGET_TEXT)
      .text("Shot Chart", wx + pad, headerY, { lineBreak: false });
    const madeLabel = "Made";
    const madeW = doc.font("Helvetica").fontSize(8.5).widthOfString(madeLabel);
    const legendX = wx + pad + 84;
    doc.circle(legendX + 4, headerY + 9, 3.4).fillColor(MADE_GREEN).fill();
    doc.font("Helvetica").fontSize(8.5).fillColor(CARD_SUB).text(madeLabel, legendX + 11, headerY + 4, { lineBreak: false });
    const legend2X = legendX + 11 + madeW + 12;
    doc.circle(legend2X + 4, headerY + 9, 4).lineWidth(1.8).strokeColor(MISS_RED).stroke();
    doc.fillColor(CARD_SUB).text("Missed", legend2X + 11, headerY + 4, { lineBreak: false });

    const made = shots.filter((s) => s.success).length;
    const att = shots.length;
    const pct = att === 0 ? 0 : Math.round((made / att) * 100);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(WIDGET_TEXT)
      .text(`${made}/${att} FG · ${pct}%`, wx + USABLE - 150, headerY + 3, { width: 136, align: "right", lineBreak: false });

    // Plot area.
    const plotX = wx + pad;
    const plotY = wy + pad + headerH;
    const plotW = USABLE - 2 * pad;
    const plotH = chartMaxH;
    doc.roundedRect(plotX, plotY, plotW, plotH, 6).fillColor(WIDGET_BG).fill();

    const S = Math.min(plotW / COURT.width, plotH / (COURT.halfLength + 1.2));
    const cw = COURT.width * S;
    const ch = COURT.halfLength * S;
    const cx = plotX + (plotW - cw) / 2;
    const courtBottom = plotY + plotH - (plotH - ch) / 2 - 8;
    const line = (): void => { doc.lineWidth(0.9).strokeColor(COURT_LINE).stroke(); };
    const faint = (): void => { doc.lineWidth(0.6).strokeColor(COURT_FAINT).stroke(); };

    // Per-shot attacking side (computed per period in the server); the court is
    // always drawn with the attacking baseline at the bottom.
    const fallbackRight = att === 0 ? false : shots.reduce((a, s2) => a + s2.x, 0) / att > 0.5;
    const lenM = (x: number, attacksRight: boolean): number => (attacksRight ? 1 - x : x) * 28; // metres from attacking baseline
    const px = (yFrac: number): number => cx + yFrac * cw;
    const py = (lenMetres: number): number => courtBottom - lenMetres * S;

    if (att > 0) {
      // Outline (baseline bottom, halfway line top)
      doc.rect(cx, courtBottom - ch, cw, ch).lineWidth(1.1).strokeColor(COURT_LINE).stroke();
      // Centre circle (upper half only)
      const midY = courtBottom - ch;
      const steps = 32;
      doc.moveTo(px(0.5) - COURT.ftCircleRadius * S, midY);
      for (let i = 1; i <= steps; i++) {
        const a = Math.PI - (Math.PI / steps) * i;
        doc.lineTo(px(0.5) + Math.cos(a) * COURT.ftCircleRadius * S, midY - Math.sin(a) * COURT.ftCircleRadius * S);
      }
      faint();
      // Paint 4.9 × 5.8
      doc.rect(px(0.5) - (COURT.paintWidth / 2) * S, py(COURT.paintLength), COURT.paintWidth * S, COURT.paintLength * S).lineWidth(1).strokeColor(COURT_LINE).stroke();
      // Free-throw circle r 1.8 at paint top
      doc.circle(px(0.5), py(COURT.paintLength), COURT.ftCircleRadius * S).lineWidth(0.9).strokeColor(COURT_LINE).stroke();
      // Restricted area arc r 1.25 (faint)
      doc.circle(px(0.5), py(COURT.basketFromBaseline), COURT.restrictedRadius * S).lineWidth(0.6).strokeColor(COURT_FAINT).stroke();
      // Three-point line: corners 0.9 m from each sideline + arc r 6.75.
      // The arc sweeps theta in [-thetaMax, +thetaMax] around the basket:
      // lenM(theta) = 1.575 + 6.75*cos(theta), widthM = 7.5 + 6.75*sin(theta).
      const cornerWidthM = COURT.cornerFromSideline;
      const cornerMeet = COURT.basketFromBaseline + Math.sqrt(COURT.threeRadius ** 2 - (COURT.width / 2 - cornerWidthM) ** 2);
      const cornerW1 = cornerWidthM / COURT.width;
      const cornerW2 = 1 - cornerWidthM / COURT.width;
      doc.moveTo(px(cornerW1), py(0)).lineTo(px(cornerW1), py(cornerMeet)).lineWidth(1).strokeColor(COURT_LINE).stroke();
      doc.moveTo(px(cornerW2), py(0)).lineTo(px(cornerW2), py(cornerMeet)).lineWidth(1).strokeColor(COURT_LINE).stroke();
      const thetaMax = Math.acos((cornerMeet - COURT.basketFromBaseline) / COURT.threeRadius);
      const arcSteps = 64;
      doc.moveTo(px(cornerW1), py(cornerMeet));
      for (let i = 1; i <= arcSteps; i++) {
        const theta = -thetaMax + ((2 * thetaMax) / arcSteps) * i;
        const lenM = COURT.basketFromBaseline + COURT.threeRadius * Math.cos(theta);
        const widthFrac = 0.5 + (COURT.threeRadius * Math.sin(theta)) / COURT.width;
        doc.lineTo(px(widthFrac), py(lenM));
      }
      line();
      // Basket + backboard
      const basketX = px(0.5);
      const basketY = py(COURT.basketFromBaseline);
      doc.circle(basketX, basketY, COURT.basketRadius * S + 1.5).lineWidth(1.4).strokeColor(WIDGET_TEXT).stroke();
      doc.moveTo(basketX - 10, basketY + 7).lineTo(basketX + 10, basketY + 7).lineWidth(1.6).strokeColor(WIDGET_TEXT).stroke();

      // Zone grid (faint): FT-line extension splits mid-range / top-of-key
      doc.moveTo(px(cornerW1), py(COURT.paintLength + COURT.ftCircleRadius)).lineTo(px(cornerW2), py(COURT.paintLength + COURT.ftCircleRadius)).dash(2, { space: 3 }).lineWidth(0.6).strokeColor(COURT_FAINT).stroke();
      doc.undash();

      // Shots: per-period side; made = filled green, missed = clear red ring.
      shots.forEach((sh, i) => {
        const seed = [...sh.id].reduce((a, c) => a + c.charCodeAt(0), 0);
        const jx = ((seed % 5) - 2) * 1.5;
        const jy = (((seed >> 2) % 5) - 2) * 1.5;
        const side = sh.attacksRight ?? fallbackRight;
        const sx = px(sh.y) + jx;
        const sy = py(Math.min(COURT.halfLength, lenM(sh.x, side))) + jy;
        if (sh.success) {
          doc.circle(sx, sy, 3.6).fillColor(MADE_GREEN).fill();
        } else {
          // Open red ring — no fill, so it reads clearly on the plot background.
          doc.circle(sx, sy, 4).lineWidth(1.8).strokeColor(MISS_RED).stroke();
        }
      });
    } else {
      doc.font("Helvetica").fontSize(10).fillColor(CARD_SUB)
        .text("No located shots were recorded for this selection.", plotX, plotY + plotH / 2 - 8, { width: plotW, align: "center" });
    }

    // Bottom: three metric cards computed from the charted shots.
    const attempts2 = shots.filter((s) => s.type === "two_point").length;
    const made2 = shots.filter((s) => s.type === "two_point" && s.success).length;
    const attempts3 = shots.filter((s) => s.type === "three_point").length;
    const made3 = shots.filter((s) => s.type === "three_point" && s.success).length;
    const r1 = (n: number): string => (Number.isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : "—");
    const totalPts = made2 * 2 + made3 * 3;
    const cardsY = wy + pad + headerH + plotH + 8;
    const cardW = (plotW - 2 * 10) / 3;
    const cardH = metricsH - 14;
    const drawMetric = (x: number, value: string, label: string, sub: string | null): void => {
      doc.roundedRect(x, cardsY, cardW, cardH, 7).fillColor("#FFFFFF").fill().lineWidth(1).strokeColor(CARD_BORDER).stroke();
      doc.font("Helvetica-Bold").fontSize(20).fillColor(WIDGET_TEXT)
        .text(value, x, cardsY + 8, { width: cardW, align: "center", lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(CARD_SUB)
        .text(label.toUpperCase(), x, cardsY + 33, { width: cardW, align: "center", characterSpacing: 0.8, lineBreak: false });
      if (sub !== null) {
        doc.font("Helvetica").fontSize(8).fillColor(CARD_SUB)
          .text(sub, x, cardsY + 44, { width: cardW, align: "center", lineBreak: false });
      }
    };
    drawMetric(plotX, r1(att === 0 ? NaN : totalPts / att), "Pts per shot", null);
    drawMetric(plotX + cardW + 10, r1(attempts2 === 0 ? NaN : (made2 * 2) / attempts2), "2PT pts/shot",
      attempts2 === 0 ? "no attempts" : `${Math.round((attempts2 / att) * 100)}% att, ${Math.round((made2 / attempts2) * 1000) / 10}% made`);
    drawMetric(plotX + 2 * (cardW + 10), r1(attempts3 === 0 ? NaN : (made3 * 3) / attempts3), "3PT pts/shot",
      attempts3 === 0 ? "no attempts" : `${Math.round((attempts3 / att) * 100)}% att, ${Math.round((made3 / attempts3) * 1000) / 10}% made`);

    doc.y = wy + widgetH + 10;
    doc.x = MARGIN;
    if (unlocated > 0) {
      ensureSpace(16);
      doc.font("Helvetica").fontSize(8.5).fillColor(UE_GREY).text(`${unlocated} unlocated shot(s) not charted.`, MARGIN, doc.y, { lineBreak: false });
      doc.moveDown(0.5);
    }
  };

  /** Team Focus insert page (landscape): team-level context dashboard. */
  const drawTeamFocusPage = (tf: TeamFocus): void => {
    const W = doc.page.width - 2 * MARGIN; // usable width on this (landscape) page
    const pageBgY = 56;
    const pageBgH = doc.page.height - pageBgY - FOOTER_BAND_H;
    doc.rect(0, pageBgY, doc.page.width, pageBgH).fill(UE_OFFWHITE);
    doc.y = 68; doc.x = MARGIN;

    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text("Team Focus");
    doc.font("Helvetica").fontSize(9.5).fillColor(UE_GREY)
      .text(`How the team is playing across the ${tf.gamesConsidered} selected game(s)`, { lineGap: 2 });
    doc.moveTo(MARGIN, doc.y + 4).lineTo(MARGIN + W, doc.y + 4).lineWidth(1.2).strokeColor(UE_GREEN).stroke();
    doc.moveDown(0.8).font("Helvetica").fontSize(10.5).fillColor(INK);

    const cardW = (W - 2 * 12) / 3;

    // --- Overview: three synthesis cards (cross-game team insights) ---
    const synthesis = tf.synthesis ?? {
      whatsWorking: tf.summary.whatsWorking,
      focusAreas: tf.summary.focusAreas,
      suggestions: tf.summary.suggestions,
    };
    doc.font("Helvetica-Bold").fontSize(12).fillColor(UE_GREEN).text("Overview").moveDown(0.4);
    const overview = [
      { title: "What's Working", icon: "check" as const, items: synthesis.whatsWorking },
      { title: "Focus Areas", icon: "target" as const, items: synthesis.focusAreas },
      { title: "Suggestions", icon: "bulb" as const, items: synthesis.suggestions },
    ];
    // Card heights from exact wrapped line counts (items capped at 3/card).
    const ovHeights = overview.map((card) => {
      const items = card.items.slice(0, 3);
      let h = 40;
      for (const item of items) h += wrapLines(item, cardW - 20, "Helvetica", 8) * 10 + 6;
      return Math.max(h + 12, 96);
    });
    const ovCardH = Math.max(...ovHeights);
    const ovY = doc.y + 2;
    overview.forEach((card, j) => {
      const x = MARGIN + j * (cardW + 12);
      doc.roundedRect(x, ovY, cardW, ovCardH, 8).fillColor("#FFFFFF").fill().lineWidth(1).strokeColor(CARD_BORDER).stroke();
      const icx = x + 18, icy = ovY + 18;
      if (card.icon === "check") {
        doc.circle(icx, icy, 7).fillColor(UE_GREEN).fill();
        doc.moveTo(icx - 3.2, icy).lineTo(icx - 0.8, icy + 2.8).lineTo(icx + 3.4, icy - 2.8)
          .lineWidth(1.6).strokeColor("#FFFFFF").stroke();
      } else if (card.icon === "target") {
        doc.circle(icx, icy, 7).lineWidth(1.6).strokeColor(UE_GREEN).stroke();
        doc.circle(icx, icy, 2.8).fillColor(UE_GREEN).fill();
      } else {
        doc.circle(icx, icy - 1.5, 5.5).lineWidth(1.6).strokeColor(UE_GREEN).stroke();
        doc.roundedRect(icx - 2.4, icy + 4.5, 4.8, 2.6, 1).fillColor(UE_GREEN).fill();
      }
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK)
        .text(card.title, x + 32, ovY + 13, { width: cardW - 38, lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor("#475569");
      let iy = ovY + 34;
      for (const item of card.items.slice(0, 3)) {
        doc.text(`•  ${item}`, x + 10, iy, { width: cardW - 20, lineGap: 2 });
        iy = doc.y + 6;
      }
      if (card.items.length > 3) {
        doc.font("Helvetica-Oblique").fontSize(7.5).fillColor(UE_GREY)
          .text(`+ ${card.items.length - 3} more in the match insights`, x + 10, ovY + ovCardH - 16, { lineBreak: false });
      }
    });
    doc.y = ovY + ovCardH + 16;
    doc.x = MARGIN;

    // --- A Closer Look: six metric cards (3 x 2), adaptive row heights ---
    // Row height is measured from the exact wrapped line count of the longest
    // description, so full API comments render without truncation or overflow.
    doc.font("Helvetica-Bold").fontSize(12).fillColor(UE_GREEN).text("A Closer Look").moveDown(0.4);
    const gridY = doc.y + 2; // captured once — card text must not drift the grid
    const badgeColours: Record<string, string> = { SUPER: "#1B4D3E", GOOD: UE_GREEN, POOR: MISS_RED };
    const descFont = 8, descLineH = 10;
    const rowH = [0, 1].map((row) => {
      const descs = tf.metrics.slice(row * 3, row * 3 + 3).map((m) => m.description);
      const maxLines = Math.max(...descs.map((d) => wrapLines(d, cardW - 20, "Helvetica", 8)), 2);
      return 58 + maxLines * descLineH + 8;
    }) as [number, number];
    tf.metrics.forEach((m, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = MARGIN + col * (cardW + 12);
      const y = gridY + (row === 0 ? 0 : rowH[0]! + 12);
      const mCardH = row === 0 ? rowH[0]! : rowH[1]!;
      doc.roundedRect(x, y, cardW, mCardH, 8).fillColor("#FFFFFF").fill().lineWidth(1).strokeColor(CARD_BORDER).stroke();
      doc.font("Helvetica-Bold").fontSize(7).fillColor(UE_GREY)
        .text(m.label.toUpperCase(), x + 10, y + 8, { width: cardW - 20, characterSpacing: 0.8, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(20).fillColor(INK)
        .text(m.value, x + 10, y + 20, { lineBreak: false });
      const valueW = doc.widthOfString(m.value);
      const badgeText = m.badge;
      doc.font("Helvetica-Bold").fontSize(7);
      const badgeW = doc.widthOfString(badgeText) + 10;
      const badgeX = x + 10 + valueW + 8;
      doc.roundedRect(badgeX, y + 26, badgeW, 13, 6).fillColor(badgeColours[m.badge] ?? UE_GREEN).fill();
      doc.fillColor("#FFFFFF").text(badgeText, badgeX + 5, y + 29, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(8).fillColor(UE_GREY)
        .text(m.sub.toUpperCase(), x + 10, y + 46, { width: cardW - 20, characterSpacing: 0.5, lineBreak: false });
      doc.font("Helvetica").fontSize(descFont).fillColor("#475569")
        .text(m.description, x + 10, y + 58, { width: cardW - 20, lineGap: 2 });
    });
    doc.y = gridY + rowH[0] + 12 + rowH[1] + 8;
    doc.x = MARGIN;
    if (tf.note) {
      doc.font("Helvetica").fontSize(8.5).fillColor(UE_GREY).text(tf.note, MARGIN, doc.y, { width: USABLE });
      doc.moveDown(0.5);
    }
    homeX();
  };

  // ---------- content ----------
  const s = input.stats;
  const conf = s.confidence;
  const a = s.aggregates;
  const wins = input.games.filter((g) => g.teamScore !== null && g.opponentScore !== null && g.teamScore > g.opponentScore!).length;
  const dates = input.games.map((g) => g.playedAt.slice(0, 10)).sort();
  const first = input.playerName.split(" ")[0] ?? input.playerName;

  // Title band (page 1): green with the WHITE logo, white title text
  const bandHeight = 74;
  const bandY = 44;
  doc.rect(0, bandY, doc.page.width, bandHeight).fill(UE_GREEN);
  const hasBandLogo = typeof input.logoBandPath === "string" && input.logoBandPath.length > 0 && existsSync(input.logoBandPath);
  if (hasBandLogo) {
    try {
      doc.image(input.logoBandPath!, doc.page.width - MARGIN - 92, bandY + 10, { width: 92 });
    } catch { /* a broken logo must never fail the report */ }
  }
  const titleX = MARGIN;
  const titleWidth = doc.page.width - 2 * MARGIN - (hasBandLogo ? 100 : 0);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18)
    .text("Player Development Report", titleX, bandY + 16, { width: titleWidth });
  doc.font("Helvetica").fontSize(10.5).fillColor(UE_OFFWHITE)
    .text(`${input.playerName}${input.jerseyNumber ? ` (#${input.jerseyNumber})` : ""} · ${input.teamName}`, titleX, bandY + 38, { width: titleWidth });
  doc.font("Helvetica").fontSize(9.5).fillColor(UE_OFFWHITE)
    .text(`${dates[0] ?? "?"} – ${dates[dates.length - 1] ?? "?"} · ${input.games.length} game(s) · ${wins} win${wins === 1 ? "" : "s"} · generated ${input.generatedAt.slice(0, 10)}`, titleX, bandY + 54, { width: titleWidth });
  doc.y = bandY + bandHeight + 16;
  doc.x = MARGIN;

  // 1. Overview
  H("1 · Player performance overview");
  P(`${first} played ${input.games.length} game${input.games.length === 1 ? "" : "s"} in this period. That is ${a.pointsPerGame} points per game${a.minutesPerGame === null ? "" : ` in about ${a.minutesPerGame} minutes a game`}. This report shows what is working, what to work on next, and how to measure progress.`);
  P(`Keep this report. Bring it to training. Look at it again after the next few games.`);
  if (input.mode === "mock") P("Note: this demonstration was produced from sample (mock) data, not live Superstat data.");

  // 2. Statistical summary — KPI cards first, details after
  H("2 · Statistical summary", 290);
  const na = "—";
  const minLabel = a.minutesPerGame === null ? na : String(a.minutesPerGame);
  kpiCards([
    { label: "Points / game", value: String(a.pointsPerGame) },
    { label: "Minutes / game", value: minLabel },
    { label: "FG%", value: a.fgPct === null ? na : `${a.fgPct}%`, low: conf.fieldGoal.low },
    { label: "3P%", value: a.threePct === null ? na : `${a.threePct}%`, low: conf.threePoint.low },
    { label: "FT%", value: a.ftPct === null ? na : `${a.ftPct}%`, low: conf.freeThrow.low },
    { label: "Effective FG%", value: a.effectiveFgPct === null ? na : `${a.effectiveFgPct}%` },
    { label: "True shooting", value: a.trueShootingPct === null ? na : `${a.trueShootingPct}%` },
    { label: "Points / shot", value: a.pointsPerFga === null ? na : String(a.pointsPerFga) },
    { label: "Assists / game", value: String(a.assistsPerGame) },
    { label: "Turnovers / game", value: String(a.turnoversPerGame) },
    { label: "Assist : turnover", value: a.assistToTurnover === null ? na : String(a.assistToTurnover), low: conf.assistTurnover.low },
    { label: "Rebounds / game", value: String(a.reboundsPerGame) },
    { label: "Steals / game", value: String(a.stealsPerGame) },
    { label: "Blocks / game", value: String(a.blocksPerGame) },
    { label: "Scoring steadiness", value: String(s.consistency.points.coefficientOfVariation) },
  ]);
  KV([
    ["Minutes note", a.minutesPerGame === null ? "minutes were not tracked" : s.aggregates.minutesMissingGames > 0 ? `${s.aggregates.minutesMissingGames} game(s) untracked` : "tracked in every game"],
    ["Steadiness", "0 = same every game; higher = bigger swings"],
    ["Effective FG%", "counts three-pointers as 1.5 makes"],
    ["True shooting", "all shots and free throws combined"],
  ]);

  // 3 & 4. Strengths and weaknesses (from AI findings + evidence facts)
  const ai = input.ai;
  const factFor = (f: { citation: string }): string[] =>
    f.citation.split(";").map((k) => k.trim()).map((k) => ai?.citations[k]).filter((v): v is string => typeof v === "string");
  const strengths = (ai?.findings ?? []).filter((f) => /healthy|solid|above|efficiently|reliable|active|good/i.test(f.claim));
  const weaknesses = (ai?.findings ?? []).filter((f) => !/healthy|solid|above|efficiently|reliable|active|good/i.test(f.claim));
  H("3 · Identified strengths");
  if (strengths.length === 0) P("Not enough positive signals in this sample yet — strengths often appear clearly once five or more games are included.");
  else for (const f of strengths) { finding(f.claim, f.confidence); const facts = factFor(f); if (facts.length > 0) B(facts.map((x) => `Evidence: ${x}`)); }
  H("4 · Identified weaknesses");
  if (weaknesses.length === 0) P("No clear weaknesses identified in this sample — keep building on the strengths above.");
  else for (const f of weaknesses) { finding(f.claim, f.confidence); const facts = factFor(f); if (facts.length > 0) B(facts.map((x) => `Evidence: ${x}`)); }

  // 5. Scoring and shot selection (+ shot-chart widget)
  const fmtPct = (v: number | null): string => (v === null ? "n/a" : `${v}%`);
  H("5 · Scoring and shot selection", 430);
  P(`Field goals: ${fmtPct(a.fgPct)}. Threes: ${fmtPct(a.threePct)}. Free throws: ${fmtPct(a.ftPct)}.`);
  P(`Points per shot: ${a.pointsPerFga ?? "n/a"}. True shooting: ${fmtPct(a.trueShootingPct)} (this counts all shots and free throws together).`);
  P("Where the shots came from (approximate court zones):");
  B(s.shootingZones.zones.map((z) => `${z.zone}: ${z.attempts} attempts, ${z.made} made (${z.pctOfAttempts}% of all attempts)`).concat(s.shootingZones.unlocatedAttempts > 0 ? [`Unlocated attempts: ${s.shootingZones.unlocatedAttempts}`] : []));
  drawShotChartWidget(input.shotEvents ?? [], s.shootingZones.unlocatedAttempts);

  // 6. Turnover and playmaking
  H("6 · Turnover and playmaking analysis");
  P(`${first} gets ${a.assistsPerGame} assists per game and loses the ball ${a.turnoversPerGame} times per game.`);
  P(a.assistToTurnover === null ? "No turnovers were recorded, so there is no ratio to show." : `That is ${a.assistToTurnover} assists for every turnover. The goal at this age is 1.0 or better.`);
  P("The play-by-play was checked for this report. Quarter-by-quarter patterns appear in section 8.");

  // 7. Defensive contribution
  H("7 · Defensive contribution");
  P(`Rebounds: ${a.reboundsPerGame} per game. Steals: ${a.stealsPerGame}. Blocks: ${a.blocksPerGame}.`);
  P("This report only counts recorded events. Where you stood, and who you guarded, is not in the data.");

  // 8. Superstat AI insight review
  H("8 · Superstat AI insight review");
  if (ai === null) P("No AI analysis available for this snapshot.");
  else {
    P(`Analysis provider: ${ai.providerId}.${ai.note ? ` Note: ${ai.note}` : ""}`);
    for (const f of ai.findings) {
      finding(f.claim, f.confidence);
      const facts = factFor(f);
      if (facts.length > 0) B(facts.map((x) => `Evidence: ${x}`));
    }
  }

  // 9. Three development priorities
  H("9 · Three development priorities", 320);
  input.priorities.forEach((p, i) => {
    ensureSpace(120);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(UE_GREEN).text(`${i + 1}. ${p.area}`).moveDown(0.15);
    homeX();
    P(`What we see: ${p.weakness}`);
    if (p.evidenceFacts.length > 0) B(p.evidenceFacts.map((x) => `Evidence: ${x}`));
    P(`Why it matters: ${p.whyItMatters}`);
    P("What to do:");
    B(p.recommendations);
    P(`How we measure it: ${p.measure}`);
    P(`When to check again: ${p.reassessment}`);
    doc.moveDown(0.2);
  });

  // 10. Recommended improvement measurements
  H("10 · Recommended improvement measurements");
  B(input.priorities.map((p) => `${p.area}: ${p.measure}`));
  P("Keep this report with your season notes and bring it to each game. The measurements above are what we re-check next time.");

  // 11. Data limitations and confidence
  H("11 · Data limitations and confidence assessment");
  const limits: string[] = [];
  if (s.confidence.overall.low) limits.push(`Only ${s.gamesUsed} game(s) are included — treat the findings as a starting point, not proof.`);
  const anyCardLow = conf.fieldGoal.low || conf.threePoint.low || conf.freeThrow.low || conf.assistTurnover.low;
  if (anyCardLow) limits.push("Metrics marked † on the summary cards have too few attempts to judge yet:");
  for (const [name, c] of Object.entries({ "Field-goal %": s.confidence.fieldGoal, "Three-point %": s.confidence.threePoint, "Free-throw %": s.confidence.freeThrow, "Assist-to-turnover": s.confidence.assistTurnover })) {
    if (c.low) limits.push(`${name}: too few attempts to judge yet (${c.reason.replace(/ \(minimum \d+\)/u, "")}).`);
  }
  if (s.shootingZones.approximate) limits.push("Shot zones and the shot chart are close estimates, drawn from the recorded court positions.");
  if (s.aggregates.minutesMissingGames > 0) limits.push(`${s.aggregates.minutesMissingGames} game(s) had no minutes recorded.`);
  const requested = (s as PlayerStats & { requestedGames?: number }).requestedGames;
  if (requested !== undefined && requested > s.gamesUsed) {
    limits.push(`${requested - s.gamesUsed} selected game(s) had no usable box-score data and were left out of the numbers.`);
  }
  limits.push(s.validation.checked === 0 ? "Our numbers could not be re-checked against Superstat's own box scores." : `We re-checked our numbers against Superstat's own box scores for ${s.validation.checked} game(s). ${s.validation.mismatches.length > 0 ? `${s.validation.mismatches.length} did not match (noted in the report data).` : "All matched."}`);
  if (input.mode === "mock") limits.push("This report uses sample data because no Superstat API key was set up yet.");
  if (limits.length === 0) limits.push("No significant limitations in this selection.");
  B(limits);

  // Team Focus page LAST (team-level context; unnumbered so the plan's section
  // numbering stays intact) — included in every player's report. Landscape:
  // the dashboard cards breathe across the wider, shorter page.
  if (input.teamFocus) {
    doc.addPage({
      size: "A4", layout: "landscape",
      margins: { top: 56, bottom: 40, left: MARGIN, right: MARGIN },
    });
    drawTeamFocusPage(input.teamFocus);
  }

  doc.end();
  });
}

/** Stamp the footer band on every page with pdf-lib (robust across pdfkit versions). */
async function stampFooter(bytes: Buffer, input: ReportPdfInput): Promise<Buffer> {
  const pdf = await PdfLibDoc.load(bytes);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const white = rgb(1, 1, 1);
  const offwhite = rgb(0xf4 / 255, 0xf5 / 255, 0xf4 / 255);
  const green = rgb(0x1e / 255, 0x5a / 255, 0x38 / 255);
  const pages = pdf.getPages();
  pages.forEach((page, idx) => {
    const { width } = page.getSize();
    page.drawRectangle({ x: 0, y: 0, width, height: FOOTER_BAND_H, color: green });
    // Measured placement with guaranteed gaps: brand left, privacy centred in
    // the space BETWEEN brand and page label, page label right-aligned.
    const brand = "UNION ELITE";
    const brandW = bold.widthOfTextAtSize(brand, 8.5);
    page.drawText(brand, { x: MARGIN, y: 10, size: 8.5, font: bold, color: white });
    const label = `Generated ${input.generatedAt.slice(0, 10)} · Page ${idx + 1} of ${pages.length}`;
    const labelW = regular.widthOfTextAtSize(label, 8);
    const labelX = width - MARGIN - labelW;
    const privacy = "Private coaching document — player development only";
    const privacyW = regular.widthOfTextAtSize(privacy, 8);
    const gap = 14;
    const freeStart = MARGIN + brandW + gap;
    const freeEnd = labelX - gap;
    const privacyX = freeStart + (freeEnd - freeStart - privacyW) / 2;
    page.drawText(privacy, { x: privacyX, y: 10.5, size: 8, font: regular, color: offwhite });
    page.drawText(label, { x: labelX, y: 10.5, size: 8, font: regular, color: offwhite });
  });
  return Buffer.from(await pdf.save());
}

/**
 * Content pages come from pdfkit; the footer band is stamped afterwards with
 * pdf-lib, which also supplies the true page count for "Page i of N".
 */
export async function generateReportPdf(input: ReportPdfInput): Promise<void> {
  mkdirSync(dirname(input.outPath), { recursive: true });
  const { buffer } = await buildContentBuffer(input);
  const stamped = await stampFooter(buffer, input);
  writeFileSync(input.outPath, stamped);
}

export function pdfExists(path: string): boolean {
  return existsSync(path);
}
