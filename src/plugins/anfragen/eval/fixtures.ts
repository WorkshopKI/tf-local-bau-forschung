/**
 * FIKTIVE Eval-Fixtures für das Anonymisierungs-Recall-Gate (Phase 9).
 *
 * DSGVO-Provenance: ALLE Inhalte hier sind frei erfunden (Namen, Firmen, FKZ,
 * IBANs, Hostnames). KEINE echten Anfragen — diese Fixtures sind die einzige
 * erlaubte Datenquelle der Recall-Eval (`runRecallEval` asserted die Provenienz).
 * Die Ground-Truth-Spans decken alle `PiiTyp`-Klassen ab inkl. Header-DN/Hostname
 * und identifizierendem Freitext.
 */
import type { PiiTyp } from '../types';

export interface PiiSpan {
  /** Der Original-Klartext, der anonymisiert werden MUSS. */
  text: string;
  typ: PiiTyp;
}

export interface AnfrageEvalFixture {
  id: string;
  betreff: string;
  absenderEmail: string;
  /** Fiktive Kurzanfrage (Markdown/Plain). */
  text: string;
  groundTruth: PiiSpan[];
}

export const ANFRAGE_EVAL_FIXTURES: AnfrageEvalFixture[] = [
  {
    id: 'fix-exoskelett',
    betreff: 'Anfrage ZIM-Förderfähigkeit additive Fertigung',
    absenderEmail: 'anke.vogelsang@helioform-robotik.de',
    text:
      'Sehr geehrte Damen und Herren,\n\n' +
      'mein Name ist Dr. Anke Vogelsang von der Helioform Robotik GmbH in Magdeburg. Wir planen ' +
      'einen ZIM-Antrag (Förderkennzeichen 16KN0987) für ein Vorhaben zur additiven Fertigung von ' +
      'Leichtbau-Gelenken für Exoskelette. Erreichbar bin ich unter anke.vogelsang@helioform-robotik.de ' +
      'oder telefonisch unter 0391 5567890.\n\nMit freundlichen Grüßen\nDr. Anke Vogelsang',
    groundTruth: [
      { text: 'Dr. Anke Vogelsang', typ: 'person' },
      { text: 'Helioform Robotik GmbH', typ: 'firma' },
      { text: 'Magdeburg', typ: 'ort' },
      { text: '16KN0987', typ: 'fkz' },
      { text: 'anke.vogelsang@helioform-robotik.de', typ: 'email' },
      { text: '0391 5567890', typ: 'telefon' },
      { text: 'additive Fertigung von Leichtbau-Gelenken für Exoskelette', typ: 'sonstiges' },
    ],
  },
  {
    id: 'fix-verwertung',
    betreff: 'Frage zur Verwertungsstruktur',
    absenderEmail: 'm.bauer@nordtec-systems.de',
    text:
      'Hallo zusammen,\n\n' +
      'weitergeleitet von /O=NORDTEC/OU=Exchange Administrative Group/CN=RECIPIENTS/CN=mbauer über den ' +
      'Server mail.nordtec-systems.de.\n\n' +
      'Ich, Martin Bauer von der NordTec Systems UG in Kiel, habe eine Rückfrage zur zulässigen ' +
      'Verwertungsstruktur. Die Fördergelder sollen auf das Konto DE12 5001 0517 0648 4898 90 fließen.\n\n' +
      'Beste Grüße\nMartin Bauer',
    groundTruth: [
      { text: '/O=NORDTEC/OU=Exchange Administrative Group/CN=RECIPIENTS/CN=mbauer', typ: 'x500' },
      { text: 'mail.nordtec-systems.de', typ: 'hostname' },
      { text: 'Martin Bauer', typ: 'person' },
      { text: 'NordTec Systems UG', typ: 'firma' },
      { text: 'Kiel', typ: 'ort' },
      { text: 'DE12 5001 0517 0648 4898 90', typ: 'iban' },
    ],
  },
  {
    id: 'fix-konsortium',
    betreff: 'ZIM-Kooperationsprojekt Sensorik',
    absenderEmail: 'leitung@aurolux-photonics.de',
    text:
      'Guten Tag,\n\n' +
      'für ein geplantes Kooperationsprojekt zwischen der Aurolux Photonics AG und dem Institut für ' +
      'Mikrosensorik Freiberg möchten Prof. Dr. Helena Reinholt und Herr Tobias Kühnemann die ' +
      'Förderfähigkeit klären. Es geht um faseroptische Drucksensoren für Tiefbohrungen. ' +
      'Kontakt: +49 3731 442010.\n\nFreundliche Grüße\nH. Reinholt',
    groundTruth: [
      { text: 'Aurolux Photonics AG', typ: 'firma' },
      { text: 'Institut für Mikrosensorik Freiberg', typ: 'firma' },
      { text: 'Prof. Dr. Helena Reinholt', typ: 'person' },
      { text: 'Tobias Kühnemann', typ: 'person' },
      { text: 'faseroptische Drucksensoren für Tiefbohrungen', typ: 'sonstiges' },
      { text: '+49 3731 442010', typ: 'telefon' },
    ],
  },
];
