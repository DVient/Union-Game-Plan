// Selection UI logic (plan §6). Vanilla JS — no build step, no framework.
const $ = (id) => document.getElementById(id);
let state = null;

async function refresh() {
  state = await (await fetch("/api/state")).json();
  const banner = $("modeBanner");
  if (state.mockMode) {
    banner.hidden = false;
    banner.textContent = "Running with sample data (mock mode). Add the Superstat club API key to switch to live data.";
  } else {
    banner.hidden = true;
  }
  $("lastSync").textContent = state.lastSync ? `Last sync: ${new Date(state.lastSync).toLocaleString()}` : "Not synced yet.";
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

async function deletePlayerData() {
  const playerSel = $("playerSelect");
  const chosen = playerSel.selectedOptions[0];
  if (!chosen || !confirm(`Permanently delete this player's stats, insights and saved reports from this PC? This cannot be undone.`)) return;
  const r = await (await fetch(`/api/players/${chosen.value}`, { method: "DELETE" })).json();
  if (r.error) { alert(r.error); return; }
  alert(`Deleted data for ${r.deleted}: ${r.reportsRemoved} report(s), ${r.pdfsRemoved} PDF file(s).`);
  await refresh();
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
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = true; cb.value = m.id; cb.dataset.matchId = m.id;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(
      ` ${new Date(m.playedAt).toLocaleDateString()} vs ${m.opponentName} (${m.teamScore}–${m.opponentScore ?? "?"})`));
    box.appendChild(label);
  });
  if (complete.length === 0) box.innerHTML = '<span class="muted">No completed games yet — sync first.</span>';
  $("generateBtn").disabled = ![...box.querySelectorAll("input:checked")].length || !$("playerSelect").value;
}

async function doSync() {
  $("syncBtn").disabled = true;
  const r = await (await fetch("/api/sync", { method: "POST" })).json();
  $("syncBtn").disabled = false;
  const el = $("syncResult");
  el.hidden = false;
  el.textContent = `Synced (${r.mode}): ${r.teams} teams, ${r.players} players, ${r.matches} matches, ${r.boxScores} box scores` +
    (r.notes?.length ? ` — notes: ${r.notes.join("; ")}` : "");
  await refresh();
}

