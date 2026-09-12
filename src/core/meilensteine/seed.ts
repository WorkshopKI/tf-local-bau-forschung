/**
 * Auslieferungs-Plan v1 der Bearbeitungs-Meilensteine (MST 1 … MST 6).
 *
 * Die **Struktur** (welche Meilensteine, welche Soll-Woche) kommt aus der
 * fachlichen Vorgabe des Teams und ist verbindlich. Die **Zuordnung** „welche
 * CSV-Spalte erfüllt diesen Meilenstein" ist es NICHT: welcher der ~150
 * `D_*`-Datumscodes fachlich wofür steht, weiß nur das Team. Deshalb gilt hier:
 *
 * - Nur Knoten mit einer eindeutigen, aus dem kanonischen Schema belegbaren
 *   Quelle sind bestätigt und aktiv (1.1, 1.2, 6).
 * - Plausible, aber unbestätigte Zuordnungen sind `unbestaetigt: true` — die
 *   Oberfläche weist sie sichtbar aus, damit niemand einer geratenen Zahl traut.
 * - Wo keine plausible Quelle existiert, ist der Knoten zusätzlich `aktiv: false`
 *   (1.4.2, 4, 5). Ein inaktiver Knoten wird nie als „gerissen" gezählt — ein
 *   geratener wäre schlimmer als ein fehlender.
 *
 * Die verbindliche Zuordnung macht die PL im Konfigurations-Tab; ab dann trägt
 * der Plan auf dem Daten-Share die Wahrheit und dieser Seed ist nur noch
 * Erstbefüllung (idempotent, überschreibt nie einen gepflegten Plan).
 *
 * Feld-Referenzen: GROSSGESCHRIEBENE Namen sind rohe CSV-Spalten-CODES und
 * werden über das Programm-Schema aufgelöst (mapping-abhängig, Bug-Klasse #5);
 * kleingeschriebene sind kanonische Feld-Keys.
 */
import type { Bedingung } from '@/core/status';
import type { MeilensteinKnoten, MeilensteinPlan } from './typen';

/** Fester Zeitstempel — zwei Installationen mit gleichem Stand müssen
 *  byte-gleiche Pläne erzeugen (Muster `NF_MIGRATION_TS`). */
export const SEED_STAND = '2026-07-25T00:00:00.000Z';

/** Gesamt-Bearbeitungsfrist ab Antragseingang. Deckungsgleich mit
 *  `ANTRAG_SLA_DAYS` — der Meilenstein-Plan erfindet keine zweite Frist. */
export const SEED_GESAMTFRIST_TAGE = 90; // allow-inline-frist-arithmetik: per Test an ANTRAG_SLA_DAYS gekoppelt (seed.test.ts) — eigene Achse, KEINE zweite Frist

/** Bedingung, die nie direkt zutrifft: `some` über eine leere Liste ist `false`.
 *  Für Sammel-Knoten, die ausschließlich über ihre Kinder erfüllt werden, und
 *  für Knoten ohne bekannte Quelle. Als Factory, damit kein Knoten dasselbe
 *  Objekt teilt (der Konfigurations-Editor arbeitet auf Entwurfs-Kopien). */
const nurUeberKinder = (): Bedingung => ({ einige: [] });

function knoten(k: Omit<MeilensteinKnoten, 'nurTypen'> & { nurTypen?: MeilensteinKnoten['nurTypen'] }): MeilensteinKnoten {
  return { nurTypen: [], ...k };
}

