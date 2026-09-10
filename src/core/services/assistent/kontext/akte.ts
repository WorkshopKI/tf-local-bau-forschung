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
  /** Tage bis zur Gesamtfrist; negativ = überschritten. */
  restTage: number | null;
  /** Deutsches Datum der Gesamtfrist. */
  fristDatum?: string;
  /** Gerissene Meilensteine, z. B. „1.4 Gutachten beauftragt — Soll 03.02.2026, 42 Tage über". */
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
  const rest = m.restTage === null
    ? ''
    : m.restTage >= 0
      ? `, noch ${plural(m.restTage, 'Tag', 'Tage')} bis zur Gesamtfrist${frist}`
      : `, Gesamtfrist seit ${plural(-m.restTage, 'Tag', 'Tagen')} überschritten${frist}`;
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
    const urteil = { ok: 'läuft', haengt: 'hängt fest', unbewertet: 'nicht bewertbar' }[a.stillstand.urteil];
    const bei = a.stillstand.liegtBei ? `, liegt bei ${a.stillstand.liegtBei}` : '';
    z.push(`Stillstands-Wächter: ${urteil}${bei}. ${a.stillstand.text}`);
  }
  if (a.meilensteine) z.push(...meilensteinZeilen(a.meilensteine));
  if (a.verlauf) z.push(...verlaufZeilen(a.verlauf));
  z.push(...teilvorhabenZeilen(a));
  if (a.zuweisung && a.zuweisung.von > 0) {
    const { ab, fb, von } = a.zuweisung;
    z.push(`Zuweisung: AB in ${ab} von ${von}, FB in ${fb} von ${von} Teilvorhaben besetzt`);
  }
  return z;
}
