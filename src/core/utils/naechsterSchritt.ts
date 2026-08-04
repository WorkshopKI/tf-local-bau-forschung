import { getStatusLabel } from '@/core/utils/status-mappings';
import { getStatusCategory, isTerminalStatus } from '@/core/utils/status-canonical';

/**
 * Handlungs-Formel „Phase → nächster Schritt" — gemeinsame Core-Infrastruktur
 * für Home („Meine Anträge") UND die Förderanträge-Liste (kombinierte
 * „Status und nächster Schritt"-Spalte).
 *
 * Ersetzt die reine Status-Badge durch eine Aussage, WAS als Nächstes zu tun
 * ist — abgeleitet aus dem CSV-Roh-Status und (optional) dem PreCheck-Stand.
 *
 * Verschoben aus `src/plugins/home/naechsterSchritt.ts` (Journey-Paket 2,
 * Phase 1); der dortige `@deprecated`-Re-Export ist im Konsolidierungs-Pass
 * entfernt (Brücke ohne Konsumenten) — dies ist die einzige Heimat.
 */
export interface NaechsterSchritt {
  /** Phasen-Label, z.B. „Fachprüfung". */
  phase: string;
  /** Handlungs-Text, z.B. „Gutachten beginnen". Leer, wenn kein spezifischer
   *  Schritt gemappt ist (Fallback = nur Phase / Status-Label). */
  aktion: string;
}

/**
 * Normalisierte PreCheck-Klasse. Abgeleitet aus dem List-View-Label
 * `precheck_status_label` (NICHT ein Roh-Status-String) — das Label ist der
 * kuratierte Text der zuletzt gesetzten `D_PC*`/`D_XPC*`-Datumsspalte, z.B.
 * „PreCheck positiv - Verbund".
 */
export type PrecheckKlasse = 'positiv' | 'negativ' | 'offen' | 'ohne';

/**
 * Klassifiziert ein `precheck_status_label` in eine grobe PreCheck-Klasse.
 *
 * - leer / kein Label            → `'ohne'`  (PreCheck noch nicht gelaufen)
 * - enthält „negativ"            → `'negativ'`
 * - enthält „positiv"           → `'positiv'`
 * - vorhanden, aber weder/noch   → `'offen'` (ausstehend / in Bearbeitung)
 *
 * NFC-normalisiert + lowercase, damit Umlaut-/Encoding-Varianten robust matchen.
 * Der Wort-Match läuft VOR dem Roh-Code-Fallback (`D_PC+`/`D_PC-`), damit ein
 * Label wie „PreCheck positiv - Verbund" (enthält einen Bindestrich!) nicht
 * fälschlich als negativ klassifiziert wird.
 */
export function normalisierePrecheck(label: string | null | undefined): PrecheckKlasse {
  const s = typeof label === 'string' ? label.normalize('NFC').trim().toLowerCase() : '';
  if (s.length === 0) return 'ohne';
  if (s.includes('negativ')) return 'negativ';
  if (s.includes('positiv')) return 'positiv';
  // Fallback für den Fall, dass doch mal ein Roh-Code (D_PC+/D_PC-/D_PC?)
  // statt des Labels durchgereicht wird.
  if (s.includes('pc-')) return 'negativ';
  if (s.includes('pc+')) return 'positiv';
  return 'offen';
}

/**
 * Roh-Status → Handlungs-Formel. Bewusst ein reiner **Record-Lookup** (keine
 * `=== 'literal'`-Vergleiche → Pitfall #12 bleibt unberührt; die Zuordnung lebt
 * hier als Daten-Tabelle analog `STATUS_LABELS`).
 *
 * Die Tabelle deckt die relevanten offenen Bearbeitungs-Stati ab. Unbekannte /
 * nicht gemappte Stati fallen NIE durch: sie bekommen
 * `{ phase: getStatusLabel(status), aktion: '' }` (nur die Phase, keine
 * erratene Aktion — siehe `naechsterSchritt`).
 */
