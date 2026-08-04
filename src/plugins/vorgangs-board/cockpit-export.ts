/**
 * XLSX-Export der beiden Cockpit-Sichten.
 *
 * Er exportiert **genau die Zeilen, die auf dem Bildschirm stehen** — dieselbe
 * gefilterte, sortierte Menge. Wer eine Liste weitergibt, muss sich darauf
 * verlassen können, dass sie zeigt, was er gesehen hat; ein Export, der still
 * mehr oder weniger enthält, ist der Anfang jedes Zahlenstreits.
 *
 * Reuses `xlsx@0.18.5` (ohnehin im Bundle).
 */
import * as XLSX from 'xlsx';
import { ROLLE_LABEL, type Rolle } from '@/core/status';
import { zeitstempel } from '@/core/status/export/arbeitsmappe';
import { sichtVon, type BoardZeile } from './useVorgangsBoard';

function tagDe(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function rolleText(r: BoardZeile['waechter']['rolle']): string {
  if (r === null) return '';
  return r === 'ast' ? 'Antragsteller' : ROLLE_LABEL[r];
}

/** Eine Export-Zeile — die Spalten der Bearbeiter-Sicht plus die Herleitung. */
function alsZeile(z: BoardZeile, rolle: Rolle | 'alle'): Record<string, string | number> {
  const e = sichtVon(z, rolle);
  return {
    Aktenzeichen: z.aktenzeichen,
    Kurzname: z.titel,
    Status: z.statusRoh,
    'ZAH-Phase': z.zahPhaseText,
    Fördervariante: z.variante,
    Jahrgang: z.jahr,
    'wirksamer Eingang': tagDe(z.wirksamerEingang),
    'Restfrist (Tage)': z.restTage ?? '',
    'To-do': e.todo ?? 'kein To-do ermittelt',
    Regel: e.beschreibung ?? '',
    // Ein geliehenes To-do muss auch in der weitergegebenen Datei als solches
    // dastehen — sonst liest der Empfänger einen Platzhalter als Regelergebnis.
    Herkunft: e.quelle === 'abgeleitet' ? `abgeleitet aus ${e.abgeleitetAus ?? '?'}` : '',
    Zuständig: e.zustaendig.map(r => ROLLE_LABEL[r]).join('/'),
    'Wartet auf': e.wartetAuf === null ? '' : (e.wartetAuf === 'ast' ? 'Antragsteller' : ROLLE_LABEL[e.wartetAuf]),
    Wächter: z.waechter.urteil,
    'Liegezeit (Tage)': z.waechter.tage ?? '',
    'Zieltage': z.waechter.zieltage ?? '',
    'Hängt bei': rolleText(z.waechter.rolle),
    Begründung: z.waechter.grund,
  };
}

/**
 * Schreibt die Sicht als XLSX und stößt den Download an.
 *
 * Der Dateiname trägt Sicht und Zeitpunkt — eine Datei „export.xlsx" im
 * Download-Ordner sagt in drei Wochen niemandem mehr, was drin ist.
 */
export async function exportiereCockpitXlsx(
  zeilen: readonly BoardZeile[],
  sicht: 'fristen' | 'auswertung',
  rolle: Rolle | 'alle',
  jetzt: Date = new Date(),
): Promise<void> {
  if (zeilen.length === 0) throw new Error('Nichts zu exportieren — die Auswahl ist leer.');
  const blatt = XLSX.utils.json_to_sheet(zeilen.map(z => alsZeile(z, rolle)));
  const mappe = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(mappe, blatt, sicht === 'fristen' ? 'Fristen' : 'Auswertung');
  const name = `vorgangs-board-${sicht}-${zeitstempel(jetzt)}.xlsx`;
  // `writeFile` erledigt Blob + Download-Anker selbst und funktioniert unter
  // `file://` (kein Netzwerkzugriff, keine Object-URL-Sonderwege).
  XLSX.writeFile(mappe, name);
  await Promise.resolve();
}
