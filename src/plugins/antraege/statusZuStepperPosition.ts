/**
 * Amtlicher Status → Position auf der ZAH-Phasen-Leiste.
 *
 * Die Stationen sind seit v2.384 die **ZAH-Phasen** des Status-Katalogs
 * (ausgeliefert: Eingang · Vollständigkeit · Prüfung · Entscheidung ·
 * Begleitung · Abgeschlossen), nicht mehr die fünf abgeleiteten
 * Spine-Stationen. Damit zeigt der Kopf dieselbe Achse, nach der Filter,
 * Cockpit und Erklärung gruppieren — und die PL kann einen Code umhängen, ohne
 * dass jemand Code anfasst.
 *
 * **Die Anzahl der Stationen steht nicht fest**: der Schnitt ist seit v2.409
 * kuratierbar (3 bis 9 Phasen, freie Beschriftung). Nichts in dieser Datei darf
 * deshalb sechs Stufen oder feste Phasen-Ids voraussetzen — auch nicht in den
 * Fallbacks.
 *
 * **Marker sind keine Stufe.** 29 Irrläufer, 88 Sonderstatus, 93/94
 * Partner-Kennzeichen laufen bewusst neben dem Verfahren. Sie bekommen deshalb
 * `station: null` und werden als Kennzeichen neben der Leiste gerendert — eine
 * Station „Irrläufer" hätte behauptet, sie seien ein Verfahrensschritt.
 *
 * **Terminal-negativ** (`abgelehnt` bzw. `abgelehnt/zurückgezogen`) bleibt ein
 * Abbruch mit X-Rendering, jetzt an der Abgeschlossen-Station: dorthin gehört
 * der Vorgang fachlich, und die alte Sonderposition „Abbruch in der Fachprüfung"
 * war eine Eigenheit der Spine-Achse.
 *
 * Vergleiche laufen über den Code-Katalog und die Kategorie-Helper, nie gegen
 * Status-Literale (Pitfall #12).
 */
import { getStatusCategory, isAbgelehntZurueckgezogenStatus } from '@/core/utils/status-canonical';
// Direktimporte auf die Quellmodule, NICHT über das Barrel `@/core/status` — das
// zieht `snapshot.ts` mit und damit einen Laufzeit-Zyklus (Zyklen-Wächter).
import { zahPhaseFuerStatusText, codeFuerStatusText } from '@/core/status/kategorie-ableitung';
import { istMarkerCode, zahPhasenVon } from '@/core/status/zah-phasen';
import type { StatusCategory } from '@/core/utils/status-canonical';
import type { ZahPhaseId } from '@/core/status/typen';

/** Eine Station der Leiste. Die `id` trägt die Identität — Beschriftungen sind
 *  frei und dürfen sich doppeln, Ids nicht. */
export interface StepperStationInfo {
  id: ZahPhaseId;
  label: string;
}

/**
 * Die Stationen in Verfahrens-Reihenfolge — aus dem GELTENDEN Schnitt.
 *
 * Je Aufruf abgeleitet, nicht als Modul-Konstante: der Schnitt hat zwischen 3
 * und 9 Phasen und wird im Baum-Editor geändert. Eine beim Import gerechnete
 * Liste bliebe für immer auf der Auslieferung stehen.
 */
export function getStepperStations(): StepperStationInfo[] {
  return zahPhasenVon().map(p => ({ id: p.id, label: p.label }));
}

/** 1-basierte Station; `null` = keine (Marker oder Status nicht im Katalog). */
export type StepperStation = number | null;

export interface StepperPosition {
  /** Aktive Station 1…n, `null` bei Marker/unbekannt. */
  station: StepperStation;
  /** Gesetzt bei final-negativem Ausgang → X-Rendering statt Ring. */
  terminal?: 'abgelehnt' | 'zurueckgezogen';
  /**
   * Marker-Status: läuft neben dem Verfahren. Trägt das Label für das
   * Kennzeichen neben der Leiste.
   */
  marker?: boolean;
}

/**
 * Station einer Phase (1-basiert); `null`, wenn der geltende Schnitt sie nicht
 * führt.
 *
 * Das `null` ist der Unterschied zu vorher: bei sechs festen Phasen konnte die
 * gesuchte Id gar nicht fehlen, seit der Editor sie löschen kann schon — und
 * `indexOf` hätte dann Station **0** geliefert, also eine Leiste mit einem Ring
 * vor der ersten Stufe.
 */
