// Smoke-Test fuer computeColumnWidth.
// Wird in Task 4 wieder geloescht — die Logik selbst lebt in Step1Metadata.tsx.

function computeColumnWidth(header, values) {
  const headerLen = Math.min(header.length, 24);
  const maxValLen = values.reduce(
    (m, v) => Math.max(m, Math.min(String(v ?? '').length, 24)),
    0,
  );
  const ch = Math.max(4, headerLen, maxValLen);
  const px = ch * 7.2 + 12;
  return Math.min(Math.max(px, 56), 200);
}

const cases = [
  { name: 'short header + short values',  in: ['FKZ', ['37', '34']],                          want: [56, 60] },
  { name: 'medium header + IDs',          in: ['FREMDKENNZ', ['16KN021932', '16KN033501']],   want: [84, 96] },
  { name: 'long value capped at 24 chars',in: ['x', ['Lorem ipsum dolor sit amet consectetur']], want: [184, 200] },
  { name: 'empty values fall back to min',in: ['x', []],                                       want: [56, 56] },
  { name: 'header longer than values',    in: ['Aktenplanzuordnung', ['kl', 'kl']],            want: [140, 145] },
];

let failed = 0;
for (const c of cases) {
  const got = computeColumnWidth(c.in[0], c.in[1]);
  const ok = got >= c.want[0] && got <= c.want[1];
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${c.name} -> ${got} (want ${c.want[0]}-${c.want[1]})`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
