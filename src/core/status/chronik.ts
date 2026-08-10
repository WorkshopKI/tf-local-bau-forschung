/**
 * Die Chronik eines Verbunds: alle gesetzten **Datumsfelder** in Zeitfolge.
 *
 * Warum nicht aus dem Ereignis-Protokoll: das hält fest, wann DIESE Installation
 * eine Änderung gesehen hat. Auf einem Rechner, der die Historie noch nicht
 * aufgezeichnet hat, ist es leer — obwohl der Vorgang zwanzig Termine führt. Die
 * Datumsfelder selbst sind die Chronologie des Fachsystems; sie stehen in jedem
 * Import und brauchen keine Aufzeichnung.
 *
 * Rein: kein IDB-, kein Datei-Zugriff, kein `new Date()` für die Sortierung
 * (ISO-Tage sind lexikalisch = chronologisch).
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import type { FeldVorkommen } from './feld-aufloesung';
import type { StatusFeldEintrag } from './typen';

/** Ein Tag in der Chronik — ein Statusfeld, ein Datum, die betroffenen Träger. */
export interface ChronikEintrag {
  /** ISO-Tag `YYYY-MM-DD`. Sortier- und Gruppierschlüssel. */
  tag: string;
  feld: StatusFeldEintrag;
  /** Der Wert, wie er in den Daten steht (die Roh-Schreibweise des Datums). */
  wert: string;
  /** Begleittext aus der `T_`-Spalte, falls gefüllt. */
  text?: string;
  /** Teilvorhaben, die den Eintrag tragen. Leer = Eintrag der Verbund-Ebene. */
  tvIds: string[];
}

/** Meilenstein zuerst, dann Normal, dann Nebensächlich — bei gleichem Tag. */
const PROMINENZ_RANG: Record<string, number> = { meilenstein: 0, normal: 1, nebensaechlich: 2 };

/**
 * Baut die Chronik aus den gesammelten Vorkommen.
 *
 * - Nur `typ: 'datum'` mit einem lesbaren Datum — alles andere hat keinen Platz
 *   auf einem Zeitstrahl und steht weiter in der Ordner-Ansicht.
 * - `ignoriert` fliegt immer raus, `nebensaechlich` nur auf Wunsch (dieselbe
 *   Regel wie `baueLanes`, damit beide Ansichten dasselbe zeigen).
 * - **Ein Eintrag je Feld und Tag**: dieselbe Verbund-Spalte steht auf jeder
 *   TV-Zeile, und vier Teilvorhaben mit demselben Termin sind ein Ereignis mit
 *   vier Trägern, nicht vier Ereignisse.
 */
export function baueChronik(
  vorkommen: readonly FeldVorkommen[],
  opts: { zeigeNebensaechlich: boolean } = { zeigeNebensaechlich: false },
): ChronikEintrag[] {
  const proSchluessel = new Map<string, ChronikEintrag>();

  for (const v of vorkommen) {
    if (v.feld.typ !== 'datum') continue;
    const prominenz = v.feld.prominenzDefault;
    if (prominenz === 'ignoriert') continue;
    if (prominenz === 'nebensaechlich' && !opts.zeigeNebensaechlich) continue;
    const tag = parseGermanDate(v.wert);
    if (!tag) continue;

    const schluessel = `${v.feld.feldId}|${tag}`;
    const vorhanden = proSchluessel.get(schluessel);
    if (vorhanden) {
      if (v.tvId && !vorhanden.tvIds.includes(v.tvId)) vorhanden.tvIds.push(v.tvId);
      if (!vorhanden.text && v.text) vorhanden.text = v.text;
      continue;
    }
    proSchluessel.set(schluessel, {
      tag,
      feld: v.feld,
      wert: v.wert,
      ...(v.text ? { text: v.text } : {}),
      tvIds: v.tvId ? [v.tvId] : [],
    });
  }

  return [...proSchluessel.values()].sort((a, b) =>
    a.tag.localeCompare(b.tag)
    || (PROMINENZ_RANG[a.feld.prominenzDefault] ?? 1) - (PROMINENZ_RANG[b.feld.prominenzDefault] ?? 1)
    || a.feld.label.localeCompare(b.feld.label, 'de'));
}

/**
 * Wer einen Eintrag trägt: der Verbund, ein benanntes Teilvorhaben oder mehrere.
 *
 * Steht hier und nicht in der Anzeige, weil zwei Oberflächen dieselbe Auskunft
 * geben — die Chronik der Detailseite und der Vorgangsverlauf im Ausklapp. Zwei
 * Formulierungen für dieselbe Menge wären zwei Aussagen.
 *
 * Leere Liste heißt **Verbund**, nicht „niemand": Verbund-Felder liefern
 * bewusst genau einen Eintrag ohne `tvId` (`sammleVorkommen`).
 */
export function traegerLabel(tvIds: readonly string[]): string {
  if (tvIds.length === 0) return 'Verbund';
  if (tvIds.length === 1) return tvIds[0] ?? '';
  return `${tvIds.length} Teilvorhaben`;
}

/** Ein Monatsblock der Chronik (`YYYY-MM`), Einträge in Tagesfolge. */
export interface ChronikMonat {
  monat: string;
  eintraege: ChronikEintrag[];
}

/** Gruppiert die (bereits sortierte) Chronik nach Monat — die Blöcke der Anzeige. */
export function gruppiereNachMonat(eintraege: readonly ChronikEintrag[]): ChronikMonat[] {
  const out: ChronikMonat[] = [];
  for (const e of eintraege) {
    const monat = e.tag.slice(0, 7);
    const letzter = out[out.length - 1];
    if (letzter && letzter.monat === monat) letzter.eintraege.push(e);
    else out.push({ monat, eintraege: [e] });
  }
  return out;
}
