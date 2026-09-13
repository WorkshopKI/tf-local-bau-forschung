/**
 * Die **Vorgangsakte** — was der Assistent über EINEN Vorgang weiß, als Text.
 *
 * Bis v6.53 bekam der Faktenblock den Status, eine Frist, die Aufgabe und vier
 * Stammdaten. Alles andere, was die App über einen Vorgang schon rechnet — die
 * Aufgaben der übrigen Rollen, halb offene Kürzel-Paare, der Stillstand, die
 * Meilenstein-Prognose, die Eingänge der Teilvorhaben —, reiste nicht mit. Die
 * Schnellfragen boten deshalb nur an, was diese fünf Zeilen trugen.
 *
 * **Hier wird nur gerendert, nicht gerechnet** (Invariante 3 des Panels): die
 * Akte baut das Plugin aus den reinen Funktionen des Status-Kerns
 * (`baueVorgangsakte`). Leere Signale entfallen ohne Platzhalter — ein „keine
 * Angabe" im Prompt ist eine Aussage, die das Modell weitergeben würde.
 *
 * **Personen stehen hier nicht.** Keine Bearbeiter-Kürzel, auch nicht als
 * Zuweisung: `zuweisung` zählt nur, ob eine Rolle besetzt ist. Mit dem datierten
 * Verlauf daneben würde „wie lange hat X gebraucht?" beantwortbar — ein
 * Aktivitätsprotokoll (vorgangssystem.md §12.6).
 *
 * Rein: kein React, kein IDB, keine Uhr.
 */
import { fristTageWort } from '@/core/utils/uhrWorte';

/** Eine Aufgabe aus dem Regelsatz einer Rolle. */
export interface AkteAufgabe {
  /** Kurzlabel des Regelsatzes („AB", „FB"). */
  rolle: string;
  text: string;
  /** „wartet auf QS", „liegt bei AB/FB" — fehlt, wenn keine Rolle benannt ist. */
  adresse?: string;
  /** „2 von 4 TV" — fehlt, wenn alle Teilvorhaben dasselbe sagen. */
  anteil?: string;
  /** Aus der Regel einer anderen Rolle geliehen (`quelle: 'abgeleitet'`). */
  abgeleitet: boolean;
}

/** Ein halb offenes Kürzel-Paar: eine Seite gesetzt, das Gegenstück fehlt. */
export interface AkteOffenesPaar {
  /** Aktenzeichen des Teilvorhabens. */
  tv: string;
  gesetzt: string;
  fehlt: string;
  fehltLabel: string;
  /** Deutsches Datum der gesetzten Seite. */
  seit: string;
  tage: number;
  /** Wessen Schreibtisch („FB"); fehlt, wo die Rolle nicht benannt ist. */
  rolle?: string;
}

export interface AkteFrist {
  zustand: 'laeuft' | 'angehalten' | 'nicht_berechenbar';
  /** Vorformatiert, z. B. „läuft, noch 45 Tage (bis 12.10.2026)". */
  text: string;
  /** Ab wann gerechnet wird, z. B. „„alle Anträge da" (D_XTE) vom 04.01.2021". */
  basis?: string;
}

export interface AkteStillstand {
  urteil: 'ok' | 'haengt' | 'unbewertet';
  /** Der Satz des Wächters, samt „mindestens", wo die Liegezeit genähert ist. */
  text: string;
  /** Rolle, bei der der Vorgang liegt („AB", „Antragsteller"). */
  liegtBei?: string;
}

export interface AkteMeilensteine {
  /** „im Plan", „gefährdet", „nicht haltbar", „abgeschlossen", „unbekannt". */
  prognose: string;
  /** Tage bis zur Bearbeitungsfrist (dieselbe wie die Frist-Spalte); negativ = überschritten. */
  restTage: number | null;
  /** Deutsches Datum der Bearbeitungsfrist. */
  fristDatum?: string;
  /** Gerissene Meilensteine, z. B. „1.4 Gutachten beauftragt — Soll 03.02.2026, seit 42 Tagen gerissen". */
  gerissen: string[];
  /** Fällige Meilensteine (Soll-Termin steht kurz bevor). */
  faellig: string[];
}

/** Ein Termin der Chronik: ein gesetztes Kürzel mit seinem Datum. */
export interface AkteTermin {
  /** Deutsches Datum. */
  tag: string;
  kuerzel?: string;
  label: string;
  /** Wer den Eintrag setzen darf: „AB/FB" bzw. „alle" für neutrale Einträge. */
  rollen: string;
  /** „Verbund", ein Aktenzeichen oder „3 Teilvorhaben". */
  traeger: string;
}

export interface AkteVerlauf {
  /** Deutsches Datum des frühesten und des jüngsten Termins. */
  von: string | null;
  bis: string | null;
  schritte: number;
  datumsangaben: number;
  /** Halb offene Paare — gezählt, nicht Teil der Datumsangaben. */
  nichtGesetzt: number;
  /** Die Termine der Chronik ohne Nebensächliches, chronologisch. */
  termine: AkteTermin[];
  /**
   * Wie viele Statusabschnitte die Verlaufsableitung für diesen Vorgang ergibt.
   * Nur ein Signal (die Abschnitte selbst trägt der Verlaufs-Block); `0` oder
   * fehlend heißt: die Liegezeiten je Status sind hier nicht ableitbar.
   */
  statusAbschnitte?: number;
}