async function doGenerate() {
  const matchIds = [...document.querySelectorAll("#games input:checked")].map((c) => c.value);
  const body = { playerId: $("playerSelect").value, matchIds };
  const r = await (await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  const el = $("reportMsg");
  el.hidden = false;
  if (!r.id) { el.textContent = `Error: ${r.error}`; return; }
  el.textContent = `Report snapshot ${r.id} recorded.`;
  const dl = $("downloadBtn");
  dl.hidden = false;
  dl.onclick = () => { window.open(`/api/reports/${r.id}/pdf`, "_blank"); };
  renderStats(r.stats, r.ai);
  await loadReports();
}

function renderStats(stats, ai) {
  if (!stats) return;
  $("statsView").hidden = false;
  const flags = Object.entries(stats.confidence).filter(([, c]) => c.low);
  $("confidenceFlags").innerHTML = flags.length
    ? flags.map(([k, c]) => `<div class="banner warn">⚠ ${c.reason}</div>`).join("")
    : '<div class="banner ok">Sample sizes are sufficient for every metric.</div>';
  const a = stats.aggregates;
  const rows = [
    ["Points per game", a.pointsPerGame], ["Minutes per game", a.minutesPerGame ?? "n/a (minutes not tracked)"],
    ["FG%", a.fgPct ?? "n/a"], ["3P%", a.threePct ?? "n/a"], ["FT%", a.ftPct ?? "n/a"],
    ["Effective FG%", a.effectiveFgPct ?? "n/a"], ["True Shooting %", a.trueShootingPct ?? "n/a"],
    ["Points per FGA", a.pointsPerFga ?? "n/a"], ["Assists per game", a.assistsPerGame],
    ["Turnovers per game", a.turnoversPerGame], ["Assist-to-turnover", a.assistToTurnover ?? "n/a"],
    ["Rebounds per game", a.reboundsPerGame], ["Steals per game", a.stealsPerGame], ["Blocks per game", a.blocksPerGame],
    ["Points consistency (CV)", `${stats.consistency.points.coefficientOfVariation} (σ ${stats.consistency.points.stdev})`],
  ];
  $("aggBody").innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
  $("zoneList").innerHTML =
    stats.shootingZones.zones.map((z) => `<li>${z.zone}: ${z.attempts} attempts (${z.pctOfAttempts}% of all attempts), ${z.made} made</li>`).join("") +
    `<li>Unlocated shot attempts: ${stats.shootingZones.unlocatedAttempts}</li>`;
  $("gameBody").innerHTML = stats.games.map((g) =>
    `<tr><td>${new Date(g.playedAt).toLocaleDateString()}</td><td>${g.opponentName}</td><td>${g.points}</td><td>${g.minutes ?? "—"}</td><td>${g.fgPct}</td><td>${g.threePct}</td><td>${g.ftPct}</td><td>${g.effectiveFgPct}</td><td>${g.trueShootingPct}</td><td>${g.assists}</td><td>${g.turnovers}</td><td>${g.rebounds}</td></tr>`).join("");
  $("validationNote").textContent = stats.validation.mismatches.length
    ? `Validation: ${stats.validation.mismatches.length} mismatch(es) vs Superstat box scores: ${stats.validation.mismatches.join("; ")}`
    : `Validation: ${stats.validation.checked} game(s) cross-checked against Superstat's box scores — all consistent.`;
  if (ai) renderAi(ai);
}

function renderAi(ai) {
  $("aiProvider").textContent = `— provider: ${ai.providerId}`;
  $("aiNote").innerHTML = ai.note ? `<div class="banner warn">${ai.note}</div>` : "";
  const badge = { confirmed: "✓ confirmed", possible: "~ possible", unverified: "? unverified" };
  $("aiFindings").innerHTML = (ai.findings ?? []).map((f) =>
    `<li>[${f.category}] ${f.claim} <span class="muted">(${badge[f.confidence] ?? f.confidence}; evidence: ${f.citation})</span></li>`).join("")
    || "<li class=\"muted\">No findings produced.</li>";
}

async function loadReports() {
  const reports = await (await fetch("/api/reports")).json();
  $("reports").innerHTML = reports.map((r) =>
    `<li>${new Date(r.createdAt).toLocaleString()} — <a href="/api/reports/${r.id}/pdf" target="_blank">${r.firstName} ${r.lastName} (PDF)</a></li>`).join("")
    || "<li class=\"muted\">No reports yet.</li>";
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
  $("compareSample").textContent = c.sampleNote ?? "";
  const trendMark = { improved: "▲ improved", declined: "▼ declined", unchanged: "— unchanged", "n/a": "· n/a" };
  $("compareBody").innerHTML = c.metrics.map((m) =>
    `<tr><td>${m.metric}</td><td>${m.prev ?? "n/a"}</td><td>${m.curr ?? "n/a"}</td><td>${m.delta ?? "n/a"}</td><td>${trendMark[m.trend]}</td></tr>`).join("");
  $("comparePriorities").innerHTML =
    `<div class="banner ok">Carried over: ${c.priorities.carriedOver.join(", ") || "—"}</div>` +
    `<div class="banner warn">New focus: ${c.priorities.newFocus.join(", ") || "—"}</div>` +
    `<div class="banner ok">Previously flagged, no longer prioritised: ${c.priorities.dropped.join(", ") || "—"}</div>`;
}

$("compareBtn").addEventListener("click", doCompare);

$("teamSelect").addEventListener("change", renderPlayers);
$("playerSelect").addEventListener("change", renderGames);
$("deletePlayerBtn").addEventListener("click", deletePlayerData);
$("gamePresets").addEventListener("change", renderGames);
$("games").addEventListener("change", renderGames);
$("syncBtn").addEventListener("click", doSync);
$("generateBtn").addEventListener("click", doGenerate);

refresh().catch((e) => {
  $("modeBanner").hidden = false;
  $("modeBanner").textContent = `Failed to load app state: ${e.message}`;
});
loadReports();
