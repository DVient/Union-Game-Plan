// Normalize escaped newlines/tabs in extracted RSC payloads so the content
// becomes greppable/readable. Reads audit/raw/*.rsc.txt -> *.pretty.txt
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'audit', 'raw');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.rsc.txt'))) {
  let t = fs.readFileSync(path.join(dir, f), 'utf8');
  t = t.split('\\n').join('\n').split('\\t').join('  ');
  fs.writeFileSync(path.join(dir, f.replace('.rsc.txt', '.pretty.txt')), t);
  console.log(f, '->', t.length, 'chars');
}
