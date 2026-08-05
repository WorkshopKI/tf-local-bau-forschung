/**
 * Die Seed-Änderungen: was in `zah-phasen.ts` stehen müsste, damit die
 * Auslieferung sagt, was die gepflegte Fassung sagt.
 *
 * **Quelle ist die FASSUNG, nicht der Konsens** (seit v2.417). Bis dahin baute
 * dieser Export seine Zeilen aus den Antworten der Klärung — mit dem Ergebnis,
 * dass er am 05.08. fünf Änderungen nannte, während der Baum zehn Umhängungen
 * und drei Phasenänderungen trug. Beschlossen wird in der Klärung, **vollzogen
 * wird im Baum**, und nur der Baum ist der Stand, der wirken soll. Was
 * besprochen, aber nie vollzogen wurde, gehört in die Kurzfassung (dort steht es
 * weiterhin) und in den Vermerk „noch offen" an der Zeile — nicht in einen
 * Änderungsauftrag an den Code.
 *
 * **Nichts hier schreibt zurück** — weder in die Fassung noch in den Seed. Ein
 * Mensch liest den Text, entscheidet und ändert das Programm.
 *
 * Zwei Sorten Ausgabe, deutlich getrennt:
 * - **einfügefertig** — Phasen-Tabelle und Zuordnungen, als Code zum Einsetzen;
 * - **nur Information** — die Zieltage, für die die Auslieferung noch gar keine
 *   Struktur hat. Sie mit auszuwerfen, als wären sie Code, wäre eine Zusage, die
 *   niemand einlösen kann.
 *
 * Rein bis auf `ladeHerunter`; die Textbildung ist ohne Browser testbar.
 */
import { zeitstempel } from '@/core/status/export/arbeitsmappe';
import { zahPhasenVon } from '@/core/status';
import type { GeltendeZahPhase, KatalogDrift } from '@/core/status';
import { kurzDatum } from './labels';
import { ladeHerunter, type ExportEingabe } from './export';

/** Breite, auf die eine Zuordnungszeile vor dem `// war:`-Kommentar aufgefüllt wird. */
const KOMMENTAR_SPALTE = 30;

function fuelleAuf(zeile: string): string {
  return zeile.padEnd(Math.max(zeile.length + 1, KOMMENTAR_SPALTE));
}

/** Ein Phasen-Literal, wie es in `SEED_ZAH_PHASEN` steht. */
function phasenZeile(p: GeltendeZahPhase): string {
  return `  { id: '${p.id}', reihenfolge: ${p.reihenfolge}, label: '${p.label}', `
    + `zieltageRelevant: ${p.zieltageRelevant}, kategorieVorgabe: '${p.kategorieVorgabe}' },`;
}

/**
 * Der Phasen-Abschnitt: die **ganze** neue Tabelle, nicht nur die Unterschiede.
 *
 * Entfernung, Umbenennung und Reihenfolge lassen sich einzeln nicht sauber
 * einsetzen — wer drei Zeilen ändert und eine löscht, hat vier Gelegenheiten,
 * eine zu übersehen. Die Unterschiede stehen als Kommentar an der jeweiligen
 * Zeile bzw. für Entfernungen darüber.
 */
function phasenAbschnitt(d: KatalogDrift, phasen: readonly GeltendeZahPhase[]): string[] {
  const p = d.phasen;
  if (p.entfernt.length + p.hinzugefuegt.length + p.umbenannt.length
    + p.umsortiert.length + p.vorgabeGeaendert.length === 0) {
    return [];
  }
  const umbenannt = new Map(p.umbenannt.map(x => [x.id, x.alt]));
  const verschoben = new Map(p.umsortiert.map(x => [x.id, x]));
  const vorgabe = new Map(p.vorgabeGeaendert.map(x => [x.id, x]));
  const neu = new Set(p.hinzugefuegt.map(x => x.id));

  return [
    '// --- Verfahrensschritte: SEED_ZAH_PHASEN ersetzen ---',
    ...p.entfernt.map(x => `// entfallen: '${x.id}' (${x.label})`),
    'export const SEED_ZAH_PHASEN: readonly GeltendeZahPhase[] = [',
    ...phasen.map(phase => {
      const hinweise = [
        neu.has(phase.id) ? 'neu' : null,
        umbenannt.has(phase.id) ? `war label: '${umbenannt.get(phase.id) ?? ''}'` : null,
        verschoben.has(phase.id) ? 'umsortiert' : null,
        vorgabe.get(phase.id)?.arbeitsliste
          ? `war kategorieVorgabe: '${vorgabe.get(phase.id)?.arbeitsliste?.alt ?? ''}'`
          : null,
        vorgabe.get(phase.id)?.zieltageRelevant
          ? `war zieltageRelevant: ${String(vorgabe.get(phase.id)?.zieltageRelevant?.alt)}`
          : null,
      ].filter(Boolean);
      const zeile = phasenZeile(phase);
      return hinweise.length === 0 ? zeile : `${fuelleAuf(zeile)}// ${hinweise.join(', ')}`;
    }),
    '];',
    '',
  ];
}

