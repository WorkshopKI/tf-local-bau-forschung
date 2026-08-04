/**
 * Die ZAH-Phasen: Beschriftung, Reihenfolge und der ausgelieferte Phasen-Schnitt.
 *
 * **Warum es diese Achse gibt**: das Fachsystem kennt keine Phasen. Es kennt
 * Status-Codes (11 Skizze … 99 Schlussvermerk) und ist damit fertig. Die Phase
 * ist die Lesebrille der App — Gruppierung, Filter, Sortierung — und wird
 * deshalb ehrlich als App-Erfindung benannt statt als amtlicher Zustand
 * ausgegeben. `VB_PHASE` heißt trotz des Namens etwas ganz anderes: die
 * Fördervariante (`vb-phase-mappings.ts`).
 *
 * **Warum eine Tabelle statt einer Code-Bereichs-Regel**: die Codes sind nur
 * grob geordnet. 32 (ablehnungsreif) liegt vor 34 (bearbeitungsreif), 50/51
 * (Bewilligungsentwurf/-reif) vor 59 (bewilligt), aber 70–75 (Ablehnung,
 * Rücknahmeempfehlung, Widerspruch) gehören wieder zur Entscheidung. Jede
 * Bereichsregel bräuchte mehr Ausnahmen als Regeln.
 *
 * **Phase ≠ Rolle.** Neben der fachlichen Prüfung (FB) läuft die administrative
 * (AB) — parallel, nicht nacheinander; der Kürzel-Katalog zeigt es an seinen
 * durchgehenden Paaren (AK4/AT4, ARK/ART, ABLK/ABLT). Eine Phase
 * „Administrative Prüfung" neben „Fachprüfung" wäre falsch modelliert: ein TV
 * wäre ständig in beiden. Die Phase sagt WO im Verfahren, die Rolle WER dran ist.
 *
 * **Dieser Schnitt ist die Auslieferung — er wird nicht in der App editiert.** Ein
 * früherer Modulkopf versprach das („im Cockpit editierbar"); ein Bedienelement
 * dafür gab es nie. Es soll auch keins geben: `prod` lädt keine Katalog-Fassung,
 * ein in `pl` geänderter Schnitt wäre also eine zweite stille Wahrheit, die nur
 * ein Teil des Teams sähe.
 *
 * Der Änderungsweg läuft stattdessen über die Seite „Zu klären": die Kollegen
 * prüfen und kommentieren den Schnitt dort, das Ergebnis wird exportiert, hier im
 * Seed geändert und mit dem nächsten Release ausgeliefert
 * (`docs/architecture/klaerung.md`).
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import type { ZahPhase, ZahPhaseId } from './typen';

/** Anzeige-Reihenfolge entlang des Verfahrens. */
export const ZAH_PHASEN_REIHENFOLGE: readonly ZahPhaseId[] = [
  'eingang',
  'vollstaendigkeit',
  'pruefung',
  'entscheidung',
  'begleitung',
  'abgeschlossen',
];

/**
 * Beschriftungen. „Prüfung" heißt bewusst nicht „Fachprüfung": sie umfasst den
 * fachlichen UND den administrativen Strang (siehe Modulkopf).
 */
export const ZAH_PHASE_LABEL: Record<ZahPhaseId, string> = {
  eingang: 'Eingang',
  vollstaendigkeit: 'Vollständigkeit',
  pruefung: 'Prüfung',
  entscheidung: 'Entscheidung',
  begleitung: 'Begleitung',
  abgeschlossen: 'Abgeschlossen',
};

/** Beschriftung der Marker-Gruppe (Status ohne Phase). */
export const ZAH_MARKER_LABEL = 'Marker (ohne Phase)';

/** Die ausgelieferte Phasen-Tabelle (Zehnerlücken für spätere Einschübe). */
export const SEED_ZAH_PHASEN: readonly ZahPhase[] = ZAH_PHASEN_REIHENFOLGE.map((id, i) => ({
  id,
  label: ZAH_PHASE_LABEL[id],
  reihenfolge: (i + 1) * 10,
}));

/**
 * Der ausgelieferte Phasen-Schnitt: Status-Code → ZAH-Phase.
 *
 * Codes, die hier fehlen, sind **Marker** (29 Irrläufer, 88 Sonderstatus, 93
 * assoziierter Partner, 94 internationaler Partner): sie laufen als Kennzeichen
 * neben dem Verfahren mit und bekommen bewusst keine Phase.
 */
export const SEED_CODE_ZU_ZAH_PHASE: ReadonlyMap<number, ZahPhaseId> = new Map<number, ZahPhaseId>([
  [11, 'eingang'],
  [31, 'eingang'],

  [33, 'vollstaendigkeit'],
  [34, 'vollstaendigkeit'],
  [35, 'vollstaendigkeit'],
  [36, 'vollstaendigkeit'],
  [37, 'vollstaendigkeit'],

  [38, 'pruefung'],
  [39, 'pruefung'],
  [40, 'pruefung'],

  [32, 'entscheidung'],
  [50, 'entscheidung'],
  [51, 'entscheidung'],
  [70, 'entscheidung'],
  [71, 'entscheidung'],
  [72, 'entscheidung'],
  [75, 'entscheidung'],

  [59, 'begleitung'],
  [89, 'begleitung'],
  [92, 'begleitung'],
  [95, 'begleitung'],
  [97, 'begleitung'],

  [73, 'abgeschlossen'],
  [90, 'abgeschlossen'],
  [91, 'abgeschlossen'],
  [99, 'abgeschlossen'],
]);

/** Marker-Codes: bewusst ohne Phase, nicht „vergessen". */
export const SEED_MARKER_CODES: ReadonlySet<number> = new Set([29, 88, 93, 94]);

/**
 * Sortier-Rang einer Phase für Gruppierungen. Marker (`null`/`undefined`) sinken
 * ans Ende — sie stehen neben dem Verfahren, nicht darin.
 */
export function zahPhaseRang(
  id: ZahPhaseId | null | undefined, phasen?: readonly ZahPhase[],
): number {
  if (!id) return Number.MAX_SAFE_INTEGER;
  const aus = phasen?.find(p => p.id === id);
  if (aus) return aus.reihenfolge;
  const i = ZAH_PHASEN_REIHENFOLGE.indexOf(id);
  return i < 0 ? Number.MAX_SAFE_INTEGER : (i + 1) * 10;
}

/** Beschriftung einer Phase; `null`/unbekannt → Marker-Beschriftung. */
export function zahPhaseLabel(
  id: ZahPhaseId | null | undefined, phasen?: readonly ZahPhase[],
): string {
  if (!id) return ZAH_MARKER_LABEL;
  return phasen?.find(p => p.id === id)?.label ?? ZAH_PHASE_LABEL[id] ?? ZAH_MARKER_LABEL;
}

/** Die Phasen einer Fassung in Anzeige-Reihenfolge (Fallback: Auslieferung). */
export function zahPhasenVon(phasen?: readonly ZahPhase[]): ZahPhase[] {
  const quelle = phasen && phasen.length > 0 ? phasen : SEED_ZAH_PHASEN;
  return [...quelle].sort((a, b) => a.reihenfolge - b.reihenfolge);
}