const SCHRITT_BY_STATUS: Record<string, NaechsterSchritt> = {
  beantragt: { phase: 'Eingang', aktion: 'Vollständigkeit prüfen' },
  bearbeitungsreif: { phase: 'Eingang', aktion: 'Vollständigkeit prüfen' },
  'NL eingegangen': { phase: 'Vollständigkeit', aktion: 'Nachlieferung prüfen' },
  // Die Begleitphase (VN-/ZB-Stati) steht bewusst NICHT in dieser Tabelle: ein
  // geprüfter Verwendungsnachweis löst kein Gutachten aus, und der Ablauf nach
  // der Bewilligung ist hier nicht abgebildet. Sie fällt damit auf den unten
  // beschriebenen Weg — nur die Phase, keine erratene Aktion. Eine falsche
  // Anweisung wäre schlechter als keine.
  'techn geprüft': { phase: 'Fachprüfung', aktion: 'Gutachten beginnen' },
  'kaufm geprüft': { phase: 'Fachprüfung', aktion: 'Gutachten beginnen' },
  'Gutachten fertig': { phase: 'Fachprüfung', aktion: 'Gutachten freigeben' },
  bewilligungsreif: { phase: 'Fachprüfung', aktion: 'Bewilligung vorbereiten' },
  ablehnungsreif: { phase: 'Fachprüfung', aktion: 'Ablehnungsbescheid erstellen' },
  'NF gestellt': { phase: 'Nachforderung', aktion: 'Nachforderung nachhalten' },
  'keine weiteren NF': { phase: 'Nachforderung', aktion: 'Nachforderung nachhalten' },
};

/**
 * Leitet die „Phase → Aktion"-Formel aus dem Roh-Status (+ optional PreCheck)
 * ab.
 *
 * **PreCheck-Regeln (vor den Status-Regeln, nur für NICHT-terminale Anträge):**
 * - PreCheck negativ                       → `{ Eingang, 'PreCheck-Ergebnis klären' }`
 * - PreCheck fehlt/ausstehend UND Status in
 *   der Eingangs-Phase (`getStatusCategory === 'offen'`)
 *                                           → `{ Eingang, 'PreCheck durchführen' }`
 *
 * **Status-Regeln (Fallback):**
 * - Gemappter Status → kuratierte `{ phase, aktion }`.
 * - Nicht gemappter, aber gesetzter Status → `{ phase: getStatusLabel(s), aktion: '' }`.
 * - Leerer / fehlender Status → `null` (der Renderer zeigt gar keine Formel).
 *
 * Abwärtskompatibel: Wird das 2. Argument **weggelassen** (`undefined`),
 * verhält sich die Funktion exakt wie vor Journey-Paket 2 — die PreCheck-Regeln
 * greifen NICHT. Erst ein **explizit übergebener** Wert (auch `null`/`''` =
 * „PreCheck nachweislich nicht vorhanden") aktiviert sie. So bleibt ein Aufruf
 * ohne PreCheck-Kontext (Legacy) unverändert, während Home/Liste die Regel
 * bewusst über `precheck_status_label ?? ''` opt-in schalten.
 */
export function naechsterSchritt(
  status: string | undefined | null,
  precheckStatus?: string | null,
): NaechsterSchritt | null {
  const s = typeof status === 'string' ? status.trim() : '';
  if (s.length === 0) return null;

  // --- PreCheck-Regeln (nur bei übergebenem Kontext + nicht-terminalem Antrag) ---
  if (precheckStatus !== undefined && !isTerminalStatus(s)) {
    const pc = normalisierePrecheck(precheckStatus);
    if (pc === 'negativ') {
      return { phase: 'Eingang', aktion: 'PreCheck-Ergebnis klären' };
    }
    if ((pc === 'ohne' || pc === 'offen') && getStatusCategory(s) === 'offen') {
      return { phase: 'Eingang', aktion: 'PreCheck durchführen' };
    }
  }

  // --- Status-Regeln (bisheriges Verhalten) ---
  const mapped = SCHRITT_BY_STATUS[s];
  if (mapped) return mapped;
  return { phase: getStatusLabel(s), aktion: '' };
}
