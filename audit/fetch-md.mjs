// Fetch the per-endpoint markdown pages (and API-key articles) listed in llms.txt
// into audit/md/ as plain markdown files.
import fs from 'node:fs';
import path from 'node:path';

const base = 'https://help.superstatsport.com';
const pages = [
  'docs/api-reference/teams/get-a-team',
  'docs/api-reference/teams/list-the-team-roster',
  'docs/api-reference/matches/list-a-team-s-matches',
  'docs/api-reference/matches/get-a-match',
  'docs/api-reference/matches/get-the-box-score',
  'docs/api-reference/matches/list-play-by-play-events',
  'docs/api-reference/insights/get-team-insights',
  'docs/api-reference/insights/get-player-insights',
  'docs/api-reference/insights/generate-team-insights',
  'docs/api-reference/insights/generate-player-insights',
  'docs/account-and-support/create-and-manage-a-club-api-key',
  'docs/account-and-support/create-and-manage-api-keys',
];

const dir = path.join(process.cwd(), 'audit', 'md');
fs.mkdirSync(dir, { recursive: true });

for (const p of pages) {
  const url = `${base}/${p}.md`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) {
      console.log(res.status, 'FAIL', p);
      continue;
    }
    const body = await res.text();
    const name = p.replaceAll('/', '_') + '.md';
    fs.writeFileSync(path.join(dir, name), body);
    console.log(res.status, String(body.length).padStart(7), name);
  } catch (e) {
    console.log('ERR', p, e.message);
  }
}
