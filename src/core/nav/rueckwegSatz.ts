/**
 * Der Rückweg als deutscher Satz: „Zurück zur Suche", nicht „Zurück zu Suche".
 *
 * Die Herkunft ([herkunft.ts](./herkunft.ts)) führt nur den NAMEN der Seite —
 * den braucht auch das Schließen-Ziel, und er muss roh bleiben. Der Satz daraus
 * ist eine reine Sprachfrage, und im Deutschen entscheidet sie sich am Wort:
 * „zur Suche", „zum Vorgangs-Board", „zu den Dokumenten". Ein einheitliches
 * „zu <Name>" wäre für die halbe Navigation falsch, ein aus dem Namen geratener
 * Artikel für die andere Hälfte.
 *
 * Deshalb steht hier je Seite die fertige Fügung — beugtes Wort inklusive
 * („zu den Fristen & Meilensteinen"), statt Artikel und Name zur Laufzeit
 * zusammenzusetzen. Wer keinen Eintrag hat, bekommt „zu <Name>": grammatisch
 * die zurückhaltendste Form und für Eigennamen („Home", „DEV: State") die
 * richtige.
 *
 * Die Tabelle wiederholt Namen, die anderswo definiert sind — deshalb bewacht
 * `rueckweg-satz-abdeckung` ([conventions-ui](../../__tests__/conventions-ui.test.ts))
 * beide Richtungen: ein neues Plugin ohne Fügung fällt auf, und eine Fügung zu
 * einer Seite, die es nicht mehr gibt, ebenso.
 */

/**
 * Seitenname → Fügung im Dativ, wie sie hinter „Zurück" steht.
 *
 * Schlüssel ist der Anzeigename aus dem Plugin-Manifest, wortgleich — ein
 * zweiter Name für dieselbe Seite („Startseite" für „Home") verwirrt mehr, als
 * die Grammatik gewinnt.
 */
export const SEITEN_FUEGUNG: Readonly<Record<string, string>> = {
  'Home': 'zu Home',
  'Förderanträge': 'zu den Förderanträgen',
  'E-Mail Anfragen': 'zu den E-Mail Anfragen',
  'Förderfähigkeit': 'zur Förderfähigkeit',
  'Fristen & Meilensteine': 'zu den Fristen & Meilensteinen',
  'Vorgangs-Board': 'zum Vorgangs-Board',
  'Vorgangs-Regeln': 'zu den Vorgangs-Regeln',
  'Auslastung': 'zur Auslastung',
  'Dokumente': 'zu den Dokumenten',
  'Suche': 'zur Suche',
  'Doppelförderung': 'zur Doppelförderungs-Prüfung',
  'Glossar': 'zum Glossar',
  'Zu klären': 'zu „Zu klären"',
  'Feedback': 'zum Feedback',
  'Skill-Verwaltung': 'zur Skill-Verwaltung',
  'Einstellungen': 'zu den Einstellungen',
  'Datenpflege': 'zur Datenpflege',
  'Dokument-Review': 'zum Dokument-Review',
  'DEV: Infra': 'zu DEV: Infra',
  'DEV: State': 'zu DEV: State',
};

/** „Zurück zum Vorgangs-Board" — der ganze Satz für die Brotkrume. */
export function rueckwegSatz(seitenName: string): string {
  return `Zurück ${SEITEN_FUEGUNG[seitenName] ?? `zu ${seitenName}`}`;
}
