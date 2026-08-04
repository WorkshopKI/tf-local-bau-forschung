/**
 * Der Share-Zugriff der Klärung — die einzige Stelle des Moduls mit IO.
 *
 * Läuft ausschließlich über `sidecar-datei.ts`, wie Katalog, Trigger und Journal:
 * eine Mechanik, ein Weg auf den Share, dieselbe Selbst-Gatung (ohne Schreibrecht
 * ein No-op statt eines Wurfs, Pitfall #25) und dieselbe Fehler-Toleranz beim
 * Lesen (fehlend/offline/kaputt ⇒ leer, nie ein Wurf).
 *
 * **Fehlschlag ist ein Rückgabewert, kein Wurf.** Alle Sidecar-Funktionen
 * schlucken Fehler per Vertrag; `false` ist das einzige Signal. Ein `try/catch`
 * um `haengeEintragAn` sähe aus, als behandle es den Fall, und finge nichts. Die
 * Oberfläche MUSS das `false` anzeigen — sonst sieht der Nutzer eine Antwort, die
 * es auf dem Share nicht gibt.
 *
 * Warum je Autor eine Datei: siehe `pfade.ts`.
 */
import type { IDBStore } from '@/core/services/storage';
import { leseSidecarText, haengeAnSidecar, listeSidecarDateien } from '@/core/status/sidecar-datei';
import { parseEintraege, falte } from './fold';
import { klaerungDir, klaerungAutorPfad } from './pfade';
import type { KlaerungEintrag, KlaerungStand } from './typen';

/** Was ein Ladevorgang zurückbringt. */
export interface KlaerungLadung {
  stand: KlaerungStand;
  /** Wie viele Autor-Dateien gefunden wurden — 0 heißt „noch niemand". */
  dateien: number;
}

/**
 * Liest alle Autor-Dateien einer Klärung und faltet sie zu einem Stand.
 *
 * Die Dateien werden nacheinander gelesen und aneinandergehängt. Die Reihenfolge
 * ZWISCHEN den Dateien ist beliebig und darf es sein: Urteile sind nach Autor
 * gekeyt, und die Kommentarliste wird zur Anzeige ohnehin nach Zeitstempel
 * gemischt (`beitraegeSortiert`).
 */
export async function leseKlaerung(idb: IDBStore, klaerungId: string): Promise<KlaerungLadung> {
  const verzeichnis = klaerungDir(klaerungId);
  const namen = (await listeSidecarDateien(idb, verzeichnis)).filter(n => n.endsWith('.jsonl'));
  const alle: KlaerungEintrag[] = [];
  for (const name of namen) {
    const roh = await leseSidecarText(idb, `${verzeichnis}/${name}`);
    if (roh != null) alle.push(...parseEintraege(roh));
  }
  return { stand: falte(alle), dateien: namen.length };
}

/**
 * Hängt einen Eintrag an die Datei SEINES Autors an.
 *
 * Der Pfad leitet sich aus `eintrag.autor` ab, nicht aus einem Parameter — so kann
 * ein Aufrufer nicht versehentlich in die Datei eines anderen schreiben.
 *
 * `false` heißt: nicht gesichert (kein Handle, kein Schreibrecht, Schreibfehler).
 */
export async function haengeEintragAn(
  idb: IDBStore, klaerungId: string, eintrag: KlaerungEintrag,
): Promise<boolean> {
  return haengeAnSidecar(
    idb,
    klaerungAutorPfad(klaerungId, eintrag.autor),
    JSON.stringify(eintrag),
  );
}