/**
 * Der Zuordnungs-Abschnitt: je umgehängtem Code eine Zeile für
 * `SEED_CODE_ZU_ZAH_PHASE` — bzw. eine Entfernung, wenn er zum Marker wurde.
 */
function zuordnungsAbschnitt(d: KatalogDrift): string[] {
  if (d.zuordnungen.length === 0) return [];
  return [
    '// --- Zuordnungen: SEED_CODE_ZU_ZAH_PHASE ---',
    ...d.zuordnungen.map(z => {
      const bezeichnung = z.bezeichnung || '';
      if (z.nachher === null) {
        // Marker haben keinen Eintrag in der Phasen-Map — sie stehen in der
        // Marker-Menge. Deshalb eine Entfernung, keine Zuweisung.
        return `// [${z.code}, …] entfernen und ${z.code} zu SEED_MARKER_CODES hinzufügen`
          + `  (${bezeichnung})`;
      }
      const zeile = `  [${z.code}, '${z.nachher}'],`;
      const war = z.vorher === null ? 'ohne Phase' : z.vorher;
      return `${fuelleAuf(zeile)}// war: ${war}${bezeichnung ? ` — ${bezeichnung}` : ''}`;
    }),
    '',
  ];
}

/**
 * Der Zieltage-Abschnitt: **kein Code**, sondern eine Aufstellung.
 *
 * Die Auslieferung führt keine Zieltage (`seedKenntZieltage`) — es gibt also
 * nichts, wohin man diese Zeilen einsetzen könnte. Sie stehen trotzdem hier,
 * weil sie die Kuration sind, die ausschließlich in der Fassung lebt: wer
 * entscheidet, ob und wie sie ins Programm wandert, braucht sie vor Augen.
 */
function zieltageAbschnitt(d: KatalogDrift): string[] {
  if (d.zieltage.length === 0) return [];
  return [
    '// ===========================================================================',
    '// ZIELTAGE — NICHT einfügefertig.',
    d.seedKenntZieltage
      ? '// Die Auslieferung führt Zieltage; unten stehen die geänderten.'
      : '// Die Auslieferung hat dafür noch keine Struktur — diese Kuration lebt bislang',
    ...(d.seedKenntZieltage ? [] : ['// ausschließlich in der Fassung. Information für die Entscheidung, kein Code.']),
    '// ===========================================================================',
    ...d.zieltage.map(z => `// ${z.code !== null ? `${z.code} ` : ''}${z.wert}: `
      + `${z.neu} Tage${z.alt !== null ? ` (war ${z.alt})` : ''}`),
    '',
  ];
}

/**
 * Der vollständige Text der Seed-Änderungen.
 *
 * Ohne geladene Fassung wird das ausdrücklich gesagt statt eine leere Datei
 * auszugeben — „nichts zu ändern" und „ich weiß es nicht" sind zwei verschiedene
 * Aussagen, und die falsche davon beruhigt.
 */
export function baueSeedDiff(e: ExportEingabe): string {
  const kopf = [
    `// Seed-Änderungen aus „${e.klaerung.titel}"`,
    `// Export ${kurzDatum(e.jetztIso)}`,
    '// Grundlage: der STATUS-KATALOG, so wie er gerade gepflegt ist —',
    '// nicht die Antworten dieser Seite. Beschlossen wird hier, vollzogen im Baum.',
    '// Ziel: src/core/status/zah-phasen.ts',
    '',
  ];

  if (e.drift === null) {
    return [...kopf, '// Die Katalog-Fassung ist nicht geladen — kein Abgleich möglich.'].join('\n');
  }

  const abschnitte = [
    ...phasenAbschnitt(e.drift, zahPhasenVon(e.fassungPhasen)),
    ...zuordnungsAbschnitt(e.drift),
    ...zieltageAbschnitt(e.drift),
  ];
  if (abschnitte.length === 0) {
    return [...kopf, '// Nichts zu ändern — die Fassung entspricht der Auslieferung.'].join('\n');
  }
  return [...kopf, ...abschnitte].join('\n');
}

export function exportiereSeedDiff(e: ExportEingabe): void {
  ladeHerunter(
    baueSeedDiff(e),
    `klaerung-${e.klaerung.klaerungId}-seed-${zeitstempel(new Date(e.jetztIso))}.txt`,
    'text/plain',
  );
}
