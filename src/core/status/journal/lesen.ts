/**
 * Das Journal **lesen**: Chronik je Antrag, Einträge des letzten Nachtlaufs.
 *
 * Geladen werden gezielt die Monatsdateien ab dem Nullpunkt, nicht „das
 * Journal" — nach einem Jahr wären das sonst bei jedem Öffnen einer
 * Antragsseite zweistellige Megabyte.
 *
 * **Dedupliziert wird beim Lesen, nicht beim Schreiben.** Der Lauf hängt erst
 * das JSONL an und schreibt dann den Stand; bricht er dazwischen ab, entsteht
 * derselbe Diff beim nächsten Lauf erneut. Das ist die richtige Richtung —
 * lieber ein doppelter Eintrag als ein verlorener — und hier wird aufgeräumt.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { leseSidecarText } from '../sidecar-datei';
import { dedupliziere } from './diff';
import { journalMonatsPfad, monateZwischen } from './pfade';
import { leseStand } from './stand';
import type { JournalEintrag, JournalStand, Stempel } from './typen';

/**
 * Monats-Cache für die Sitzung, entwertet vom Stempel des Stands.
 *
 * Ein neuer Export ⇒ neuer Stempel ⇒ die Monatsdatei kann gewachsen sein.
 * Ohne diesen Schlüssel zeigte die Antragsseite nach einem Import weiter den
 * alten Verlauf, bis jemand neu lädt.
 */
let cacheStempel: string | null = null;
const monatsCache = new Map<string, JournalEintrag[]>();

function parseZeilen(roh: string): JournalEintrag[] {
  const out: JournalEintrag[] = [];
  for (const zeile of roh.split('\n')) {
    const t = zeile.trim();
    if (t === '') continue;
    try {
      const e: unknown = JSON.parse(t);
      if (typeof e === 'object' && e !== null && 'antragId' in e && 'art' in e) {
        out.push(e as JournalEintrag);
      }
    } catch {
      // Eine kaputte Zeile ist kein Grund, den ganzen Monat zu verwerfen —
      // append-only-Dateien können an einem abgebrochenen Write enden.
    }
  }
  return out;
}

async function ladeMonat(idb: IDBStore, monat: string): Promise<JournalEintrag[]> {
  const treffer = monatsCache.get(monat);
  if (treffer) return treffer;
  const roh = await leseSidecarText(idb, journalMonatsPfad(`${monat}-01`));
  const eintraege = roh === null ? [] : dedupliziere(parseZeilen(roh));
  monatsCache.set(monat, eintraege);
  return eintraege;
}

/** Cache anhand des Stands entwerten. */
async function frischerStand(idb: IDBStore): Promise<JournalStand | null> {
  const stand = await leseStand(idb);
  const stempel = stand?.letzterStempel.id ?? null;
  if (stempel !== cacheStempel) {
    monatsCache.clear();
    cacheStempel = stempel;
  }
  return stand;
}

/** Nur für Tests: den Sitzungs-Cache leeren. */
export function leereJournalCache(): void {
  monatsCache.clear();
  cacheStempel = null;
}

// --- Frische ---------------------------------------------------------------

/**
 * Ab wie vielen Tagen ohne neuen Export die Anzeige warnt.
 *
 * Drei, nicht einer: ein Freitags-Export ist am Montag drei Tage alt, und ein
 * Wochenende ist kein Ausfall. Ab vier Tagen ist es einer — und die Folge steht
 * fest, sobald es weitergeht: der nächste Lauf kann die Änderungen dieser Tage
 * nur noch als **Zeitraum** ausweisen (`unscharf`), nicht als Datum.
 */
export const JOURNAL_FRISCHE_WARNUNG_TAGE = 3;

export interface JournalFrische {
  /** Der Nullpunkt — gehört an jede Journal-Anzeige. */
  journalAb: string;
  /** Der zuletzt verarbeitete Export. */
  stempel: Stempel;
  tageAlt: number;
  /** Über {@link JOURNAL_FRISCHE_WARNUNG_TAGE} — die Anzeige warnt. */
  veraltet: boolean;
  /** Der laufende Monat (`2026-08`), auf den sich {@link eintraegeImMonat} bezieht. */
  monat: string;
  eintraegeImMonat: number;
}

const MS_TAG = 86_400_000;