/** Was das Änderungs-Journal über diesen Vorgang sagen kann. */
export interface AkteJournal {
  /** Der Nullpunkt-Satz — gehört an jede Journal-Aussage (vorgangssystem.md §12.2). */
  hinweis: string;
  /** Belegte Änderungen ab dem Nullpunkt. */
  aenderungen: number;
  /** Termine, die ein früherer Export trug und der heutige nicht mehr. */
  zurueckgenommen: number;
}

/** Der Stand der eigenen Arbeit — dieselben Karten wie die Artefakt-Leiste. */
export interface AkteArtefakte {
  gutachten?: string;
  nachforderung?: string;
  /** Beratende Hinweise der Prüfer, je Abschnitt und Dimension. */
  pruefHinweise: string[];
}

export interface AkteTeilvorhaben {
  aktenzeichen: string;
  titel: string;
  /** Voller Status-Bezeichner. */
  status?: string;
  /** Deutsches Datum des Antragseingangs (`D_AAE`). */
  eingang?: string;
}

export interface VorgangsAkte {
  /**
   * Für welche Entität die Akte gebaut wurde (Verbund-Nummer oder Aktenzeichen).
   * Der Assembler rendert sie nur, wenn sie zur Entität des Turns passt — eine
   * Akte, die einen Wechsel des Vorgangs überlebt, spräche über den falschen.
   */
  fuer: string;
  /** Verfahrensschritt (ZAH-Phase) in Worten. */
  verfahrensschritt?: string;
  /** Aufgaben je Regelsatz, der etwas zu sagen hat. */
  aufgaben: AkteAufgabe[];
  offenePaare: AkteOffenesPaar[];
  frist?: AkteFrist;
  stillstand?: AkteStillstand;
  meilensteine?: AkteMeilensteine;
  verlauf?: AkteVerlauf;
  teilvorhaben: AkteTeilvorhaben[];
  /** Deutsches Datum „alle Anträge eingegangen" (`D_XTE`). */
  vollstaendigAm?: string;
  /** Wie viele Teilvorhaben eine AB bzw. einen FB zugewiesen haben — nur gezählt. */
  zuweisung?: { ab: number; fb: number; von: number };
  /** Nur, wenn eine Anzeige der Seite das Journal schon geladen hat. */
  journal?: AkteJournal;
  artefakte?: AkteArtefakte;
  /** Frühere abgelehnte oder zurückgezogene Einreichungen desselben Projekts. */
  vorgaenger?: string[];
}

/**
 * Kappung der Termine im Faktenblock — die jüngsten bleiben. Die volle Chronik
 * kommt mit dem Verlaufs-Block, wenn eine Frage danach fragt.
 */
export const AKTE_MAX_TERMINE = 30;

const plural = (n: number, eins: string, viele: string): string => `${n} ${n === 1 ? eins : viele}`;

function aufgabenZeilen(a: VorgangsAkte): string[] {
  if (a.aufgaben.length === 0) return [];
  const z = ['Aufgaben je Regelsatz (aus den gesetzten Kürzeln):'];
  for (const t of a.aufgaben) {
    const zusatz = [
      t.adresse,
      t.anteil,
      t.abgeleitet ? 'abgeleitet aus der Regel einer anderen Rolle' : undefined,
    ].filter((x): x is string => typeof x === 'string' && x.length > 0);
    z.push(`- ${t.rolle}: ${t.text}${zusatz.length > 0 ? ` (${zusatz.join('; ')})` : ''}`);
  }
  return z;
}

function paarZeilen(a: VorgangsAkte): string[] {
  if (a.offenePaare.length === 0) return [];
  const z = ['Halb offene Kürzel-Paare (eine Seite gesetzt, das Gegenstück fehlt):'];
  for (const p of a.offenePaare) {
    const bei = p.rolle ? `, liegt bei ${p.rolle}` : '';
    z.push(`- ${p.tv}: ${p.gesetzt} gesetzt am ${p.seit}, ${p.fehlt} („${p.fehltLabel}") fehlt seit ${plural(p.tage, 'Tag', 'Tagen')}${bei}`);
  }
  return z;
}

function meilensteinZeilen(m: AkteMeilensteine): string[] {
  const frist = m.fristDatum ? ` (${m.fristDatum})` : '';
  // Dieselbe Bearbeitungsfrist wie die Frist-Spalte (v6.66) und dasselbe Wort.
  const rest = m.restTage === null ? '' : `, Bearbeitungsfrist: ${fristTageWort(m.restTage, 'lang')}${frist}`;
  return [
    `Bearbeitungsplan (Meilensteine): Prognose ${m.prognose}${rest}`,
    ...m.gerissen.map(g => `- gerissen: ${g}`),
    ...m.faellig.map(f => `- fällig: ${f}`),
  ];
}

