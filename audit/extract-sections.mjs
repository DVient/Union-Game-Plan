// Extract the endpoint sections we still need from the llms-full docs dump
// into a compact file: audit/api-endpoint-details.md
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.join(process.cwd(), 'audit', 'raw', 'specllms-full.txt'), 'utf8');
const lines = src.split('\n');

// Split into (heading, body) sections by markdown headings.
const sections = [];
let current = null;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^(#{2,5})\s+(.*)$/);
  if (m) {
    if (current) current.end = i;
    current = { level: m[1].length, title: m[2], start: i, end: lines.length };
    sections.push(current);
  }
}

const wanted = [
  'List the team roster',
  'List a team',
  'Get a match',
  'Get the box score',
  'List play-by-play events',
  'Get team insights',
  'Get player insights',
  'Generate team insights',
  'Generate player insights',
];

const out = [];
for (const s of sections) {
  if (s.level !== 3) continue; // ### endpoint headings in the API part
  if (!wanted.some((w) => s.title.startsWith(w))) continue;
  const body = lines.slice(s.start, s.end).join('\n');
  out.push(body.trimEnd());
}

fs.writeFileSync(
  path.join(process.cwd(), 'audit', 'api-endpoint-details.md'),
  out.join('\n\n---\n\n') + '\n',
);
console.log('sections extracted:', out.length);
for (const s of sections.filter((x) => x.level === 3 && wanted.some((w) => x.title.startsWith(w)))) {
  console.log(' -', s.title, '(line', s.start + 1 + ')');
}
