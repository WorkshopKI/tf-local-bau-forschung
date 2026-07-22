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
import { resolveAnonIdForUser, type AnonymMap } from '../identitaet/anonym-map';
import { hatBearbeiterKuerzel, istZuVerteilen } from '../verbund/verbund-aggregation';
import type { AntragOderSlim } from '@/core/services/csv/types';
import type { PersoenlicheUebernahmeWuensche, Zuweisung } from '../../types';

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

/** Momentaufnahme der persoenlichen Wunsch-Dateien (v2.290). */
export interface WunschStand {
  /** antragId → anonIds mit aktuellem Wunsch. */
  byAntrag: Map<string, string[]>;
  /** anonIds, deren Wunsch-Datei in diesem Lauf tatsaechlich gelesen wurde. Nur
   *  fuer diese ist die Datei-Sicht vollstaendig — jede Rueckzugs-Aussage haengt
   *  daran (dieselbe Regel wie die Retraktion in `mergeWuenscheIntoZuweisungen`). */
  gelesenAnonIds: Set<string>;
}

/**
 * Reine Gruppierung der eingelesenen Wünsche zu `antragId → anonIds[]` (dedupe)
 * plus der Menge gelesener anonIds. Kürzel werden via AnonymMap aufgelöst
 * (NFC + Split, Pitfall #22); unauflösbare Kürzel übersprungen. Für die
 * Read-only-Sicht im Zuweisungs-Cockpit VOR dem Einsammeln — schreibt NICHT in
 * den Store.
 */
export function buildWunschStand(
  batch: readonly PersoenlicheUebernahmeWuensche[],
  anonymMap: AnonymMap,
): WunschStand {
  const tmp = new Map<string, Set<string>>();
  const gelesenAnonIds = new Set<string>();
  for (const p of batch) {
    const anonId = resolveAnonIdForUser(p.kuerzel, anonymMap);
    if (!anonId) continue;
    gelesenAnonIds.add(anonId);
    for (const w of p.wuensche) {
      if (!w || typeof w.antragId !== 'string' || !w.antragId) continue;
      let set = tmp.get(w.antragId);
      if (!set) { set = new Set<string>(); tmp.set(w.antragId, set); }
      set.add(anonId);
    }
  }
  const byAntrag = new Map<string, string[]>();
  for (const [antragId, set] of tmp) byAntrag.set(antragId, [...set]);
  return { byAntrag, gelesenAnonIds };
}

/** Nur die `antragId → anonIds`-Sicht des Wunsch-Stands (Bequemlichkeits-Wrapper). */
export function buildPendingByAntrag(
  batch: readonly PersoenlicheUebernahmeWuensche[],
  anonymMap: AnonymMap,
): Map<string, string[]> {
  return buildWunschStand(batch, anonymMap).byAntrag;
}

/**
 * `selbst`-Zuweisungen, die im persoenlichen Ordner ihres MA nicht mehr stehen —
 * der MA hat den Wunsch zurueckgezogen, die PL hat aber noch nicht eingesammelt
 * (v2.290). Erlaubt der Cockpit-Anzeige, den Rueckzug SOFORT zu beruecksichtigen;
 * `mergeWuenscheIntoZuweisungen` persistiert dieselbe Entscheidung spaeter.
 *
 * Beurteilt werden nur anonIds mit gelesener Datei (sonst waere „fehlt in der
 * Datei" nicht von „Datei nicht gelesen" unterscheidbar) und nur echte
 * `status:'selbst'`-Eintraege — PL-Freigaben sind autoritativ.
 */
export function findeZurueckgezogeneWuensche(
  zuweisungen: readonly Zuweisung[],
  stand: WunschStand,
): Zuweisung[] {
  const out: Zuweisung[] = [];
  for (const z of zuweisungen) {
    if (z.status !== 'selbst') continue;
    if (!stand.gelesenAnonIds.has(z.anonId)) continue;
    if (stand.byAntrag.get(z.antragId)?.includes(z.anonId)) continue;
    out.push(z);
  }
  return out;
}

// ─── Zuweisbarkeit: steht der gewuenschte Antrag ueberhaupt in der Liste? ──
// Ohne diese Pruefung legt der Merge `selbst`-Records fuer Antraege an, die die
// Zuweisungs-Liste gar nicht fuehrt (inzwischen gekuerzelt, aus dem rollierenden
// Fenster gefallen, unbekannt). Solche Records sind unsichtbar, buchen aber
// Pending-Stunden — und `reconcileZuweisungen` raeumt sie beim naechsten
// Sessionstart weg, sodass das Einsammeln sie ewig als „neu" neu meldet.