/**
 * Wie alt der letzte Export ist. Rein — die Uhr kommt von außen.
 *
 * Ein Export-Datum **nach** heute ist ein Uhr- oder `lastModified`-Artefakt und
 * kein frischerer Stand; es wird auf 0 Tage geklemmt statt als negative Zahl
 * angezeigt. Verschleiert wird dabei nichts: das Stempel-Datum selbst steht in
 * der Anzeige daneben.
 */
export function bewerteAlter(
  exportDatum: string, heuteIso: string,
): { tageAlt: number; veraltet: boolean } {
  const a = Date.parse(`${exportDatum.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${heuteIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return { tageAlt: 0, veraltet: false };
  const tageAlt = Math.max(0, Math.round((b - a) / MS_TAG));
  return { tageAlt, veraltet: tageAlt > JOURNAL_FRISCHE_WARNUNG_TAGE };
}

/**
 * Wie frisch das Journal ist. `null` = es wird (noch) keines geführt.
 *
 * Ein ausgefallener Journal-Schritt war bisher nur in der Konsole zu sehen. Das
 * ist die teuerste Art zu schweigen: der erste Eintrag danach trägt eine Spanne
 * über den ganzen unbemerkten Zeitraum, und der Nullpunkt ist verwässert, bevor
 * es jemandem auffällt.
 */
export async function journalFrische(
  idb: IDBStore, heuteIso: string,
): Promise<JournalFrische | null> {
  const stand = await frischerStand(idb);
  if (!stand) return null;
  const monat = heuteIso.slice(0, 7);
  return {
    journalAb: stand.journalAb,
    stempel: stand.letzterStempel,
    ...bewerteAlter(stand.letzterStempel.datum, heuteIso),
    monat,
    eintraegeImMonat: (await ladeMonat(idb, monat)).length,
  };
}

/** Die Einträge eines Feldes, aufsteigend nach Export-Datum. */
export interface FeldChronik {
  feld: string;
  eintraege: JournalEintrag[];
}

/** Einträge eines Antrags nach Feld gruppieren (Feld alphabetisch, Einträge nach Datum). */
function alsFeldChronik(eintraege: JournalEintrag[]): FeldChronik[] {
  const proFeld = new Map<string, JournalEintrag[]>();
  for (const e of eintraege) {
    const feld = e.feld ?? `(${e.art})`;
    const list = proFeld.get(feld);
    if (list) list.push(e); else proFeld.set(feld, [e]);
  }
  return [...proFeld.entries()]
    .map(([feld, es]) => ({
      feld,
      eintraege: [...es].sort((a, b) => a.datum.localeCompare(b.datum)),
    }))
    .sort((a, b) => a.feld.localeCompare(b.feld));
}

export interface AntragsChronik {
  /**
   * Ab wann das Journal Aussagen macht. **Gehört an jede Anzeige** — sonst wird
   * eine unvollständige Chronik als vollständige gelesen.
   */
  journalAb: string;
  /**
   * Führt das Journal diesen Antrag überhaupt? `false` heißt „außerhalb des
   * Betrachtungsbereichs", nicht „nichts passiert" — das ist ein Unterschied,
   * den die Anzeige benennen muss.
   */
  gefuehrt: boolean;
  felder: FeldChronik[];
  /** Jüngstes Export-Datum mit einer Änderung; `null` = keine erfasst. */
  letzteAenderung: string | null;
}

/**
 * Die Chronik eines Antrags. `null`, wenn es (noch) kein Journal gibt — dann
 * bleibt die Anzeige bei ihrer bisherigen Näherung.
 *
 * @param heuteIso ISO-Tag — injiziert, nie eine Uhr hier drin.
 */
export async function chronikFuerAntrag(
  idb: IDBStore, antragId: string, heuteIso: string,
): Promise<AntragsChronik | null> {
  const stand = await frischerStand(idb);
  if (!stand) return null;

  const eigene: JournalEintrag[] = [];
  let letzteAenderung: string | null = null;
  for (const monat of monateZwischen(stand.journalAb, heuteIso)) {
    for (const e of await ladeMonat(idb, monat)) {
      if (e.antragId !== antragId) continue;
      if (letzteAenderung === null || e.datum > letzteAenderung) letzteAenderung = e.datum;
      eigene.push(e);
    }
  }

  return {
    journalAb: stand.journalAb,
    gefuehrt: antragId in stand.werte,
    letzteAenderung,
    felder: alsFeldChronik(eigene),
  };
}

/** Eine Chronik samt ihrem Antrag — für Ansichten über mehrere Teilvorhaben. */
export interface AntragsChronikMitId extends AntragsChronik {
  antragId: string;
}

/**
 * Die Chroniken mehrerer Anträge — für die Verbund-Ebene (ein Verbund = n TVs).
 *
 * Einmal über Stand und Monatsdateien statt n-mal `chronikFuerAntrag`: `stand.json`
 * wiegt über tausende Anträge mehrere MB und ist NICHT gecacht (nur die Monate
 * sind es). Ein Aufruf je Teilvorhaben läse ihn bei einem Achter-Verbund achtmal.
 * Dieselbe Überlegung wie bei {@link letzteAenderungJeAntrag}.
 *
 * `null`, wenn es (noch) kein Journal gibt. Die Reihenfolge folgt `antragIds`
 * (Duplikate fallen weg); Anträge ohne Einträge kommen mit leerer `felder`-Liste
 * zurück — „nichts geändert" und „nicht geführt" sind verschiedene Aussagen und
 * werden über `gefuehrt` unterschieden.
 */
export async function chronikFuerAntraege(
  idb: IDBStore, antragIds: string[], heuteIso: string,
): Promise<AntragsChronikMitId[] | null> {
  const stand = await frischerStand(idb);
  if (!stand) return null;

  const ids = [...new Set(antragIds)];
  const gesucht = new Set(ids);
  const proAntrag = new Map<string, JournalEintrag[]>();
  for (const monat of monateZwischen(stand.journalAb, heuteIso)) {
    for (const e of await ladeMonat(idb, monat)) {
      if (!gesucht.has(e.antragId)) continue;
      const list = proAntrag.get(e.antragId);
      if (list) list.push(e); else proAntrag.set(e.antragId, [e]);
    }
  }

  return ids.map(antragId => {
    const eintraege = proAntrag.get(antragId) ?? [];
    let letzteAenderung: string | null = null;
    for (const e of eintraege) {
      if (letzteAenderung === null || e.datum > letzteAenderung) letzteAenderung = e.datum;
    }
    return {
      antragId,
      journalAb: stand.journalAb,
      gefuehrt: antragId in stand.werte,
      letzteAenderung,
      felder: alsFeldChronik(eintraege),
    };
  });
}

/**
 * Je Antrag das jüngste belegte Änderungsdatum — für das Board.
 *
 * Einmal über die Monatsdateien statt 7 000-mal `chronikFuerAntrag`: das Board
 * rechnet über den ganzen Bestand, und ein Lesevorgang je Zeile wäre die
 * teuerste Art, dieselben Dateien zu lesen.
 *
 * `null`, wenn es kein Journal gibt — dann bleibt das Board bei der Näherung.
 */
export async function letzteAenderungJeAntrag(
  idb: IDBStore, heuteIso: string,
): Promise<Map<string, string> | null> {
  const stand = await frischerStand(idb);
  if (!stand) return null;
  const out = new Map<string, string>();
  for (const monat of monateZwischen(stand.journalAb, heuteIso)) {
    for (const e of await ladeMonat(idb, monat)) {
      const bisher = out.get(e.antragId);
      if (bisher === undefined || e.datum > bisher) out.set(e.antragId, e.datum);
    }
  }
  return out;
}

export interface NachtLauf {
  stempel: string;
  datum: string;
  journalAb: string;
  eintraege: JournalEintrag[];
}

/**
 * Die Einträge des **jüngsten** Exports — die Grundlage des Nachtlauf-Widgets.
 *
 * `null`, wenn es kein Journal gibt; leere `eintraege`, wenn der letzte Lauf
 * nichts fand. Beides sind verschiedene Aussagen und werden getrennt angezeigt.
 */
export async function letzterNachtLauf(idb: IDBStore): Promise<NachtLauf | null> {
  const stand = await frischerStand(idb);
  if (!stand) return null;
  // Nur der Monat des letzten Stempels — ältere Dateien können ihn nicht führen.
  const monat = stand.letzterStempel.datum.slice(0, 7);
  const eintraege = (await ladeMonat(idb, monat))
    .filter(e => e.stempel === stand.letzterStempel.id);
  return {
    stempel: stand.letzterStempel.id,
    datum: stand.letzterStempel.datum,
    journalAb: stand.journalAb,
    eintraege,
  };
}
