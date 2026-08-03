/**
 * Der **Journal-Lauf beim Import**: Stempel prüfen, Diff rechnen, anhängen.
 *
 * Die Reihenfolge ist load-bearing:
 *  1. Stempel — bekannt ⇒ Ende. Ein unveränderter Export kostet nichts.
 *  2. Kein Stand ⇒ **Baseline**: Werte schreiben, KEINE Einträge. Sonst
 *     entstünden beim ersten Lauf hunderttausend Phantom-„gesetzt", und das
 *     Journal wäre von Anfang an unlesbar.
 *  3. Diff rechnen (rein).
 *  4. **Optimistische Sperre**: unmittelbar vor dem Schreiben den Stand erneut
 *     lesen. Trägt er schon unseren Stempel, war ein anderes Gerät schneller —
 *     abbrechen statt doppelt anhängen.
 *  5. Erst JSONL, **dann** Stand. Bricht es dazwischen ab, erzeugt der nächste
 *     Lauf denselben Diff erneut; das ist die richtige Richtung (lieber doppelt
 *     als verloren) und wird beim Lesen entdoppelt.
 *
 * Ohne Schreibrecht läuft alles bis Schritt 3 und schreibt nichts — das Gerät
 * liest mit, ohne den Team-Stand anzufassen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { berechneDiff } from './diff';
import { haengeEintraegeAn, leseStand, merkeStempel, schreibeStand } from './stand';
import type { JournalStand, JournalWerte, Stempel } from './typen';

export interface LaufErgebnis {
  /** Was passiert ist — für Protokoll und Anzeige. */
  art: 'uebersprungen' | 'baseline' | 'diff' | 'kollision' | 'nur-gelesen';
  /** Erzeugte Journal-Einträge (0 bei Baseline und Übersprungen). */
  eintraege: number;
  /** Anträge im Stand nach dem Lauf. */
  antraege: number;
  /** Anträge, die neu in den Betrachtungsbereich gekommen sind (Baseline für sie). */
  neuImBereich: number;
  /** Anträge, die aus dem Bereich gefallen sind (aus dem Stand entfernt). */
  ausDemBereich: number;
  journalAb: string;
}

export interface LaufEingabe {
  stempel: Stempel;
  /** Die frische Projektion des Exports (nur der Betrachtungsbereich). */
  werte: JournalWerte;
  /** Programm-Liste, mit der projiziert wurde — aus der TEAM-Kuration. */
  bereich: readonly string[];
}

function gleicherBereich(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = [...a].sort();
  const t = [...b].sort();
  return s.every((x, i) => x === t[i]);
}

/**
 * Führt den Lauf aus. Der einzige Schreibpfad des Journals.
 *
 * Ohne Uhr: das Journal datiert den **Export** (`stempel.datum` aus
 * `file.lastModified`), nicht den Import. Auf einem zweiten Rechner, der die
 * Datei einen Tag später einliest, stünde sonst ein falsches Datum an denselben
 * Änderungen.
 */
export async function laufeJournal(
  idb: IDBStore, eingabe: LaufEingabe,
): Promise<LaufErgebnis> {
  const { stempel, werte, bereich } = eingabe;
  const antraege = Object.keys(werte).length;
  const vorher = await leseStand(idb);

  if (vorher && vorher.verarbeitet.includes(stempel.id)) {
    return {
      art: 'uebersprungen', eintraege: 0, antraege: Object.keys(vorher.werte).length,
      neuImBereich: 0, ausDemBereich: 0, journalAb: vorher.journalAb,
    };
  }

  // --- Baseline: es gibt keinen Stand, gegen den man vergleichen könnte.
  if (!vorher) {
    const neu: JournalStand = {
      schema: 1,
      journalAb: stempel.datum,
      letzterStempel: stempel,
      verarbeitet: [stempel.id],
      bereich: [...bereich],
      werte,
    };
    const geschrieben = await schreibeStand(idb, neu);
    return {
      art: geschrieben ? 'baseline' : 'nur-gelesen',
      eintraege: 0, antraege, neuImBereich: 0, ausDemBereich: 0,
      journalAb: neu.journalAb,
    };
  }

  // --- Bereichswechsel: was neu dazukommt, hat keine Vorgeschichte im Stand.
  // Ohne diese Unterscheidung meldete jede Erweiterung tausende `antrag-neu`,
  // und jede Verkleinerung ebenso viele `antrag-fehlt` — beides wäre gelogen.
  const bereichGleich = gleicherBereich(vorher.bereich, bereich);
  const neuImBereich = new Set<string>();
  const ausDemBereich = new Set<string>();
  if (!bereichGleich) {
    for (const id of Object.keys(werte)) if (!(id in vorher.werte)) neuImBereich.add(id);
    for (const id of Object.keys(vorher.werte)) if (!(id in werte)) ausDemBereich.add(id);
  }

  const eintraege = berechneDiff(vorher.werte, werte, {
    stempel,
    vorherDatum: vorher.letzterStempel.datum,
    neuImBereich,
    ausDemBereich,
  });

  // --- Optimistische Sperre, so spät wie möglich.
  const nochmal = await leseStand(idb);
  if (nochmal && nochmal.letzterStempel.id === stempel.id) {
    return {
      art: 'kollision', eintraege: 0, antraege: Object.keys(nochmal.werte).length,
      neuImBereich: neuImBereich.size, ausDemBereich: ausDemBereich.size,
      journalAb: nochmal.journalAb,
    };
  }

  const angehaengt = await haengeEintraegeAn(idb, eintraege, stempel.datum);
  if (!angehaengt) {
    return {
      art: 'nur-gelesen', eintraege: eintraege.length, antraege,
      neuImBereich: neuImBereich.size, ausDemBereich: ausDemBereich.size,
      journalAb: vorher.journalAb,
    };
  }

  const neu: JournalStand = {
    schema: 1,
    journalAb: vorher.journalAb,
    letzterStempel: stempel,
    verarbeitet: merkeStempel(vorher.verarbeitet, stempel.id),
    bereich: [...bereich],
    werte,
  };
  await schreibeStand(idb, neu);
  return {
    art: 'diff', eintraege: eintraege.length, antraege,
    neuImBereich: neuImBereich.size, ausDemBereich: ausDemBereich.size,
    journalAb: neu.journalAb,
  };
}