/** Warum ein gelesener Wunsch nicht (mehr) zuweisbar ist. */
export type NichtZuweisbarGrund = 'unbekannt' | 'gekuerzelt' | 'ausserhalb-pool';

/** Klartext je Grund — fuer den PL-Tooltip an der Einsammel-Bilanz. */
export const NICHT_ZUWEISBAR_TEXT: Record<NichtZuweisbarGrund, string> = {
  unbekannt: 'Antrag nicht im aktuellen Datenbestand',
  gekuerzelt: 'bereits vergeben (TIB-Kürzel in der CSV)',
  'ausserhalb-pool': 'nicht mehr im Verteil-Fenster',
};

/** Prüft einen Wunsch auf Zuweisbarkeit: `null` = zuweisbar. */
export type ZuweisbarkeitsPruefung = (antragId: string) => NichtZuweisbarGrund | null;

/**
 * Baut die Prüfung aus dem Antrags-Bestand: ein Wunsch ist nur dann eine
 * gültige Bewerbung, wenn sein Antrag im selben Verteil-Pool steht wie die
 * Zuweisungs-Liste (`istZuVerteilen`). Dieselben Helfer wie die Liste — damit
 * „zuweisbar" und „steht in der Liste" nicht auseinanderlaufen können.
 *
 * `cutoffDatum === null` (kein gültiges Quartal) → nur der Kürzel-Check greift,
 * analog zur Liste, die dann ebenfalls ohne Datums-Filter arbeitet.
 */
export function buildZuweisbarkeitsPruefung(
  antraege: ReadonlyArray<AntragOderSlim>,
  cutoffDatum: string | null,
): ZuweisbarkeitsPruefung {
  const byAz = new Map(antraege.map(a => [a.aktenzeichen, a]));
  return (antragId) => {
    const antrag = byAz.get(antragId);
    if (!antrag) return 'unbekannt';
    if (hatBearbeiterKuerzel(antrag)) return 'gekuerzelt';
    if (cutoffDatum !== null && !istZuVerteilen(antrag, cutoffDatum)) return 'ausserhalb-pool';
    return null;
  };
}

/** Ein Wunsch als Paar (fuer die „wer/was"-Anzeige der PL). */
export interface WunschRef {
  antragId: string;
  anonId: string;
  /** Nur bei nicht zuweisbaren Wünschen gesetzt — speist den Grund-Tooltip. */
  grund?: NichtZuweisbarGrund;
}

