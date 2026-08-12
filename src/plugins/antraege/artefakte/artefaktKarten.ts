/**
 * Artefakt-Leiste (Journey-Paket 2 Phase 7): reine View-Model-Ableitung für die
 * Karten-Leiste oberhalb der Daten-Sektionen der Verbund-Detailseite.
 *
 * Zwei Artefakte, orthogonal zum amtlichen Status (Artefakt-Engine): Gutachten
 * (GA) je Verbund + Nachforderung (NF) je Teilvorhaben. Die Leiste zeigt **nur
 * erreichte** Artefakte — keine grauen Platzhalter:
 *  - GA: Run vorhanden → Fortschritt; kein Run, aber in Fachprüfung → „Noch nicht
 *    begonnen"; sonst gar nicht.
 *  - NF: mindestens ein TV-NF-Run vorhanden → Fortschritt; sonst gar nicht.
 *
 * Rein + testbar — die Karten-Zahlen leiten sich aus denselben `WorkflowRun`-
 * Ständen ab, die auch die GA-/NF-Sektionen fahren (kein Fork). Die IO-Schicht
 * (`useArtefaktLeiste`) lädt Runs + Schritte und ruft diese Builder.
 */
import type { WorkflowStep } from '@/core/services/skills';
import { getStatusCategory, isAbgelehntZurueckgezogenStatus } from '@/core/utils/status-canonical';
import type { StepStatus, WorkflowRun } from '../gutachten/types';

/**
 * Wird dieser Verbund gerade fachlich geprüft — also: erscheint die GA-Karte
 * auch ohne Run?
 *
 * **Über die Arbeitsliste, nicht über den Verfahrensschritt.** Die Frage der
 * Karte ist „wer ist am Zug", und das ist genau die Achse, die im Code steht
 * (Pitfall #50). Bis v4.3 verglich der Aufrufer zwei feste ZAH-Phasen-Ids
 * (`'pruefung'`, `'entscheidung'`) — die brechen lautlos, sobald die PL den
 * Schnitt umhängt oder eine Phase umbenennt.
 *
 * Auf dem Auslieferungsschnitt ist das deckungsgleich (38/39/40 → `in_pruefung`,
 * 32/50/51/70–75 → `entscheidung`); unter einem kuratierten Schnitt folgt die
 * Karte der `kategorieVorgabe`, die die PL selbst setzt — und `KATEGORIE_ANKER`
 * hält die Codes fest, deren Arbeitsliste fachlich feststeht.
 *
 * Der Terminal-Ausschluss bleibt am ROHWERT hängen und nicht an der Kategorie:
 * `abgelehnt/zurückgezogen` führt der Förder-Katalog als `abgeschlossen`, eine
 * kuratierte Fassung kann es nach `abgelehnt` hängen — beides ist dieselbe
 * Aussage, und keine davon ist eine laufende Fachprüfung.
 */
export function istGutachtenPhase(status: string | null | undefined): boolean {
  if (isAbgelehntZurueckgezogenStatus(status)) return false;
  const kategorie = getStatusCategory(status);
  return kategorie === 'in_pruefung' || kategorie === 'entscheidung';
}

/** GA-Karte mit Fortschritt (Run vorhanden). */
export interface GutachtenKarteFortschritt {
  kind: 'fortschritt';
  freigegeben: number;
  gesamt: number;
  /** ID des aktuell offenen Abschnitts (z. B. `'D'`). */
  aktiverSchritt: string;
  /** Label des aktiven Abschnitts (z. B. `'Markt'`), falls die Def es kennt. */
  aktiverLabel: string | null;
  aktiverStatus: StepStatus;
}
/** GA-Karte „Noch nicht begonnen" (kein Run, aber in Fachprüfung). */
export interface GutachtenKarteLeer {
  kind: 'leer';
}
export type GutachtenKarte = GutachtenKarteFortschritt | GutachtenKarteLeer;

