// Union GamePlan UI logic — vanilla JS, same API contract as the report layer.
const $ = (id) => document.getElementById(id);
let state = null;

function setChip(el, cls, html) {
  el.className = `chip ${cls}`;
  el.innerHTML = html;
}

async function refresh() {
  state = await (await fetch("/api/state")).json();
  const banner = $("modeBanner");
  const modeChip = $("modeChip");
  if (state.mockMode) {
    banner.hidden = false;
    banner.textContent = "Running with sample data (mock mode). Add the Superstat club API key to switch to live data.";
    setChip(modeChip, "mock", `<span class="dot"></span>SAMPLE DATA`);
  } else {
    banner.hidden = true;
    setChip(modeChip, "live", `<span class="dot"></span>LIVE`);
  }
  updateSyncChip(null);
  const teamSel = $("teamSelect");
  teamSel.innerHTML = "";
  for (const t of state.teams) {
    const o = document.createElement("option");
    o.value = t.id; o.textContent = `${t.name} (${t.ageGroup ?? ""})`;
    teamSel.appendChild(o);
  }
  teamSel.disabled = state.teams.length === 0;
  renderPlayers();
}

function updateSyncChip(spinning) {
  const chip = $("syncStatus");
  if (spinning) { setChip(chip, "", `<span class="spin"></span>Syncing…`); return; }
  chip.innerHTML = state.lastSync
    ? `<span class="dot" style="background:var(--green-600)"></span>Synced ${new Date(state.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : `<span class="dot"></span>Not synced`;
}

function renderPlayers() {
  const teamId = $("teamSelect").value;
  const playerSel = $("playerSelect");
  playerSel.innerHTML = "";
  const players = state.players.filter((p) => p.teamId === teamId);
  for (const p of players) {
    const o = document.createElement("option");
    o.value = p.id; o.textContent = `#${p.jerseyNumber} ${p.firstName} ${p.lastName}`;
    playerSel.appendChild(o);
  }
  playerSel.disabled = players.length === 0;
  $("deletePlayerBtn").hidden = players.length === 0;
  renderGames();
}

