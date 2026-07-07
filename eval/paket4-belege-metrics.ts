/**
 * Beleg-Mapping-Metriken für das Paket-4-Eval-Gate (Phase 5.2), je Abschnitt:
 *  - Anteil Zitate (Belege) mit Satz-Referenz
 *  - Anteil GÜLTIGER emittierter Referenzen (Index im Bereich von splitSentences(finalerText))
 *  - Abdeckung: Anteil Sätze mit ≥1 Beleg
 *
 * Aufruf: npx vite-node --config vitest.config.mts eval/paket4-belege-metrics.ts <results.jsonl>
 * Nutzt dieselbe `splitSentences` wie Parser + UI (eine Segmentierungs-Basis).
 */
import { readFileSync } from 'node:fs';
import { splitSentences } from '@/core/services/skills';

const path = process.argv[2] ?? 'eval-out/paket4-kandidat/results.jsonl';
const rows = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

const pct = (a: number, b: number): string => (b > 0 ? `${((100 * a) / b).toFixed(0)}%` : '—');

interface Agg {
  runs: number; belegeTotal: number; belegeMitRef: number;
  refEmitted: number; refValid: number; saetzeTotal: number; saetzeMitBeleg: number;
}
const bySection: Record<string, Agg> = {};

for (const r of rows) {
  if (r.fehler) continue;
  const sec: string = r.abschnitt;
  const s = (bySection[sec] ??= {
    runs: 0, belegeTotal: 0, belegeMitRef: 0, refEmitted: 0, refValid: 0, saetzeTotal: 0, saetzeMitBeleg: 0,
  });
  s.runs++;
  const final: string = r.parsed?.finalerText ?? '';
  const satzAnzahl = splitSentences(final).length;
  s.saetzeTotal += satzAnzahl;

  const belege: { satzIndizes: number[] }[] = r.parsed?.belege ?? [];
  s.belegeTotal += belege.length;
  const covered = new Set<number>();
  for (const b of belege) {
    if (b.satzIndizes.length > 0) { s.belegeMitRef++; for (const i of b.satzIndizes) covered.add(i); }
  }
  s.saetzeMitBeleg += covered.size;

  // Emittierte Referenzen direkt aus der (rohen) Quellenanalyse zählen (inkl. ungültiger).
  const q: string = r.parsed?.quellenanalyse ?? '';
  const refRe = /(?:→|->)\s*st(?:ü|ue)tzt\s+S(?:a|ä|ae)tz(?:e)?\s+([\d,\s]+)/giu;
  let m: RegExpExecArray | null;
  while ((m = refRe.exec(q)) !== null) {
    const nums = m[1]!.split(',').map(x => Number.parseInt(x.trim(), 10)).filter(Number.isFinite);
    for (const n of nums) { s.refEmitted++; if (n >= 1 && n <= satzAnzahl) s.refValid++; }
  }
}

console.log(`\n=== Beleg-Metriken: ${path} ===`);
for (const [sec, s] of Object.entries(bySection)) {
  console.log(`\n[Abschnitt ${sec}]  runs=${s.runs}`);
  console.log(`  Belege gesamt: ${s.belegeTotal} · mit Satz-Ref: ${s.belegeMitRef} (${pct(s.belegeMitRef, s.belegeTotal)})`);
  console.log(`  Emittierte Referenzen: ${s.refEmitted} · gültig (im Bereich): ${s.refValid} (${pct(s.refValid, s.refEmitted)})  ← Gate ≥ 80 %`);
  console.log(`  Abdeckung: ${s.saetzeMitBeleg}/${s.saetzeTotal} Sätze mit ≥1 Beleg (${pct(s.saetzeMitBeleg, s.saetzeTotal)})`);
}