function stationVon(phase: ZahPhaseId): StepperStation {
  const i = getStepperStations().findIndex(s => s.id === phase);
  return i < 0 ? null : i + 1;
}

/**
 * Die letzte Phase, deren Arbeitsliste zu dieser Kategorie führt.
 *
 * Ersetzt die früher fest verdrahteten Ids (`stationVon('abgeschlossen')` …):
 * ein Schnitt aus drei Phasen hat keine Phase namens `abgeschlossen`, aber sehr
 * wohl eine, die auf `abgeschlossen` einzahlt. Die LETZTE gewinnt, weil die
 * Kategorie den Endzustand meint — bei `offen` (Eingang und Vollständigkeit
 * teilen sie sich) wollen wir dagegen die erste, deshalb der Parameter.
 */
function stationFuerKategorie(kategorie: StatusCategory, welche: 'erste' | 'letzte'): StepperStation {
  const treffer = zahPhasenVon()
    .map((p, i) => ({ p, station: i + 1 }))
    .filter(x => x.p.kategorieVorgabe === kategorie);
  const gewaehlt = welche === 'erste' ? treffer[0] : treffer[treffer.length - 1];
  return gewaehlt?.station ?? null;
}

/**
 * Bildet einen rohen amtlichen Status auf die Stepper-Position ab.
 *
 * - Marker (29/88/93/94) → `station: null`, `marker: true`.
 * - Terminal-negativ → Abgeschlossen-Station + `terminal`.
 * - Sonst die Station der ZAH-Phase.
 * - Status ohne Katalog-Treffer → `station: null` (nicht Station 1: „wir wissen
 *   es nicht" ist etwas anderes als „ganz am Anfang").
 */
export function statusZuStepperPosition(status: unknown): StepperPosition {
  const code = codeFuerStatusText(status);
  if (code !== null && istMarkerCode(code)) return { station: null, marker: true };

  if (isAbgelehntZurueckgezogenStatus(status)) {
    // Nur fürs Label: Kategorie `abgelehnt` (aus einer kuratierten Fassung) vs.
    // der amtliche `abgelehnt/zurückgezogen` (Kategorie `abgeschlossen`).
    const terminal = getStatusCategory(status) === 'abgelehnt' ? 'abgelehnt' : 'zurueckgezogen';
    return { station: stationFuerKategorie('abgeschlossen', 'letzte'), terminal };
  }

  const phase = zahPhaseFuerStatusText(status);
  if (phase !== null) {
    const station = stationVon(phase);
    // Verwaiste Zuordnung (die Fassung führt die Phase nicht mehr): keine
    // Station, aber auch kein Marker — wir wissen es schlicht nicht.
    if (station !== null) return { station };
  }

  // Unkuratierte Werte ohne amtlichen Code werden über die Kategorie
  // eingeordnet, damit der Stepper dort nicht leer bleibt.
  return { station: stationAusKategorie(status) };
}

/**
 * Fallback für unkuratierte Werte ohne amtlichen Code.
 *
 * Läuft über `kategorieVorgabe` statt über feste Phasen-Ids: welche Phase eine
 * Kategorie trägt, entscheidet seit v2.409 der Katalog. `nachforderung` (seit
 * v2.411 allein Code 35 „NF gestellt") und `bewilligt` haben keine eigene Phase
 * — sie sind Code-Ausnahmen innerhalb von Vollständigkeit bzw. Begleitung und
 * erben deshalb die Station der Phase, in der sie fachlich stecken.
 */
function stationAusKategorie(status: unknown): StepperStation {
  const kategorie = getStatusCategory(status);
  switch (kategorie) {
    case 'offen': return stationFuerKategorie('offen', 'erste');
    case 'nachforderung': return stationFuerKategorie('offen', 'letzte');
    case 'in_pruefung':
    case 'entscheidung':
    case 'begleitung':
    case 'abgeschlossen': return stationFuerKategorie(kategorie, 'erste');
    case 'bewilligt': return stationFuerKategorie('begleitung', 'erste');
    case 'abgelehnt': return stationFuerKategorie('abgeschlossen', 'letzte');
    default: return null;   // `sonstige`/leer: keine Aussage, keine Station
  }
}