/**
 * GA-Karten-VM aus Run + aufgelösten Generierungs-Schritten. `null` = Karte nicht
 * rendern. `istFachpruefung` kommt vom Aufrufer (amtlicher Status → Stepper-Station
 * 3, siehe `statusZuStepperPosition`) — die Karte erscheint auch OHNE Run, sobald
 * der Verbund fachlich geprüft wird (dann als „Noch nicht begonnen").
 */
export function buildGutachtenKarte(
  run: WorkflowRun | null,
  steps: ReadonlyArray<Pick<WorkflowStep, 'id' | 'label'>>,
  istFachpruefung: boolean,
): GutachtenKarte | null {
  if (!run) return istFachpruefung ? { kind: 'leer' } : null;
  const gesamt = steps.length;
  const freigegeben = steps.filter(s => run.schritte[s.id]?.status === 'freigegeben').length;
  const aktiverSchritt = run.aktiverSchritt;
  const def = steps.find(s => s.id === aktiverSchritt);
  return {
    kind: 'fortschritt',
    freigegeben,
    gesamt,
    aktiverSchritt,
    aktiverLabel: def?.label ?? null,
    aktiverStatus: run.schritte[aktiverSchritt]?.status ?? 'leer',
  };
}

/** NF-Karte (mindestens ein TV-NF-Run vorhanden). */
export interface NachforderungKarte {
  /** TVs mit freigegebenem (= versandreifem) NF-Stand. */
  versendet: number;
  /** Gesamtzahl der Teilvorhaben. */
  tvGesamt: number;
  /** Nächstes noch nicht versendetes TV (1-basierter Anzeige-Index) — `null`, wenn alle versendet. */
  naechstesTv: { index: number; aktenzeichen: string } | null;
  /** Kurze Frist-Anzeige `DD.MM.` (amber Badge) — `null`, wenn keine Frist berechenbar. */
  fristKurz: string | null;
}

export interface NachforderungInput {
  /** Teilvorhaben in Anzeige-Reihenfolge (Aktenzeichen zählt). */
  tvs: ReadonlyArray<{ aktenzeichen: string }>;
  /** Geladene NF-Runs, indexiert per TV-Aktenzeichen (nur vorhandene). */
  nfRunByAz: ReadonlyMap<string, WorkflowRun>;
  /** ISO-Frist-Datum (phasen-bewusst, `computeFristDatum`) oder `null`. */
  fristDatum: string | null;
}

/**
 * NF-Karten-VM. `null` = Karte nicht rendern (noch KEIN NF-Run auf irgendeinem TV
 * → „nicht erreicht"). Versendet = TV-NF-Run mit `schritte.NF.status==='freigegeben'`.
 * Das nächste TV ist das erste (in Anzeige-Reihenfolge) ohne freigegebenen NF-Stand.
 */
export function buildNachforderungKarte({ tvs, nfRunByAz, fristDatum }: NachforderungInput): NachforderungKarte | null {
  const hatRun = tvs.some(tv => nfRunByAz.has(tv.aktenzeichen));
  if (!hatRun) return null;

  const istVersendet = (az: string): boolean => nfRunByAz.get(az)?.schritte.NF?.status === 'freigegeben';
  const versendet = tvs.filter(tv => istVersendet(tv.aktenzeichen)).length;
  const offenIdx = tvs.findIndex(tv => !istVersendet(tv.aktenzeichen));
  const naechstesTv = offenIdx >= 0
    ? { index: offenIdx + 1, aktenzeichen: tvs[offenIdx]!.aktenzeichen }
    : null;

  return { versendet, tvGesamt: tvs.length, naechstesTv, fristKurz: formatFristKurz(fristDatum) };
}

/** ISO-Datum → `DD.MM.` (kurze Frist-Badge). `null`/ungültig → `null`. Die
 *  Tag/Monat werden bei ISO `YYYY-MM-DD` direkt aus dem String gelesen
 *  (zeitzonen-unabhängig, kein UTC→lokal-Drift). */
export function formatFristKurz(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) return `${m[3]}.${m[2]}.`;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}
