/**
 * Relative, ampel-gefärbte Frist-Anzeige für die Förderanträge-Tabelle
 * (Journey-Paket 2 Phase 4).
 *
 * Ersetzt den Roh-Tage-Text (`+45d` / `-2807d`) durch eine humanisierte
 * relative Angabe (`in 45 T` / `seit 2807 T` / `heute`) plus einen Ampel-Punkt.
 *
 * **Frist-Quelle (bewusst gewählte Priorität):** die einzige, phasen-bewusste
 * Frist aus `computeFristDatum`/`daysUntilFristAware` (csv-Layer) —
 * Antragsphase = `antragsdatum + 90 Tage`, Begleitphase = `vn_eingang_datum +
 * 6 Monate`. Es gibt in der Liste keinen zweiten „expliziten" Frist-Wert; die
 * phasen-aware Frist IST die explizite Frist. Ist sie nicht berechenbar
 * (Begleitphase ohne VN-Eingang, fehlendes Antragsdatum) → `null` = leere
 * Zelle (ehrlich: unbekannte Frist wird nicht erfunden).
 *
 * **Terminal-Anträge** (`isTerminalStatus`: abgeschlossen/abgelehnt) → `null`:
 * für erledigte Arbeit läuft keine Frist mehr.
 *
 * Sowohl Text als auch Ampel werden aus **denselben** „Tage bis zur Frist"
 * abgeleitet (statt Text aus der Frist + Farbe aus dem Eingangsalter) — so
 * bleibt die Aussage über beide Phasentypen (90-Tage-SLA und VN-Frist) kohärent.
 * Die Ampel-Stufen sind die bestehenden `EingangAmpel`-Werte, die Punkt-Farbe
 * kommt aus dem bestehenden `AMPEL_COLOR` (keine neuen Tokens).
 */

import type { AntragListItem } from '@/core/services/csv/types';
import { isTerminalStatus } from '@/core/utils/status-canonical';
import { daysUntilFristAware } from '@/core/services/csv/frist';
import type { EingangAmpel } from './eingangAmpel';

export interface FristAnzeige {
  /** Relative Anzeige: `in {n} T` (Frist läuft), `seit {n} T` (überfällig),
   *  `heute` (Frist heute). */
  text: string;
  /** Ampel-Stufe für den farbigen Punkt — Farbe via `AMPEL_COLOR`. */
  ampel: EingangAmpel;
}

/** Relative Tages-Anzeige aus vorzeichenbehafteten „Tagen bis zur Frist".
 *  Positiv = Frist in der Zukunft (`in n T`), 0 = `heute`, negativ =
 *  überfällig (`seit n T`). Kein Roh-`-2807d` mehr. */
export function fristTextFromDays(d: number): string {
  if (d === 0) return 'heute';
  if (d > 0) return `in ${d} T`;
  return `seit ${-d} T`;
}

/** Ampel-Stufe aus „Tagen bis zur Frist" — überfällig → rot, sonst je näher
 *  die Frist rückt, desto wärmer. Schwellen bewusst frist-relativ (nicht
 *  eingangs-relativ), damit sie für Antrags- wie VN-Frist gleich lesen:
 *  ≤ 0 rot · ≤ 14 orange · ≤ 30 gelb · sonst grün. */
export function fristAmpelFromDays(d: number): EingangAmpel {
  if (d < 0) return 'rot';
  if (d <= 14) return 'orange';
  if (d <= 30) return 'gelb';
  return 'gruen';
}

/** Anzeige aus vorberechneten „Tagen bis zur Frist" (z.B. der kritischsten
 *  Verbund-Frist via `criticalFristAware`). `null` → leere Zelle. */
export function fristAnzeigeFromDays(d: number | null): FristAnzeige | null {
  if (d === null) return null;
  return { text: fristTextFromDays(d), ampel: fristAmpelFromDays(d) };
}

/**
 * Relative Frist-Anzeige eines einzelnen Antrags. `null` (leere Zelle) für
 * terminale Anträge und für Anträge ohne berechenbare Frist.
 *
 * `nowMs` injizierbar für deterministische Tests (statt `Date.now()`).
 */
export function fristAnzeige(
  antrag: Pick<AntragListItem, 'status' | 'antragsdatum' | 'vn_eingang_datum'>,
  nowMs: number = Date.now(),
): FristAnzeige | null {
  if (isTerminalStatus(antrag.status)) return null;
  return fristAnzeigeFromDays(daysUntilFristAware(antrag, nowMs));
}
