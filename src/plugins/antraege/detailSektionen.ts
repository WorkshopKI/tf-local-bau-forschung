/**
 * Klapp-Vorgaben der Verbund-Detailseite — an EINER Stelle.
 *
 * Vorher lagen Speicher-Schlüssel und Default in acht Dateien verstreut, mit drei
 * verschiedenen Vorgaben. Wer „beim Öffnen soll X zu sein" beantworten wollte,
 * musste alle acht lesen; wer eine Sektion hinzufügte, erfand die nächste Vorgabe
 * frei. Deshalb steht die Tabelle hier und die Sektionen fragen nur noch nach.
 *
 * **Die Regel:** beim ersten Anzeigen ist alles zu — außer den Antragsdaten (die
 * Fakten, wegen derer die Seite geöffnet wird) und der Kurzbeschreibung, sofern
 * sie schon Text trägt. Eine leere Kurzbeschreibung aufzuklappen kostete eine
 * Karte Höhe, um „— wird nach Abschluss des Gutachtens erstellt" zu zeigen.
 *
 * **Warum die Schlüssel auf `_v2` enden:** `useCollapsedSection` lässt einen
 * persistierten Wert immer über den Code-Default gewinnen. Ohne den einmaligen
 * Bump sähe niemand, der je eine Sektion geklappt hat, die neue Voreinstellung —
 * die Änderung wäre nur für frische Profile sichtbar.
 */

export type DetailSektionId =
  | 'kurzbeschreibung'
  | 'status'
  | 'offeneAufgaben'
  | 'naechsteSchritte'
  | 'statuseintraege'
  | 'meilensteine'
  | 'gutachten'
  | 'kurzfassung'
  | 'antragsdaten'
  | 'werkbank'
  | 'widerspruch'
  | 'nachforderungen'
  | 'alleFelder'
  | 'historie';

/**
 * `'wennGefuellt'` = offen genau dann, wenn die Sektion Inhalt hat.
 *
 * Der Speicher-Schlüssel gilt antragsübergreifend — deshalb entscheidet der
 * Inhalt beim Rendern mit, nicht nur beim allerersten Anzeigen (siehe
 * `KurzbeschreibungCard`). Sonst legte der erste besuchte Antrag den Zustand für
 * alle folgenden fest.
 */
export type Klappvorgabe = boolean | 'wennGefuellt';

interface Eintrag {
  /** localStorage-Schlüssel (siehe Modulkopf zum `_v2`-Suffix). */
  key: string;
  /** Zustand beim ERSTEN Anzeigen; ein persistierter Wert gewinnt darüber. */
  offen: Klappvorgabe;
}

export const DETAIL_SEKTIONEN: Record<DetailSektionId, Eintrag> = {
  kurzbeschreibung: { key: 'verbund_kurzbeschreibung_collapsed_v2', offen: 'wennGefuellt' },
  status: { key: 'verbund_status_collapsed_v2', offen: false },
  // Die nächsten drei liegen INNERHALB von `status` — die einzigen Einträge, die
  // eine Sektion in einer Sektion beschreiben. Je ein eigener Schlüssel, weil
  // jeder der drei Blöcke für sich genommen den Rest der aufgeklappten
  // Statussektion nach unten aus dem Blick schiebt: die Aufgaben mit einer
  // Rollenzeile je Teilvorhaben, der Navigator mit bis zu 18 Kandidaten à 4–6
  // Wirkungszeilen, die Ordner-Liste mit allen gesetzten Einträgen beider Ebenen
  // (gemessen: über 1.100 px an einem Verbund mit drei Teilvorhaben). Wer die
  // Chronik lesen will, soll an keinem davon vorbeiscrollen müssen.
  offeneAufgaben: { key: 'verbund_offeneaufgaben_collapsed_v2', offen: false },
  naechsteSchritte: { key: 'verbund_naechsteschritte_collapsed_v2', offen: false },
  statuseintraege: { key: 'verbund_statuseintraege_collapsed_v2', offen: false },
  meilensteine: { key: 'verbund_meilensteine_collapsed_v2', offen: false },
  gutachten: { key: 'verbund_gutachten_collapsed_v2', offen: false },
  // Belegt denselben Platz wie `gutachten` (Kurzfassung statt Workflow A–G) —
  // eigener Schlüssel, weil die beiden Sektionen verschiedene Zustände tragen.
  kurzfassung: { key: 'verbund_kurzfassung_collapsed_v2', offen: false },
  antragsdaten: { key: 'verbund_antragsdaten_collapsed_v2', offen: true },
  werkbank: { key: 'verbund_werkbank_collapsed_v2', offen: false },
  widerspruch: { key: 'verbund_widerspruch_collapsed_v2', offen: false },
  nachforderungen: { key: 'verbund_nf_collapsed_v2', offen: false },
  alleFelder: { key: 'verbund_allefelder_collapsed_v2', offen: false },
  historie: { key: 'verbund_historie_collapsed_v2', offen: false },
};

/** Speicher-Schlüssel der Sektion. */
export function sektionsKey(id: DetailSektionId): string {
  return DETAIL_SEKTIONEN[id].key;
}

/**
 * Zustand beim ersten Anzeigen.
 *
 * @param gefuellt Nur für `'wennGefuellt'`-Sektionen ausgewertet. Die Detailseite
 *   löst den Verbund auf, BEVOR sie die Sektionen mountet (früher Return in
 *   `VerbundDetail`) — der Wert ist beim ersten Rendern also schon der echte.
 */
export function sektionOffenDefault(id: DetailSektionId, gefuellt = false): boolean {
  const vorgabe = DETAIL_SEKTIONEN[id].offen;
  return vorgabe === 'wennGefuellt' ? gefuellt : vorgabe;
}
