/**
 * Das Prüfergebnis als XLSX — eine Zeile je Meldung × Treffer.
 *
 * **Eine Zeile je Treffer, nicht eine je Meldung mit zusammengeklebten
 * Treffern.** Das Ergebnis wandert in die Abstimmung mit dem Fachreferat, und
 * dort wird nach FKZ gefiltert und sortiert. Eine Zelle mit fünf Titeln darin
 * ist für diesen Zweck unbrauchbar. Meldungen ohne Übereinstimmung stehen
 * trotzdem mit genau einer Zeile darin — sie sind das Ergebnis, nicht seine
 * Abwesenheit.
 *
 * Der Zeilen- und Dateinamen-Bau folgt [export.ts](src/plugins/suche/export.ts);
 * die Spalten sind andere, deshalb ein eigenes Modul statt eines Parameters an
 * einer Funktion, die `UnifiedSearchResult` erwartet.
 */
import * as XLSX from 'xlsx';
import type { TrefferBefund, ZeilenErgebnis } from '../types';

const KOPF: readonly string[] = [
  'Zeile', 'FKZ (Meldung)', 'Thema (Meldung)', 'Bundesmittel',
  'Schlagworte', 'Ergebnis', 'Grund',
  'FKZ (ZIM)', 'Verbund-Titel', 'Teilvorhaben', 'Kurzbeschreibung',
  'Abdeckung', 'getroffene Schlagworte', 'Ähnlichkeit', 'gefunden durch',
  'Status', 'Antragsdatum', 'Antragsteller',
];

/** Char-Breiten je Spalte — Excel rechnet in Zeichen, nicht in Pixeln. */
const BREITEN: readonly number[] = [
  6, 14, 40, 12, 30, 20, 14, 14, 40, 40, 60, 10, 30, 11, 14, 18, 13, 30,
];

const ERGEBNIS_TEXT = {
  ja: 'Übereinstimmung',
  nein: 'keine Übereinstimmung',
  fehler: 'nicht geprüft',
} as const;

const GRUND_TEXT: Record<ZeilenErgebnis['grund'], string> = {
  traeger: 'gleicher Zuwendungsempfänger + inhaltliche Nähe',
  schlagworte: 'Schlagworte',
  aehnlichkeit: 'inhaltliche Ähnlichkeit',
  keine: '',
  unklar: 'nicht beurteilbar (kein Schlagwort im Bestand)',
};

function meldungsSpalten(e: ZeilenErgebnis): (string | number)[] {
  return [
    e.zeile.zeilenNr,
    e.zeile.fkz,
    e.zeile.thema,
    e.zeile.betrag ?? e.zeile.betragRoh,
    e.schlagworte.join(' · '),
    e.fehler ? ERGEBNIS_TEXT.fehler : (e.uebereinstimmung ? ERGEBNIS_TEXT.ja : ERGEBNIS_TEXT.nein),
    e.fehler ?? GRUND_TEXT[e.grund],
  ];
}

function trefferSpalten(b: TrefferBefund, schlagworte: number): (string | number)[] {
  return [
    b.aktenzeichen,
    b.verbundTitel,
    b.titel,
    b.kurzbeschreibung,
    `${b.abdeckung}/${schlagworte}`,
    b.getroffeneWorte.join(' · '),
    b.aehnlichkeit === null ? '' : Number(b.aehnlichkeit.toFixed(3)),
    b.quelle === 'beide' ? 'Wortlaut + Ähnlichkeit' : (b.quelle === 'wortlaut' ? 'Wortlaut' : 'Ähnlichkeit'),
    b.status,
    b.antragsdatum,
    b.antragsteller,
  ];
}

/** Die Zeilen-Matrix ohne Kopf — rein, damit der Test sie prüfen kann. */
export function baueExportZeilen(
  ergebnisse: readonly ZeilenErgebnis[],
): (string | number)[][] {
  const out: (string | number)[][] = [];
  for (const e of ergebnisse) {
    const links = meldungsSpalten(e);
    if (e.befunde.length === 0) {
      out.push([...links, ...Array.from({ length: KOPF.length - links.length }, () => '')]);
      continue;
    }
    for (const b of e.befunde) out.push([...links, ...trefferSpalten(b, e.schlagworte.length)]);
  }
  return out;
}

/** `YYYY-MM-DD-HHmm` (lokale Zeit) — mehrere Läufe am selben Tag bleiben unterscheidbar. */
function zeitstempel(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function exportiereErgebnis(ergebnisse: readonly ZeilenErgebnis[]): void {
  const ws = XLSX.utils.aoa_to_sheet([[...KOPF], ...baueExportZeilen(ergebnisse)]);
  ws['!cols'] = BREITEN.map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Doppelförderung');
  XLSX.writeFile(wb, `doppelfoerderung-${zeitstempel()}.xlsx`);
}

/** Für die Tests — der Kopf ist Teil des Vertrags mit dem Fachreferat. */
export const EXPORT_KOPF = KOPF;