export interface MergeWuenscheResult {
  next: Zuweisung[];
  /** Anzahl neu angelegter `selbst`-Zuweisungen. */
  neu: number;
  /** Anzahl entfernter `selbst`-Zuweisungen (Retraktion: Wunsch zurueckgezogen). */
  entfernt: number;
  /** Gelesene Wünsche, deren Verbund bereits vergeben ist — erledigt, aber noch
   *  in der persoenlichen Datei des MA. Erklaert die Differenz „gelesen" vs.
   *  „neu" (v2.290); der MA raeumt sie beim naechsten Home-Besuch selbst weg. */
  bereitsVergeben: number;
  /** Gelesene Wünsche auf Antraege, die die Zuweisungs-Liste nicht (mehr)
   *  fuehrt. Werden NICHT als `selbst` angelegt — ein solcher Record waere
   *  unsichtbar. Erklaert die Differenz „gelesen" vs. „neu". */
  nichtZuweisbar: number;
  /** Details zu `neu` / `entfernt` — die PL sieht im Tooltip WER WAS. */
  neueEintraege: WunschRef[];
  entfernteEintraege: WunschRef[];
  /** Details zu `nichtZuweisbar` inkl. Grund — Tooltip an der Bilanz. */
  nichtZuweisbareEintraege: WunschRef[];
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
 *    `selbst`-Eintrag erzeugt. Retraktion greift ausschliesslich bei
 *    `status:'selbst'` — `selbstEingetragen` ueberlebt die Freigabe und darf
 *    eine Freigabe nicht ausknipsen, wenn der MA seine Datei aufraeumt.
 *  - Verbund-Sperre (eine Einheit, ein Bearbeiter): ist IRGENDEIN TV des
 *    Verbundes bereits `freigegeben`, wird fuer diesen Verbund KEIN neuer
 *    `selbst`-Wunsch erzeugt — egal von welchem MA. Ein dabei bereits gelesener
 *    veralteter Selbst-Eintrag faellt ueber die Retraktion unten raus (raeumt
 *    Altdaten auf). Mehrere Interessenten VOR der Freigabe bleiben erlaubt
 *    (Pitfall #26) — die Sperre greift erst nach der Freigabe.
 *  - Zuweisbarkeit (`pruefeZuweisbar`): Wünsche auf Antraege, die die
 *    Zuweisungs-Liste nicht (mehr) fuehrt, werden NICHT angelegt und in
 *    `nichtZuweisbar` ausgewiesen. Ohne diese Pruefung entstuenden unsichtbare
 *    Records (siehe `buildZuweisbarkeitsPruefung`).
 *  - Retraktion (Undo erreicht die PL): fuer jede anonId, deren Ordner in
 *    DIESEM Batch gelesen wurde, werden `selbst`-Eintraege entfernt, die nicht
 *    mehr in ihren aktuellen Wünschen stehen. anonIds OHNE Datei im Batch
 *    bleiben unangetastet (kein versehentliches Loeschen). Das raeumt auch die
 *    Altlasten gesperrter/nicht zuweisbarer Wünsche auf.
 *
 * `verbundKeyOfAntrag` mappt eine TV-`antragId` auf ihren Verbund-Key (Default
 * Identitaet = jeder Antrag ein eigener Verbund). Pure — kein FS, kein Store.
 * Aufrufer persistiert das Ergebnis.
 */
export function mergeWuenscheIntoZuweisungen(
  current: readonly Zuweisung[],
  batch: readonly PersoenlicheUebernahmeWuensche[],
  anonymMap: AnonymMap,
  fallbackQuartal: string,
  stundenProTV: number,
  verbundKeyOfAntrag: (antragId: string) => string = (id) => id,
  pruefeZuweisbar: ZuweisbarkeitsPruefung = () => null,
): MergeWuenscheResult {
  // Verbund-Keys mit bestehender Freigabe — fuer diese werden keine neuen
  // Selbst-Wünsche mehr angelegt (eine Einheit, ein Bearbeiter).
  const freigegebeneVerbundKeys = new Set<string>();
  for (const z of current) {
    if (z.status === 'freigegeben') freigegebeneVerbundKeys.add(verbundKeyOfAntrag(z.antragId));
  }

  // anonIds, deren Wunsch-Datei in diesem Lauf gelesen wurde (nur diese werden
  // reconciled). + gewuenschte selbst-Zuweisungen je (antragId, anonId).
  const collectedAnonIds = new Set<string>();
  const desired = new Map<string, Zuweisung>();
  const nichtZuweisbareEintraege: WunschRef[] = [];
  let bereitsVergeben = 0;

  for (const p of batch) {
    const anonId = resolveAnonIdForUser(p.kuerzel, anonymMap);
    if (!anonId) continue;
    collectedAnonIds.add(anonId);
    for (const w of p.wuensche) {
      // Verbund schon vergeben → Wunsch ignorieren (ein bereits vorhandener
      // veralteter Selbst-Eintrag dieses MA wird unten als Retraktion entfernt).
      if (freigegebeneVerbundKeys.has(verbundKeyOfAntrag(w.antragId))) {
        bereitsVergeben++;
        continue;
      }
      // Antrag steht nicht (mehr) in der Zuweisungs-Liste → kein unsichtbarer
      // Record; die PL bekommt den Fall stattdessen in der Bilanz genannt.
      const grund = pruefeZuweisbar(w.antragId);
      if (grund) {
        nichtZuweisbareEintraege.push({ antragId: w.antragId, anonId, grund });
        continue;
      }
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
  const neueEintraege: WunschRef[] = [];
  const entfernteEintraege: WunschRef[] = [];

  for (const z of current) {
    const key = keyOf(z.antragId, z.anonId);
    if (z.status !== 'selbst') {
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
      // Retraktion: Wunsch zurueckgezogen (oder Verbund inzwischen vergeben).
      entfernteEintraege.push({ antragId: z.antragId, anonId: z.anonId });
    }
  }

  // Uebrige desired-Eintraege = brandneue Wünsche.
  for (const z of desired.values()) {
    next.push(z);
    neueEintraege.push({ antragId: z.antragId, anonId: z.anonId });
  }

  return {
    next,
    neu: neueEintraege.length,
    entfernt: entfernteEintraege.length,
    bereitsVergeben,
    nichtZuweisbar: nichtZuweisbareEintraege.length,
    neueEintraege,
    entfernteEintraege,
    nichtZuweisbareEintraege,
  };
}