/** Die Meilenstein-Struktur v1 (Reihenfolge = Anzeige-Reihenfolge). */
export function baueSeedKnoten(): MeilensteinKnoten[] {
  return [
    knoten({
      id: 'mst-1', elternId: null, nummer: '1', sortierung: 10,
      label: 'Antrag vollständig, PreCheck, Erstentscheidung',
      beschreibung: 'Sammel-Meilenstein — erfüllt, wenn 1.1 bis 1.4 erledigt sind.',
      sollWoche: 5, relevantFuerFrist: false, aktiv: true,
      bedingung: nurUeberKinder(),
    }),
    knoten({
      id: 'mst-1-1', elternId: 'mst-1', nummer: '1.1', sortierung: 10,
      label: 'Antrag im System eingegeben',
      sollWoche: 1, relevantFuerFrist: true, aktiv: true,
      bedingung: { feldId: 'antragsdatum', op: 'gefuellt' },
      istDatumFeld: 'antragsdatum',
    }),
    knoten({
      id: 'mst-1-2', elternId: 'mst-1', nummer: '1.2', sortierung: 20,
      label: 'Antrag zugewiesen',
      beschreibung: 'Bearbeiter mit passender Expertise und freier Kapazität eingetragen.',
      sollWoche: 2, relevantFuerFrist: true, aktiv: true,
      bedingung: { feldId: 'tib_kuerz', op: 'gefuellt' },
    }),
    knoten({
      id: 'mst-1-3', elternId: 'mst-1', nummer: '1.3', sortierung: 30,
      label: 'PreCheck mit Erstentscheidung',
      beschreibung: 'PreCheck durchgeführt, Richtung NF / RNE / ABL festgelegt.',
      sollWoche: 4, relevantFuerFrist: true, aktiv: true, unbestaetigt: true,
      // Welche der PreCheck-Datumsspalten den Abschluss markiert, entscheidet die PL.
      bedingung: {
        einige: [
          { feldId: 'D_PC+', op: 'gefuellt' },
          { feldId: 'D_PC-', op: 'gefuellt' },
          { feldId: 'D_XPC+', op: 'gefuellt' },
          { feldId: 'D_XPC-', op: 'gefuellt' },
        ],
      },
    }),
    knoten({
      id: 'mst-1-4', elternId: 'mst-1', nummer: '1.4', sortierung: 40,
      label: 'Schriftstück abgestimmt und zur QS gesendet',
      beschreibung: 'Abstimmung administrativer (AB) und fachlicher Bearbeiter (FB) zu NF / RNE / ABL.',
      sollWoche: 5, relevantFuerFrist: false, aktiv: true,
      bedingung: nurUeberKinder(),
    }),
    knoten({
      id: 'mst-1-4-1', elternId: 'mst-1-4', nummer: '1.4.1', sortierung: 10,
      label: 'FB-Schriftstück fertig',
      beschreibung: 'Anfang Woche 5 (≙ Ende Woche 4).',
      sollWoche: 4, relevantFuerFrist: true, aktiv: true, unbestaetigt: true,
      bedingung: {
        einige: [
          { feldId: 'D_ALS', op: 'gefuellt' },
          { feldId: 'D_ABLT', op: 'gefuellt' },
          { feldId: 'D_ART', op: 'gefuellt' },
        ],
      },
    }),
    knoten({
      id: 'mst-1-4-2', elternId: 'mst-1-4', nummer: '1.4.2', sortierung: 20,
      label: 'AB-Schriftstück fertig',
      beschreibung: 'Anfang Woche 5. Quelle noch nicht zugeordnet — bitte im Konfigurations-Tab festlegen.',
      sollWoche: 4, relevantFuerFrist: true, aktiv: false, unbestaetigt: true,
      bedingung: nurUeberKinder(),
    }),
    knoten({
      id: 'mst-1-4-3', elternId: 'mst-1-4', nummer: '1.4.3', sortierung: 30,
      label: 'QS freigegeben und versendet',
      beschreibung: 'Ende Woche 5.',
      sollWoche: 5, relevantFuerFrist: true, aktiv: true, unbestaetigt: true,
      bedingung: {
        einige: [
          { feldId: 'D_QS', op: 'gefuellt' },
          { feldId: 'D_XQS', op: 'gefuellt' },
        ],
      },
    }),
    knoten({
      id: 'mst-2', elternId: null, nummer: '2', sortierung: 20,
      label: 'Rückmeldung des Antragstellers',
      beschreibung: 'Nachlieferung oder Widerspruch zur Rücknahmeempfehlung / Ablehnung.',
      sollWoche: 7, relevantFuerFrist: true, aktiv: true, unbestaetigt: true,
      // Datum zuerst, Status als Rückfall: ein Status ist der Wert von heute, kein
      // Ereignis — zieht der Vorgang weiter, gälte der Meilenstein wieder als
      // nicht erreicht (`IstTerminErklaerung.momentaufnahme` in `ist-termin.ts`).
      bedingung: {
        einige: [
          { feldId: 'D_ARW', op: 'gefuellt' },
          { feldId: 'D_AL', op: 'gefuellt' },
          { feldId: 'D_ABLW', op: 'gefuellt' },
          { feldId: 'status', op: 'ist', wert: 'NL eingegangen' },
          { feldId: 'status', op: 'ist', wert: 'Widerspruch zur Ablehnung' },
          { feldId: 'status', op: 'ist', wert: 'Stellungnahme zur Rücknahmeempf.' },
        ],
      },
    }),
    knoten({
      id: 'mst-3', elternId: null, nummer: '3', sortierung: 30,
      label: 'Erstentscheidung finalisiert',
      beschreibung: 'Gutachten bei positiver Nachlieferung, finale Widerspruchsentscheidung bei RNE / ABL.',
      sollWoche: 9, relevantFuerFrist: true, aktiv: true, unbestaetigt: true,
      // Datum zuerst, Status als Rückfall: ein Status ist der Wert von heute, kein
      // Ereignis — zieht der Vorgang weiter, gälte der Meilenstein wieder als
      // nicht erreicht (`IstTerminErklaerung.momentaufnahme` in `ist-termin.ts`).
      bedingung: {
        einige: [
          { feldId: 'D_XKS', op: 'gefuellt' },
          { feldId: 'erstentscheidung', op: 'gefuellt' },
          { feldId: 'status', op: 'ist', wert: 'Gutachten fertig' },
          { feldId: 'status', op: 'ist', wert: 'bewilligungsreif' },
          { feldId: 'status', op: 'ist', wert: 'ablehnungsreif' },
        ],
      },
    }),
    knoten({
      id: 'mst-4', elternId: null, nummer: '4', sortierung: 40,
      label: 'QS der finalen Erstentscheidung',
      beschreibung: 'Quelle noch nicht zugeordnet — die QS-Spalten müssen von 1.4.3 getrennt werden.',
      sollWoche: 10, relevantFuerFrist: true, aktiv: false, unbestaetigt: true,
      bedingung: nurUeberKinder(),
    }),
    knoten({
      id: 'mst-5', elternId: null, nummer: '5', sortierung: 50,
      label: 'QS-Beanstandungen abgearbeitet',
      beschreibung: 'Quelle noch nicht zugeordnet — bitte im Konfigurations-Tab festlegen.',
      sollWoche: 11, relevantFuerFrist: true, aktiv: false, unbestaetigt: true,
      bedingung: nurUeberKinder(),
    }),
    knoten({
      id: 'mst-6', elternId: null, nummer: '6', sortierung: 60,
      label: 'Bewilligungsunterlagen versendet',
      sollWoche: 12, relevantFuerFrist: true, aktiv: true,
      bedingung: { feldId: 'bewilligung_datum', op: 'gefuellt' },
      istDatumFeld: 'bewilligung_datum',
    }),
  ];
}

/**
 * Der Auslieferungs-Plan als Version 1. Startet **freigegeben** — ein Entwurf
 * wäre über Nacht unsichtbar, obwohl die Struktur fachlich abgestimmt ist; die
 * unbestätigten Zuordnungen sind pro Knoten gekennzeichnet statt den ganzen Plan
 * zu blockieren.
 */
export function baueSeedPlan(): MeilensteinPlan {
  return {
    version: 1,
    stand: SEED_STAND,
    autor: null,
    kommentar: 'Auslieferungs-Fassung — Zuordnungen teilweise unbestätigt.',
    status: 'freigegeben',
    gesamtfristTage: SEED_GESAMTFRIST_TAGE,
    knoten: baueSeedKnoten(),
    historie: [],
  };
}
