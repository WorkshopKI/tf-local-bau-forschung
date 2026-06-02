/**
 * PL-Einsammel-Schritt fuer MA-Übernahme-Wünsche (v2.9).
 *
 * Liest `ZAH/auslastung-uebernahme.json` aus allen User-Ordnern unter dem
 * User-Folders-Root (PL-Pfad, nur `read` noetig) und merged die Wünsche als
 * `Zuweisung{status:'selbst'}` in `auslastung.json`. Spiegelbild von
 * `profil-einsammeln.ts` — Iteration gespiegelt von `FeedbackInboxTab.loadInbox`.
 *
 * Merge ist pure → testbar ohne FS. Reconciliation-Regeln siehe
 * `mergeWuenscheIntoZuweisungen`.
 */
import { readUebernahmeFromShare } from './uebernahme-wuensche';
import { resolveAnonIdForUser, type AnonymMap } from './anonym-map';
import type { PersoenlicheUebernahmeWuensche, Zuweisung } from '../types';

/**
 * Liest alle MA-Übernahme-Wünsche unter dem User-Folders-Root ein. User-Ordner
 * ohne `ZAH/auslastung-uebernahme.json` werden uebersprungen.
 */
export async function collectUebernahmeWuensche(
  root: FileSystemDirectoryHandle,
): Promise<PersoenlicheUebernahmeWuensche[]> {
  const out: PersoenlicheUebernahmeWuensche[] = [];
  for await (const entry of (root as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind !== 'directory') continue;
    try {
      const userDir = await root.getDirectoryHandle(entry.name);
      const wuensche = await readUebernahmeFromShare(userDir);
      if (wuensche) out.push(wuensche);
    } catch {
      // User-Ordner ohne ZAH/-Struktur oder ohne Wunsch-Datei → ignorieren.
    }
  }
  return out;
}

/**
 * Reine Gruppierung der eingelesenen Wünsche zu `antragId → anonIds[]` (dedupe).
 * Kürzel werden via AnonymMap aufgelöst (NFC + Split, Pitfall #22); unauflösbare
 * Kürzel übersprungen. Für die Read-only-Markierung „vorgemerkt" im Zuweisungs-
 * Cockpit VOR dem Einsammeln — schreibt NICHT in den Store.
 */
export function buildPendingByAntrag(
  batch: readonly PersoenlicheUebernahmeWuensche[],
  anonymMap: AnonymMap,
): Map<string, string[]> {
  const tmp = new Map<string, Set<string>>();
  for (const p of batch) {
    const anonId = resolveAnonIdForUser(p.kuerzel, anonymMap);
    if (!anonId) continue;
    for (const w of p.wuensche) {
      if (!w || typeof w.antragId !== 'string' || !w.antragId) continue;
      let set = tmp.get(w.antragId);
      if (!set) { set = new Set<string>(); tmp.set(w.antragId, set); }
      set.add(anonId);
    }
  }
  const out = new Map<string, string[]>();
  for (const [antragId, set] of tmp) out.set(antragId, [...set]);
  return out;
}

export interface MergeWuenscheResult {
  next: Zuweisung[];
  /** Anzahl neu angelegter `selbst`-Zuweisungen. */
  neu: number;
  /** Anzahl entfernter `selbst`-Zuweisungen (Retraktion: Wunsch zurueckgezogen). */
  entfernt: number;
}

const keyOf = (antragId: string, anonId: string): string => `${antragId}::${anonId}`;

/**
 * Merged die eingesammelten Wünsche in die bestehende Zuweisungs-Liste.
 *
 * Regeln:
 *  - Jeder Wunsch → `Zuweisung{status:'selbst', selbstEingetragen:true}`,
 *    dedupe per `(antragId, anonId)`. `stunden = anzahlTV × stundenProTV`.
 *  - `kuerzel → anonId` ueber `resolveAnonIdForUser` (NFC + Split bei
 *    Mehrfach-Kuerzel "MUE,SCH", Pitfall #22). Unbekanntes Kuerzel (noch nicht
 *    in der Map) → Wunsch ignoriert (der MA erscheint erst ueber
 *    Profil-Einsammeln / CSV).
 *  - `freigegeben`/`abgelehnt`/`vorgeschlagen`-Zuweisungen bleiben UNANGETASTET
 *    (PL-Entscheidungen + Matching-Vorschlaege sind autoritativ); fuer ein
 *    bereits zugewiesenes `(antragId, anonId)` wird KEIN konkurrierender
 *    `selbst`-Eintrag erzeugt.
 *  - Retraktion (Undo erreicht die PL): fuer jede anonId, deren Ordner in
 *    DIESEM Batch gelesen wurde, werden `selbst`-Eintraege entfernt, die nicht
 *    mehr in ihren aktuellen Wünschen stehen. anonIds OHNE Datei im Batch
 *    bleiben unangetastet (kein versehentliches Loeschen).
 *
 * Pure — kein FS, kein Store. Aufrufer persistiert das Ergebnis.
 */
export function mergeWuenscheIntoZuweisungen(
  current: readonly Zuweisung[],
  batch: readonly PersoenlicheUebernahmeWuensche[],
  anonymMap: AnonymMap,
  fallbackQuartal: string,
  stundenProTV: number,
): MergeWuenscheResult {
  // anonIds, deren Wunsch-Datei in diesem Lauf gelesen wurde (nur diese werden
  // reconciled). + gewuenschte selbst-Zuweisungen je (antragId, anonId).
  const collectedAnonIds = new Set<string>();
  const desired = new Map<string, Zuweisung>();

  for (const p of batch) {
    const anonId = resolveAnonIdForUser(p.kuerzel, anonymMap);
    if (!anonId) continue;
    collectedAnonIds.add(anonId);
    for (const w of p.wuensche) {
      const anzahlTV = w.anzahlTV > 0 ? w.anzahlTV : 1;
      desired.set(keyOf(w.antragId, anonId), {
        antragId: w.antragId,
        anonId,
        quartal: w.quartal || fallbackQuartal,
        anzahlTV,
        stunden: anzahlTV * stundenProTV,
        status: 'selbst',
        selbstEingetragen: true,
        selbstEingetragenAm: w.createdAt, // Klick-Zeitpunkt → „wer wollte zuerst"
      });
    }
  }

  const next: Zuweisung[] = [];
  let neu = 0;
  let entfernt = 0;

  for (const z of current) {
    const key = keyOf(z.antragId, z.anonId);
    const isSelbst = z.status === 'selbst' || z.selbstEingetragen === true;
    if (!isSelbst) {
      // PL-/Matching-Entscheidung — unveraendert behalten, konkurrierenden
      // Wunsch fuer dasselbe Paar verwerfen (kein Duplikat-Paar).
      next.push(z);
      desired.delete(key);
      continue;
    }
    if (!collectedAnonIds.has(z.anonId)) {
      // Ordner dieses MA nicht gelesen → unangetastet lassen.
      next.push(z);
      desired.delete(key);
      continue;
    }
    // Bestehender selbst-Eintrag eines in diesem Batch gelesenen MA.
    const refreshed = desired.get(key);
    if (refreshed) {
      next.push(refreshed); // aktualisierte Stunden/anzahlTV uebernehmen
      desired.delete(key);
    } else {
      entfernt++; // Retraktion: Wunsch zurueckgezogen
    }
  }

  // Uebrige desired-Eintraege = brandneue Wünsche.
  for (const z of desired.values()) {
    next.push(z);
    neu++;
  }

  return { next, neu, entfernt };
}