function verlaufZeilen(v: AkteVerlauf): string[] {
  const zeitraum = v.von && v.bis ? ` vom ${v.von} bis ${v.bis}` : '';
  const offen = v.nichtGesetzt > 0
    ? `, ${plural(v.nichtGesetzt, 'fehlende Kürzel-Angabe', 'fehlende Kürzel-Angaben')}`
    : '';
  const z = [
    `Verlauf (aus den Datumsspalten des Exports; je Kürzel steht nur das zuletzt gesetzte Datum): ${plural(v.schritte, 'Schritt', 'Schritte')}, ${plural(v.datumsangaben, 'Datumsangabe', 'Datumsangaben')}${zeitraum}${offen}`,
  ];
  const termine = v.termine.slice(-AKTE_MAX_TERMINE);
  if (termine.length === 0) return z;
  const gekappt = v.termine.length > termine.length;
  z.push(`Termine${gekappt ? ` (die jüngsten ${termine.length} von ${v.termine.length})` : ''}:`);
  for (const t of termine) {
    z.push(`- ${t.tag}${t.kuerzel ? ` ${t.kuerzel}` : ''} ${t.label} — setzen darf ${t.rollen}; ${t.traeger}`);
  }
  return z;
}

function teilvorhabenZeilen(a: VorgangsAkte): string[] {
  if (a.teilvorhaben.length === 0) return [];
  const z = [a.teilvorhaben.length === 1 ? 'Teilvorhaben:' : `Teilvorhaben (${a.teilvorhaben.length}):`];
  for (const t of a.teilvorhaben) {
    const teile = [
      t.status ? `Status ${t.status}` : undefined,
      t.eingang ? `Eingang ${t.eingang}` : undefined,
    ].filter((x): x is string => typeof x === 'string');
    z.push(`- ${t.aktenzeichen}: ${t.titel}${teile.length > 0 ? ` (${teile.join(', ')})` : ''}`);
  }
  if (a.vollstaendigAm) z.push(`Alle Teilanträge eingegangen am ${a.vollstaendigAm}`);
  return z;
}

/**
 * Die Akte als Zeilen des Faktenblocks.
 *
 * Reihenfolge wie die Fragen, die sie tragen: erst Lage und Aufgaben, dann Uhr
 * und Plan, dann der Verlauf, zuletzt die Teilvorhaben.
 */
export function akteZeilen(a: VorgangsAkte): string[] {
  const z: string[] = [];
  if (a.verfahrensschritt) z.push(`Verfahrensschritt: ${a.verfahrensschritt}`);
  z.push(...aufgabenZeilen(a), ...paarZeilen(a));
  if (a.frist) {
    z.push(`Bearbeitungsfrist: ${a.frist.text}${a.frist.basis ? ` — gerechnet ab ${a.frist.basis}` : ''}`);
  }
  if (a.stillstand) {
    const urteil = { ok: 'läuft', haengt: 'keine Bewegung', unbewertet: 'nicht bewertbar' }[a.stillstand.urteil];
    const bei = a.stillstand.liegtBei ? `, liegt bei ${a.stillstand.liegtBei}` : '';
    z.push(`Stillstands-Wächter: ${urteil}${bei}. ${a.stillstand.text}`);
  }
  if (a.meilensteine) z.push(...meilensteinZeilen(a.meilensteine));
  if (a.verlauf) z.push(...verlaufZeilen(a.verlauf));
  if (a.journal) z.push(journalZeile(a.journal));
  z.push(...teilvorhabenZeilen(a));
  if (a.zuweisung && a.zuweisung.von > 0) {
    const { ab, fb, von } = a.zuweisung;
    z.push(`Zuweisung: AB in ${ab} von ${von}, FB in ${fb} von ${von} Teilvorhaben besetzt`);
  }
  if (a.artefakte) z.push(...artefaktZeilen(a.artefakte));
  if (a.vorgaenger && a.vorgaenger.length > 0) {
    z.push('Frühere abgelehnte oder zurückgezogene Einreichungen desselben Projekts:');
    for (const v of a.vorgaenger) z.push(`- ${v}`);
  }
  return z;
}

function journalZeile(j: AkteJournal): string {
  const zahlen = j.aenderungen > 0 || j.zurueckgenommen > 0
    ? ` Belegt: ${plural(j.aenderungen, 'Änderung', 'Änderungen')}, ${plural(j.zurueckgenommen, 'zurückgenommener oder verschobener Termin', 'zurückgenommene oder verschobene Termine')}.`
    : '';
  return `Änderungs-Journal: ${j.hinweis}${zahlen}`;
}

function artefaktZeilen(a: AkteArtefakte): string[] {
  const z: string[] = [];
  if (a.gutachten) z.push(a.gutachten);
  if (a.nachforderung) z.push(a.nachforderung);
  if (a.pruefHinweise.length > 0) {
    z.push('Hinweise der Prüfer zum Gutachten (beratend, ändern weder Text noch Status):');
    for (const h of a.pruefHinweise) z.push(`- ${h}`);
  }
  return z;
}
