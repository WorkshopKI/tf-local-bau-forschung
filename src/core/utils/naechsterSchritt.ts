import { statusKurzLabel } from '@/core/utils/status-wert-labels';
import { isTerminalStatus } from '@/core/utils/status-canonical';
// Direktimport, nicht über das Barrel `@/core/status` — das zöge `snapshot.ts`
// und damit `status-canonical.ts` zurück (Laufzeit-Zyklus, Zyklen-Wächter).
import { zahPhaseFuerStatusText } from '@/core/status/kategorie-ableitung';

/**
 * Handlungs-Formel „was ist als Nächstes zu tun" — gemeinsame Core-Infrastruktur
 * für Home („Meine Anträge"), das Kanban-Widget, die Förderanträge-Liste
 * (kombinierte „Status und nächster Schritt"-Spalte) und den Assistenten-Kontext.
 *
 * Ersetzt die reine Status-Badge durch eine Aussage, WAS als Nächstes zu tun
 * ist — abgeleitet aus dem CSV-Roh-Status und (optional) dem PreCheck-Stand.
 *
 * **Kein Phasenwort mehr (v4.3).** Bis dahin gab die Formel links ein
 * Verfahrensschritt-Wort aus einer eigenen Tabelle aus — ein DRITTES Vokabular
 * neben dem Katalog und der Arbeitsliste. Zwei seiner fünf Wörter („Fachprüfung",
 * „Nachforderung") waren in keiner Fassung ein Phasenlabel, und `bearbeitungsreif`
 * stand hier unter „Eingang", laut Auslieferung aber in „Vollständigkeit". Wer
 * den Verfahrensschritt sehen will, liest ihn dort, wo er EINE Heimat hat: an der
 * Verfahrensleiste (`zahPhaseLabel`). Hier steht nur noch die Handlung.
 *
 * Verschoben aus `src/plugins/home/naechsterSchritt.ts` (Journey-Paket 2,
 * Phase 1); der dortige `@deprecated`-Re-Export ist im Konsolidierungs-Pass
 * entfernt (Brücke ohne Konsumenten) — dies ist die einzige Heimat.
 */
