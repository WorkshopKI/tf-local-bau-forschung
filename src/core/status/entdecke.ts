/**
 * Auto-Discovery: unbekannte Statuswerte werden beim Import als `unkuratiert`
 * gesammelt — **nie** stillschweigend einer Kategorie zugeordnet.
 *
 * Reine Kernfunktion `ermittleNeueUnkuratierte` (deterministisch, testbar); die
 * Store-Integration liegt in `import-integration.ts`.
 */
import type { SpaltenEintrag } from '@/core/services/csv/spalten-inventar';
import { normCode } from '@/core/services/csv/status-datum-gruppen';
import type { MappingVersion, StatusFeldEintrag, UnkuratierterFund } from './typen';
import { wertId } from './typen';
import { ebeneVonCode } from './seed-codes';

export interface BeobachteterWert {
  feldId: string;
  wert: string;
}

/**
 * Welche beobachteten (Feld,Wert) fehlen sowohl im aktiven Katalog als auch im
 * bestehenden Unkuratiert-Puffer? Nur Werte kuratierter **Wert-Felder** zählen
 * (Datumsfelder haben kein Enum). Deterministisch: stabile Eingangsordnung →
 * stabile Ausgangsordnung, dedupliziert per `wertId`. `erstmalsGesehen` stempelt
 * der Aufrufer (Testbarkeit).
 */
export function ermittleNeueUnkuratierte(
  version: MappingVersion,
  bestehend: readonly UnkuratierterFund[],
  beobachtet: readonly BeobachteterWert[],
  erstmalsGesehen: string,
): UnkuratierterFund[] {
  const wertFelder = new Set(
    version.felder.filter(f => f.typ === 'wert').map(f => f.feldId),
  );
  const bekannt = new Set<string>();
  for (const w of version.werte) bekannt.add(w.id);
  for (const u of bestehend) bekannt.add(u.id);

  const neu: UnkuratierterFund[] = [];
  const gesehen = new Set<string>();
  for (const b of beobachtet) {
    if (!wertFelder.has(b.feldId)) continue;
    const wert = (b.wert ?? '').trim();
    if (!wert) continue;
    const id = wertId(b.feldId, wert);
    if (bekannt.has(id) || gesehen.has(id)) continue;
    gesehen.add(id);
    neu.push({ id, feldId: b.feldId, wert, erstmalsGesehen });
  }
  return neu;
}

/**
 * Entfernt Funde, die im aktiven Katalog inzwischen kuratiert sind. Nötig, seit
 * der Katalog vom Daten-Share kommt: kuratiert die PL einen Wert auf ihrem
 * Rechner, bleibt er im Unkuratiert-Puffer aller anderen Geräte stehen und würde
 * dort dauerhaft als „neu entdeckt" gemeldet. Rein.
 */
export function pruneKuratierte(
  version: MappingVersion, bestand: readonly UnkuratierterFund[],
): UnkuratierterFund[] {
  const kuratiert = new Set(version.werte.map(w => w.id));
  return bestand.filter(u => !kuratiert.has(u.id));
}

// --- Feld-Entdeckung --------------------------------------------------------

/**
 * Erkennt eine Statusspalte des Fachsystems am Präfix: `D_` trägt ein Datum,
 * `T_` einen Texteintrag. Alles andere ist eine Sachspalte (Adresse, Kosten,
 * Klassifikation) und gehört nicht in den Statuskatalog.
 */
const STATUS_SPALTE = /^[dt]_/;

/** Der Code hinter der Spalte: `D_XTEC` → `XTEC`. */
export function codeAusSpalte(spalte: string): string {
  return spalte.replace(/^[DdTt]_/, '');
}

/**
 * Welche gemappten Statusspalten kennt der Katalog noch nicht?
 *
 * Deckt zwei Fälle ab, die der ausgelieferte Seed nicht abdecken kann: die im
 * Fachsystem eingeklappten Ordner (deren Codes niemand abtippen konnte) und
 * alles, was nach der Auslieferung dazukommt.
 *
 * Nur Spalten mit `quelle: 'csv'` zählen — kanonisch gemappte sind über ihr
 * kanonisches Feld bereits im Katalog. Begleitende Textspalten (`T_AAI` zu
 * `D_AAI`) fallen ebenfalls weg: sie gehören zu einem Eintrag, der schon da ist.
 *
 * Rein und deterministisch; `erstmalsGesehen` stempelt der Aufrufer.
 */
export function ermittleNeueFelder(
  version: MappingVersion,
  inventar: readonly SpaltenEintrag[],
  erstmalsGesehen: string,
): StatusFeldEintrag[] {
  const bekannt = new Set<string>();
  for (const f of version.felder) {
    bekannt.add(normCode(f.feldId));
    if (f.textSpalte) bekannt.add(normCode(f.textSpalte));
  }

  const neu: StatusFeldEintrag[] = [];
  for (const eintrag of inventar) {
    if (eintrag.quelle !== 'csv') continue;
    const spalte = eintrag.feldId;
    if (!STATUS_SPALTE.test(spalte.normalize('NFC').toLowerCase())) continue;
    const norm = normCode(spalte);
    if (bekannt.has(norm)) continue;
    bekannt.add(norm);

    const code = codeAusSpalte(spalte);
    neu.push({
      feldId: spalte,
      // Das Label aus der Label-XLS ist die beste verfügbare Beschreibung; ohne
      // sie bleibt der Spaltenname stehen, damit die Zeile zuzuordnen ist.
      label: eintrag.label.trim() || spalte,
      typ: spalte.normalize('NFC').toLowerCase().startsWith('t_') ? 'text' : 'datum',
      ebene: ebeneVonCode(code),
      // Auch die Verbund-Codes stehen auf den TV-Zeilen (siehe feld-aufloesung).
      herkunft: 'tv-record',
      code,
      // Wer die Spalte setzt, weiß nur die Kürzel-Zuarbeit — bis die PL das Feld
      // einsortiert, bleibt es neutral und damit unter jeder Rollenwahl sichtbar.
      rollen: [],
      prominenzDefault: 'normal',
      // Nicht aktiv und ohne Kategorie: ein entdecktes Feld wirkt erst, wenn die
      // PL es einsortiert hat. Sonst tauchten unbenannte Spalten unvermittelt in
      // Timeline und Tabelle auf.
      aktiv: false,
      unkuratiert: true,
      erstmalsGesehen,
    });
  }
  return neu;
}

/** Entfernt Feld-Funde, die inzwischen im Katalog stehen (Gegenstück zu `pruneKuratierte`). */
export function pruneKuratierteFelder(
  version: MappingVersion, bestand: readonly StatusFeldEintrag[],
): StatusFeldEintrag[] {
  const kuratiert = new Set(version.felder.map(f => normCode(f.feldId)));
  return bestand.filter(f => !kuratiert.has(normCode(f.feldId)));
}