function renderGames() {
  const teamId = $("teamSelect").value;
  const complete = state.matches.filter((m) => m.teamId === teamId && m.status === "complete");
  const preset = document.querySelector('input[name="preset"]:checked')?.value ?? "5";
  const count = preset === "all" ? complete.length : Math.min(Number(preset), complete.length);
  const box = $("games");
  box.innerHTML = "";
  complete.slice(0, count).forEach((m) => {
    const label = document.createElement("label");
    label.className = "tile";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = true; cb.value = m.id;
    const check = document.createElement("span");
    check.className = "tile-check"; check.textContent = "✓";
    const date = document.createElement("div");
    date.className = "tile-date";
    date.textContent = new Date(m.playedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    const opp = document.createElement("div");
    opp.className = "tile-opp"; opp.textContent = `vs ${m.opponentName}`;
    const score = document.createElement("div");
    score.className = "tile-score"; score.textContent = `${m.teamScore}–${m.opponentScore ?? "?"}`;
    label.append(cb, check, date, opp, score);
    box.appendChild(label);
  });
  if (complete.length === 0) {
    box.innerHTML = `<div class="banner info" style="margin:0">No completed games yet — sync first.</div>`;
  }
  $("generateBtn").disabled = ![...box.querySelectorAll("input:checked")].length || !$("playerSelect").value;
}

async function doSync() {
  const btn = $("syncBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span>Syncing…`;
  updateSyncChip(true);
  const r = await (await fetch("/api/sync", { method: "POST" })).json();
  btn.disabled = false;
  btn.textContent = "Sync now";
  const el = $("syncResult");
  el.hidden = false;
  el.textContent = `Synced (${r.mode}): ${r.teams} teams, ${r.players} players, ${r.matches} matches, ${r.boxScores} box scores` +
    (r.notes?.length ? ` — notes: ${r.notes.join("; ")}` : "");
  await refresh();
}

async function doGenerate() {
  const matchIds = [...document.querySelectorAll("#games input:checked")].map((c) => c.value);
  const body = { playerId: $("playerSelect").value, matchIds };
  const btn = $("generateBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span>Generating…`;
  const r = await (await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  btn.disabled = false;
  btn.textContent = "Generate report";
  const el = $("reportMsg");
  el.hidden = false;
  if (!r.id) { el.textContent = `Error: ${r.error}`; return; }
  el.textContent = `Report snapshot ${r.id.slice(0, 8)} created.`;
  const dl = $("downloadBtn");
  dl.hidden = false;
  dl.onclick = () => { window.open(`/api/reports/${r.id}/pdf`, "_blank"); };
  renderStats(r.stats, r.ai);
  await loadReports();
}

function confidenceLow(stats, key) { return stats.confidence[key] ? stats.confidence[key].low : false; }

function renderStats(stats, ai) {
  if (!stats) return;
  $("statsView").hidden = false;
  const flags = Object.entries(stats.confidence).filter(([, c]) => c.low);
  $("confidenceFlags").innerHTML = flags.length
    ? flags.map(([k, c]) => `<div class="banner warn">⚠ ${c.reason}</div>`).join("")
    : `<div class="banner ok">Sample sizes are sufficient for every metric.</div>`;

  const a = stats.aggregates;
  const cards = [
    ["Points / game", String(a.pointsPerGame)],
    ["Minutes / game", a.minutesPerGame === null ? "—" : String(a.minutesPerGame)],
    ["FG%", a.fgPct === null ? "—" : `${a.fgPct}%`, confidenceLow(stats, "fieldGoal")],
    ["3P%", a.threePct === null ? "—" : `${a.threePct}%`, confidenceLow(stats, "threePoint")],
    ["FT%", a.ftPct === null ? "—" : `${a.ftPct}%`, confidenceLow(stats, "freeThrow")],
    ["Effective FG%", a.effectiveFgPct === null ? "—" : `${a.effectiveFgPct}%`],
    ["True shooting", a.trueShootingPct === null ? "—" : `${a.trueShootingPct}%`],
    ["Points / shot", a.pointsPerFga === null ? "—" : String(a.pointsPerFga)],
    ["Assists / game", String(a.assistsPerGame)],
    ["Turnovers / game", String(a.turnoversPerGame)],
    ["Assist : turnover", a.assistToTurnover === null ? "—" : String(a.assistToTurnover), confidenceLow(stats, "assistTurnover")],
    ["Rebounds / game", String(a.reboundsPerGame)],
    ["Steals / game", String(a.stealsPerGame)],
    ["Blocks / game", String(a.blocksPerGame)],
    ["Scoring steadiness", String(stats.consistency.points.coefficientOfVariation)],
  ];
  $("kpiGrid").innerHTML = cards.map(([label, value, low]) =>
    `<div class="kpi"><div class="k-label">${label}</div><div class="k-value">${value}${low ? ' <span class="dag">†</span>' : ""}</div></div>`).join("");

  $("zoneList").innerHTML =
    stats.shootingZones.zones.map((z) => `<li>${z.zone}: <strong>${z.attempts}</strong> attempts, ${z.made} made (${z.pctOfAttempts}%)</li>`).join("") +
    (stats.shootingZones.unlocatedAttempts > 0 ? `<li>Unlocated attempts: ${stats.shootingZones.unlocatedAttempts}</li>` : "");

  $("gameBody").innerHTML = stats.games.map((g) =>
    `<tr><td>${new Date(g.playedAt).toLocaleDateString()}</td><td>${g.opponentName}</td><td><strong>${g.points}</strong></td><td>${g.minutes ?? "—"}</td><td>${g.fgPct}%</td><td>${g.threePct}%</td><td>${g.ftPct}%</td><td>${g.effectiveFgPct}%</td><td>${g.trueShootingPct}%</td><td>${g.assists}</td><td>${g.turnovers}</td><td>${g.rebounds}</td></tr>`).join("");

  $("validationNote").textContent = stats.validation.mismatches.length
    ? `Validation: ${stats.validation.mismatches.length} mismatch(es) vs Superstat box scores: ${stats.validation.mismatches.join("; ")}`
    : `Validation: ${stats.validation.checked} game(s) cross-checked against Superstat's box scores — all consistent.`;

  if (ai) renderAi(ai);
}

function renderAi(ai) {
  $("aiProvider").textContent = `— provider: ${ai.providerId}`;
  $("aiNote").innerHTML = ai.note ? `<div class="banner warn">${ai.note}</div>` : "";
  $("aiFindings").innerHTML = (ai.findings ?? []).map((f) => {
    const facts = (f.citation || "").split(";").map((s) => s.trim()).filter(Boolean);
    return `<div class="finding">
      <span class="f-dot ${f.confidence}"></span>
      <div class="f-body">
        <div class="f-claim">${f.claim}</div>
        <div class="f-meta">${f.confidence} · ${f.category}</div>
        ${facts.length ? `<details><summary>Show evidence</summary><div class="f-evidence">${facts.map((x) => `• ${x}`).join("<br>")}</div></details>` : ""}
      </div>
    </div>`;
  }).join("") || `<div class="muted">No findings produced.</div>`;
}

async function loadReports() {
  const reports = await (await fetch("/api/reports")).json();
  const pdfIcon = `<svg class="r-icon" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5.2L13 5.3v9.2a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8V2.3a.8.8 0 0 1 .8-.8z" stroke="currentColor"/><path d="M9 1.5V5h3.6" stroke="currentColor"/><text x="4.2" y="12.6" font-size="5.2" font-weight="700" fill="currentColor" font-family="inherit">PDF</text></svg>`;
  $("reports").innerHTML = reports.map((r) =>
    `<div class="report-row"><span class="r-date">${new Date(r.createdAt).toLocaleString()}</span>${pdfIcon}<a href="/api/reports/${r.id}/pdf" target="_blank">${r.firstName} ${r.lastName}</a><span class="muted" style="font-size:12px">PDF report</span></div>`).join("")
    || `<div class="muted">No reports yet — generate one above.</div>`;
  const options = reports.map((r) => `<option value="${r.id}">${new Date(r.createdAt).toLocaleString()} — ${r.firstName} ${r.lastName}</option>`).join("");
  $("compareA").innerHTML = options; $("compareB").innerHTML = options;
  if (reports.length >= 2) { $("compareA").selectedIndex = Math.min(1, reports.length - 1); $("compareB").selectedIndex = 0; }
  $("compareBtn").disabled = reports.length < 2;
}

async function doCompare() {
  const a = $("compareA").value, b = $("compareB").value;
  const c = await (await fetch(`/api/compare?a=${a}&b=${b}`)).json();
  if (c.error) { $("compareView").hidden = true; alert(c.error); return; }
  $("compareView").hidden = false;
  const sample = $("compareSample");
  sample.hidden = !c.sampleNote;
  sample.textContent = c.sampleNote ?? "";
  const trendMark = {
    improved: `<span class="trend-up">▲ improved</span>`,
    declined: `<span class="trend-down">▼ declined</span>`,
    unchanged: `<span class="trend-flat">— unchanged</span>`,
    "n/a": `<span class="trend-flat">· n/a</span>`,
  };
  $("compareBody").innerHTML = c.metrics.map((m) =>
    `<tr><td>${m.metric}</td><td>${m.prev ?? "n/a"}</td><td>${m.curr ?? "n/a"}</td><td>${m.delta ?? "n/a"}</td><td>${trendMark[m.trend]}</td></tr>`).join("");
  $("comparePriorities").innerHTML =
    `<div class="banner ok">Carried over: ${c.priorities.carriedOver.join(", ") || "—"}</div>` +
    `<div class="banner warn">New focus: ${c.priorities.newFocus.join(", ") || "—"}</div>` +
    `<div class="banner ok">Previously flagged, no longer prioritised: ${c.priorities.dropped.join(", ") || "—"}</div>`;
}

async function deletePlayerData() {
  const playerSel = $("playerSelect");
  const chosen = playerSel.selectedOptions[0];
  if (!chosen || !confirm(`Permanently delete this player's stats, insights and saved reports from this PC? This cannot be undone.`)) return;
  const r = await (await fetch(`/api/players/${chosen.value}`, { method: "DELETE" })).json();
  if (r.error) { alert(r.error); return; }
  alert(`Deleted data for ${r.deleted}: ${r.reportsRemoved} report(s), ${r.pdfsRemoved} PDF file(s).`);
  await refresh();
}

$("teamSelect").addEventListener("change", renderPlayers);
$("playerSelect").addEventListener("change", renderGames);
$("gamePresets").addEventListener("change", renderGames);
$("games").addEventListener("change", renderGames);
$("syncBtn").addEventListener("click", doSync);
$("generateBtn").addEventListener("click", doGenerate);
$("deletePlayerBtn").addEventListener("click", deletePlayerData);
$("compareBtn").addEventListener("click", doCompare);

refresh().catch((e) => {
  $("modeBanner").hidden = false;
  $("modeBanner").textContent = `Failed to load app state: ${e.message}`;
});
loadReports();
