// Probe help.superstatsport.com for machine-readable spec files (OpenAPI, llms.txt).
import fs from 'node:fs';
import path from 'node:path';

const base = 'https://help.superstatsport.com';
const candidates = [
  '/openapi.json',
  '/openapi.yaml',
  '/api/openapi.json',
  '/docs/api-reference/openapi.json',
  '/api/reference/openapi.json',
  '/llms.txt',
  '/llms-full.txt',
  '/docs/llms.txt',
  '/docs/llms-full.txt',
];

const dir = path.join(process.cwd(), 'audit', 'raw');
fs.mkdirSync(dir, { recursive: true });

for (const c of candidates) {
  try {
    const res = await fetch(base + c, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, redirect: 'follow' });
    const type = res.headers.get('content-type') || '';
    const size = Number(res.headers.get('content-length') || 0);
    console.log(res.status, String(size).padStart(8), type.padEnd(30), c);
    if (res.ok && (type.includes('json') || type.includes('text') || c.endsWith('.json') || c.includes('llms'))) {
      const body = await res.text();
      if (body.length > 0 && !body.trimStart().startsWith('<')) {
        const name = c.replaceAll('/', '_').replace(/^_/, '') || 'root';
        fs.writeFileSync(path.join(dir, 'spec' + name), body);
        console.log('   saved', body.length, 'bytes ->', 'audit/raw/spec' + name);
      }
    }
  } catch (e) {
    console.log('ERR ', c, e.message);
  }
}