export interface NaechsterSchritt {
  /** Handlungs-Text, z.B. „Gutachten beginnen". Leer, wenn kein spezifischer
   *  Schritt gemappt ist — der Aufrufer zeigt dann die Status-Kurzform. */
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
 * Die beiden PreCheck-Teile eines Antrags, so wie die List-View sie führt.
 * `tv` = Vorprüfung des AB am Teilvorhaben, `vb` = Vorprüfung des FB am Verbund.
 */
export interface PrecheckTeile {
  tv?: string | null;
  vb?: string | null;
}

/** Das zusammengeführte Urteil plus das Label, das es trägt. */
export interface PrecheckUrteil {
  klasse: PrecheckKlasse;
  /** Das Label des Teils, der das Urteil trägt — leer bei `'ohne'`. */
  label: string;
}

/** Rang der Klassen: das Schwerwiegendere gewinnt. */
const KLASSEN_RANG: Record<PrecheckKlasse, number> = { negativ: 0, positiv: 1, offen: 2, ohne: 3 };

/**
 * Führt TV- und Verbund-PreCheck zu **einem** Urteil zusammen — für die Stellen,
 * die genau eine Aussage brauchen (Quickfilter, „nächster Schritt", die
 * verdichtete Spalte „FB / PreCheck").
 *
 * **Negativ schlägt positiv, nicht das jüngere Datum.** Genau das war der Fehler
 * der alten gemeinsamen Gruppe: sie nahm das jüngste Datum, und weil der
 * Verbund-PreCheck nach dem des Teilvorhabens kommt, verschwanden 256 negative
 * TV-Urteile hinter einem positiven Verbund-Urteil (gemessen 11.09.2026). Ein
 * negativer PreCheck ist die Aussage, die man nicht verlieren darf: der
 * Regelsatz hängt an ihr die Aufgabe „Abl/RNE erstellen" auf (R1).
 *
 * Innerhalb eines Teils entscheidet weiterhin das jüngste Datum
 * (`computeStatusDatum`) — eine Korrektur von `D_PC-` auf `D_PC+` wirkt also.
 */
export function precheckUrteil(teile: PrecheckTeile): PrecheckUrteil {
  const kandidaten: { klasse: PrecheckKlasse; label: string }[] = [
    { klasse: normalisierePrecheck(teile.tv), label: teile.tv ?? '' },
    { klasse: normalisierePrecheck(teile.vb), label: teile.vb ?? '' },
  ];
  const sieger = kandidaten.reduce((a, b) => (KLASSEN_RANG[b.klasse] < KLASSEN_RANG[a.klasse] ? b : a));
  return sieger.klasse === 'ohne' ? { klasse: 'ohne', label: '' } : sieger;
}

/**
 * Dasselbe Urteil direkt aus einer List-View-Zeile — strukturell getypt, damit
 * `AntragListItem` und `AntragTableRow` denselben Weg nehmen.
 */
export function precheckUrteilVonZeile(
  r: { precheck_tv_status_label?: string; precheck_vb_status_label?: string },
): PrecheckUrteil {
  return precheckUrteil({ tv: r.precheck_tv_status_label, vb: r.precheck_vb_status_label });
}

/** Ein Tabelleneintrag: die Handlung, plus die Notiz für die PreCheck-Regel. */
interface SchrittEintrag extends NaechsterSchritt {
  /**
   * Zeigt diese Formel auf den **Eingang**? Nur dann darf die allgemeine
   * PreCheck-Regel sie überschreiben — siehe {@link istPreCheckFaellig}.
   *
   * Bis v4.3 stand diese Information im Phasen-Label: die Regel verglich das
   * angezeigte Wort. Sie hing damit an einem Text, der sich ändern darf; jetzt
   * steht sie als eigene Angabe da, wo sie gemeint ist.
   */
  eingangsFormel?: true;
}

/**
 * Roh-Status → Handlung. Bewusst ein reiner **Record-Lookup** (keine
 * `=== 'literal'`-Vergleiche → Pitfall #12 bleibt unberührt; die Zuordnung lebt
 * hier als Daten-Tabelle analog `STATUS_LABELS`).
 *
 * Die Tabelle deckt die relevanten offenen Bearbeitungs-Stati ab. Unbekannte /
 * nicht gemappte Stati fallen NIE durch: sie bekommen `{ aktion: '' }`, und der
 * Aufrufer zeigt dann die Status-Kurzform statt einer erratenen Anweisung.
 */
const SCHRITT_BY_STATUS: Record<string, SchrittEintrag> = {
  beantragt: { aktion: 'Vollständigkeit prüfen', eingangsFormel: true },
  bearbeitungsreif: { aktion: 'Vollständigkeit prüfen' },
  'NL eingegangen': { aktion: 'Nachlieferung prüfen' },
  // Die Begleitphase (VN-/ZB-Stati) steht bewusst NICHT in dieser Tabelle: ein
  // geprüfter Verwendungsnachweis löst kein Gutachten aus, und der Ablauf nach
  // der Bewilligung ist hier nicht abgebildet. Sie fällt damit auf den unten
  // beschriebenen Weg — die Status-Kurzform, keine erratene Aktion. Eine falsche
  // Anweisung wäre schlechter als keine.
  'techn geprüft': { aktion: 'Gutachten beginnen' },
  'kaufm geprüft': { aktion: 'Gutachten beginnen' },
  'Gutachten fertig': { aktion: 'Gutachten freigeben' },
  bewilligungsreif: { aktion: 'Bewilligung vorbereiten' },
  ablehnungsreif: { aktion: 'Ablehnungsbescheid erstellen' },
  'NF gestellt': { aktion: 'Nachforderung nachhalten' },
  // „keine weiteren NF" heißt: der Zyklus ist ABGESCHLOSSEN und der Antrag
  // vollständig — nachzuhalten ist da nichts mehr. Was aussteht, ist die
  // fachliche Prüfung. (Bis v2.410 stand hier dieselbe Formel wie bei 35, was
  // den Bearbeiter auf eine erledigte Nachforderung zurückschickte.)
  'keine weiteren NF': { aktion: 'Fachprüfung beginnen' },
};

/**
 * Ist dieser Status der Punkt, an dem ein PreCheck fällig wäre?
 *
 * **Am Verfahrensschritt festgemacht, nicht an der Arbeitsliste.** Bis v2.410
 * fragte die Regel `getStatusCategory(s) === 'offen'` — eine Arbeitsliste ist
 * aber eine Aussage über die Zuständigkeit, keine über die Stelle im Verfahren.
 * Der Unterschied fiel auf, als 36/37 die Kategorie wechselten: „NL
 * eingegangen" wäre über Nacht zu „PreCheck durchführen" geworden. Am Schritt
 * hängt die Regel auch dann noch richtig, wenn die PL den Schnitt umhängt —
 * und genau das ist der Zweck des kuratierbaren Verfahrensschritts.
 *
 * **Die kuratierte Formel hat Vorrang.** Trägt ein Status im Eingang eine
 * eigene Handlungs-Formel, die woanders hinzeigt, gilt sie: eine kuratierte
 * Anweisung ist immer spezifischer als die allgemeine PreCheck-Regel. Für die
 * heutigen Eingangs-Codes (11 „Skizze eingegangen" ohne Formel, 31 „beantragt"
 * mit Formel auf „Eingang") ändert das nichts — der Vorrang ist die Leitplanke
 * für den Fall, dass die PL einen späteren Code in den Eingang hängt.
 */
function istPreCheckFaellig(s: string): boolean {
  // Die stabile, opake Phasen-Id — kein Anzeigetext. `zahPhaseFuerStatusText`
  // liest den geltenden Schnitt, die Regel wandert also beim Umhängen mit.
  if (zahPhaseFuerStatusText(s) !== 'eingang') return false; // allow-zah-phase-literal: stabile Id
  const mapped = SCHRITT_BY_STATUS[s];
  return mapped === undefined || mapped.eingangsFormel === true;
}

/**
 * Leitet die nächste Handlung aus dem Roh-Status (+ optional PreCheck) ab.
 *
 * **PreCheck-Regeln (vor den Status-Regeln, nur für NICHT-terminale Anträge):**
 * - PreCheck negativ                       → `'PreCheck-Ergebnis klären'`
 *   (bewusst OHNE Schritt-Bedingung: ein negatives Ergebnis ist an jeder Stelle
 *   des Verfahrens zu klären, nicht nur im Eingang)
 * - PreCheck fehlt/ausstehend UND Status im
 *   Verfahrensschritt „Eingang" (`istPreCheckFaellig`)
 *                                           → `'PreCheck durchführen'`
 *
 * **Status-Regeln (Fallback):**
 * - Gemappter Status → die kuratierte Handlung.
 * - Nicht gemappter, aber gesetzter Status → `{ aktion: '' }`. Der Aufrufer
 *   zeigt dann die Status-**Kurz**form (`statusKurzLabel`) — die Formel landet in
 *   den 170-px-Kanban-Lanes und in der Home-Zeile, nie auf einer breiten Fläche.
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
      return { aktion: 'PreCheck-Ergebnis klären' };
    }
    if ((pc === 'ohne' || pc === 'offen') && istPreCheckFaellig(s)) {
      return { aktion: 'PreCheck durchführen' };
    }
  }

  // --- Status-Regeln (bisheriges Verhalten) ---
  const mapped = SCHRITT_BY_STATUS[s];
  // Nur die Handlung herausgeben: `eingangsFormel` ist eine Notiz für die Regel
  // oben, keine Angabe für den Aufrufer.
  if (mapped) return { aktion: mapped.aktion };
  return { aktion: '' };
}

/**
 * Die Formel, wie sie auf einer engen Fläche steht: die Handlung, sonst die
 * Status-Kurzform. Eine Stelle für alle drei Aufrufer (Home-Zeile,
 * Kanban-Karte, Assistenten-Kontext) — die Regel „ohne Handlung zeigen wir den
 * Status" ist dieselbe und gehört nicht dreimal abgeschrieben.
 *
 * Leerer Status → `''`: dann steht dort gar nichts, nicht ein leerer Pfeil.
 */
export function schrittText(
  status: string | undefined | null,
  precheckStatus?: string | null,
): string {
  const s = typeof status === 'string' ? status.trim() : '';
  if (s.length === 0) return '';
  return naechsterSchritt(s, precheckStatus)?.aktion || statusKurzLabel(s);
}
