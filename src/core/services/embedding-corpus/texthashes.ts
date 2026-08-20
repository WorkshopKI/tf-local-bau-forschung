/**
 * Aus WELCHEM Text stammt ein Vektor?
 *
 * Die Signatur ([signatur.ts](./signatur.ts)) beantwortet seit v4.113, aus
 * welchem **Raum** die Vektoren kommen. Die Frage eine Ebene tiefer war offen:
 * `incremental` filterte allein ueber die EXISTENZ des Aktenzeichen-Schluessels,
 * und der Korpus speichert nur den Vektor (`auslastung-emb:<akz>` → `number[]`).
 * Ein Antrag, der seinen Vektor bekam, BEVOR seine Kurzbeschreibung im Export
 * stand, behaelt ihn — fuer immer.
 *
 * Das ist keine Randlage: die Kurzbeschreibung liegt nur in `9052_PrjBsp…`, und
 * die wird **einmal pro Woche** exportiert. Genau die Antraege, die dieser
 * Import mit Inhalt fuellt, uebersprang ein inkrementeller Lauf.
 *
 * Ein kurzer Hash je Antrag schliesst das: „fehlt" wird zu „fehlt ODER der Text
 * hat sich geaendert".
 *
 * **Kein Krypto-Hash.** Das hier ist ein Aenderungs-Melder, kein Beweis.
 * `crypto.subtle.digest` ist asynchron; 14 000 Aufrufe je Start kosteten ueber
 * eine Sekunde Hauptthread fuer eine Frage, die ein 53-Bit-Hash genauso gut
 * beantwortet (Kollisionswahrscheinlichkeit bei 14 k Eintraegen ≈ 1 : 10^8).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';

/**
 * EINE IDB-Zeile fuer alle Hashes (Map als Objekt), nicht 14 000 einzelne.
 *
 * 14 k × ~11 Zeichen ≈ 300 KB in einem Record — gegenueber 14 k Transaktionen
 * beim Lesen ist das keine Abwaegung. (Die Vektoren selbst liegen einzeln, weil
 * sie einzeln geschrieben werden; Hashes werden immer am Stueck gebraucht.)
 */
export const TEXT_HASH_IDB_KEY = 'auslastung-emb-texthashes';

/**
 * cyrb53 — kurz, synchron, gut verteilt. Liefert Base36, damit die Map klein
 * bleibt.
 */
export function hashEmbeddingText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Die gemerkten Hashes. Leere Map = nie geschrieben (Bestand vor v4.127). */
export async function ladeTextHashes(idb: IDBStore): Promise<Map<string, string>> {
  const roh = await idb.get<Record<string, string>>(TEXT_HASH_IDB_KEY);
  const map = new Map<string, string>();
  if (!roh || typeof roh !== 'object') return map;
  for (const [k, v] of Object.entries(roh)) {
    if (typeof v === 'string') map.set(k, v);
  }
  return map;
}

/**
 * Schreibt die Hashes der Antraege, die dieser Lauf **wirklich eingebettet
 * hat** — additiv zum Bestand.
 *
 * Bewusst nicht „alles neu stempeln": ein Hash sagt aus, dass der Vektor DIESEN
 * Text gesehen hat. Fuer Antraege, deren Vektor aus einer frueheren App-Version
 * stammt, weiss das niemand — sie bekommen keinen Eintrag und gelten als
 * unbekannt (siehe {@link waehleZuEmbedden}). Ein Stempel ohne Deckung waere
 * genau die Luege, die dieses Modul beseitigen soll.
 */
export async function merkeTextHashes(
  idb: IDBStore,
  neue: ReadonlyMap<string, string>,
): Promise<void> {
  if (neue.size === 0) return;
  const bestand = await ladeTextHashes(idb);
  for (const [k, v] of neue) bestand.set(k, v);
  await idb.set(TEXT_HASH_IDB_KEY, Object.fromEntries(bestand));
}

/** Alle Hashes verwerfen — gehoert zu jedem `clearEmbeddings`. */
export async function clearTextHashes(idb: IDBStore): Promise<void> {
  await idb.delete(TEXT_HASH_IDB_KEY);
}

export interface AuswahlLage {
  /** Die embedbaren Aktenzeichen in Bearbeitungsreihenfolge. */
  aktenzeichen: readonly string[];
  /** Frisch berechneter Hash je Aktenzeichen. */
  frisch: ReadonlyMap<string, string>;
  /** Welche Aktenzeichen schon einen Vektor haben. */
  vorhanden: ReadonlySet<string>;
  /** Was beim letzten Lauf gestempelt wurde. */
  gemerkt: ReadonlyMap<string, string>;
}

/**
 * Wer muss (neu) eingebettet werden? **Die eine Regel** — Build-Lauf und
 * Nachlauf-Vorschau fragen dieselbe Funktion, sonst zaehlt die Vorschau etwas
 * anderes, als der Lauf dann tut.
 *
 * Drei Faelle, in dieser Reihenfolge:
 *
 *  1. kein Vektor → ja (der bisherige, einzige Fall)
 *  2. Vektor da, Hash bekannt und **abweichend** → ja (der neue Fall)
 *  3. Vektor da, Hash **unbekannt** → nein
 *
 * Fall 3 ist Absicht und die Stelle, an der man sich vertun kann: „unbekannt"
 * hiesse bei jedem Bestand vor v4.127 „alle", und die erste inkrementelle
 * Aktualisierung nach dem Update waere ein ~40-Minuten-Vollbau — ausgeloest von
 * einem Update, nicht von neuen Daten. Der Verzicht kostet nichts, was es heute
 * schon gaebe: uebersprungen wird genau das, was heute auch uebersprungen wird.
 */
export function waehleZuEmbedden(lage: AuswahlLage): string[] {
  const { aktenzeichen, frisch, vorhanden, gemerkt } = lage;
  const out: string[] = [];
  for (const az of aktenzeichen) {
    if (!vorhanden.has(az)) { out.push(az); continue; }
    const alt = gemerkt.get(az);
    if (alt !== undefined && alt !== frisch.get(az)) out.push(az);
  }
  return out;
}
