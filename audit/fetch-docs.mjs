// Stage 1 audit utility: fetch a help.superstatsport.com docs page and extract
// the embedded page payload (Next.js RSC) into plain text for analysis.
// Usage: node audit/fetch-docs.mjs <slug>   e.g. docs/api-reference
import fs from 'node:fs';
import path from 'node:path';

const slug = process.argv[2] || 'docs/api-reference';
const url = 'https://help.superstatsport.com/' + slug;
const dir = path.join(process.cwd(), 'audit', 'raw');
fs.mkdirSync(dir, { recursive: true });
const name = slug.replace(/[^a-z0-9]+/gi, '_');

const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
console.log('URL:', url, '-> HTTP', res.status);
if (!res.ok) {
  console.error('Fetch failed with status', res.status);
  process.exit(1);
}
const html = await res.text();
fs.writeFileSync(path.join(dir, name + '.html'), html);

// Extract concatenated RSC payload chunks and decode their string escapes.
const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
let m, out = '';
while ((m = re.exec(html))) {
  try { out += JSON.parse('"' + m[1] + '"'); } catch { /* skip malformed chunk */ }
}
fs.writeFileSync(path.join(dir, name + '.rsc.txt'), out);
console.log('HTML bytes:', html.length, '| extracted payload bytes:', out.length);

// Internal doc slugs referenced by the page (nav tree / links).
const slugs = new Set();
for (const hit of out.matchAll(/"slug":"([^"\s]{2,80})"/g)) slugs.add(hit[1]);
for (const hit of out.matchAll(/href="(\/docs\/[^"#?]+)"/g)) slugs.add(hit[1].replace(/^\/docs\//, 'docs/'));
console.log('--- referenced doc slugs ---');
console.log([...slugs].slice(0, 100).join('\n') || '(none found)');

// Quick keyword census over the payload.
const lower = out.toLowerCase();
const kws = ['api key', 'authentication', 'authorization', 'endpoint', 'box score', 'play-by-play',
  'play by play', 'insight', 'roster', 'club', 'match', 'team', 'player', 'rate limit', '/v1', 'webhook'];
console.log('--- keyword counts ---');
for (const k of kws) {
  const c = lower.split(k).length - 1;
  if (c) console.log(k + ': ' + c);
}
