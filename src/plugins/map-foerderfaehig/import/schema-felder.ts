/**
 * Gemeinsame Feldzuordnung beider bekannten Schema-Generationen.
 *
 * Befund aus der Bestandsaufnahme: die importrelevanten Felder — Stammdaten,
 * Laufzeit, Arbeitspakete, Einsatzplanung, Kostenarten, Fördersatz,
 * Antragsteller-Kurzprofil, Merkmale, Anlagen — liegen in der Fassung 2025 UND
 * 2026 auf **identischen** Pfaden. Die dokumentierten Unterschiede der beiden
 * Generationen (Finanzjahres-Blöcke unter `data.finanzierungsubersicht`,
 * Adress-Objekt je `mode` flach oder als Nominatim-Antwort, neue Telemetrie)
 * betreffen ausschliesslich Felder, die der MAP gar nicht importiert.
 *
 * Deshalb liegt die Zuordnung hier EINMAL; die Schema-Dateien ergänzen nur ihre
 * Marker und etwaige Deltas. Eine Kopie je Generation würde die Aussage „hier
 * ist nichts anders" in Redundanz verstecken.
 *
 * Die Alias-Ketten sind trotzdem gepflegt — sie sind der Drift-Puffer für die
 * NÄCHSTE Generation, nicht für die Unterschiede der beiden bekannten.
 */
import type { FeldSpez } from './schema-typen';

const AD = 'data.antragsdetails';
const ZK = 'data.zuwfkosten';

/** Zielfeld → Quellpfade. Reihenfolge = Anzeigereihenfolge im Import-Report. */
export const GEMEINSAME_FELDER: readonly FeldSpez[] = [
  // --- Stammdaten
  { ziel: 'stamm.titel', pfade: [`${AD}.netzwerkname_textfield`, `${AD}.projekttitel_textfield`], pflicht: true },
  { ziel: 'stamm.akronym', pfade: [`${AD}.akronym_textfield`], pflicht: true },
  { ziel: 'stamm.kurzfassung', pfade: [`${AD}.kurzfassungbeschreibung_textarea`], pflicht: true },

  // --- Laufzeit (Monatszahl wird gerechnet, es gibt kein Quellfeld)
  { ziel: 'laufzeit.start', pfade: [`${AD}.laufzeitstart_date`], pflicht: true },
  { ziel: 'laufzeit.ende', pfade: [`${AD}.laufzeitend_date`], pflicht: true },

  // --- Summen
  { ziel: 'summen.arbeitsaufwandAp', pfade: ['data.arbeitspakete.gesamtarbeitsaufwand'], pflicht: false },
  { ziel: 'summen.personenmonateEinsatz', pfade: ['data.einsatzplanung.gesamtpersonenmonate'], pflicht: false },

  // --- Kosten
  { ziel: 'kosten.personal', pfade: [`${ZK}.pkma_number`], pflicht: true },
  { ziel: 'kosten.dritte', pfade: [`${ZK}.kostendritte_number`], pflicht: false },
  { ziel: 'kosten.fue', pfade: [`${ZK}.kostenfue_number`], pflicht: false },
  { ziel: 'kosten.temp', pfade: [`${ZK}.kostentemp_number`], pflicht: false },
  { ziel: 'kosten.uebrige', pfade: [`${ZK}.uebrigekosten_number`], pflicht: false },
  { ziel: 'kosten.gesamt', pfade: [`${ZK}.kostengesamt_number`], pflicht: true },
  { ziel: 'kosten.beantragteZuwendung', pfade: [`${ZK}.beantragtezuwendung_number`], pflicht: true },
  { ziel: 'kosten.foerdersatz', pfade: [`${ZK}.unternehmensgrossenat_choice`], pflicht: true },

  // --- Antragsteller (nur das Kurzprofil — keine Adresse, keine Kennzahlen)
  { ziel: 'antragsteller.kurzprofil', pfade: ['data.antragsteller.institut_profil'], pflicht: false },

  // --- Merkmale
  { ziel: 'merkmale.patentsituation', pfade: ['data.detailbeschreibung.patentsituation_checklist'], pflicht: false },
  { ziel: 'merkmale.technologieneuerung', pfade: ['data.detailbeschreibung.technologieneuerung'], pflicht: false },
];

export const GEMEINSAME_LISTEN = {
  arbeitspakete: 'data.arbeitspakete.editgrid',
  einsatzplanung: 'data.einsatzplanung.editgrid',
} as const;

export const GEMEINSAME_ANLAGEN: readonly string[] = [
  'data.detailbeschreibung.projektbeschreibung_file',
  'data.detailbeschreibung.markteinfuerungskonzept_file',
  'data.detailbeschreibung.schutzrechte_file',
  'data.detailbeschreibung.ueberschriftauswirkungaufantragsteller.file',
  'data.antragsteller.handelsregisterauszug_file',
  'data.antragsteller.amtlregeintrag_file',
];

/**
 * Nebengrids, die Arbeitspakete per Freitext referenzieren — Quelle der Suche
 * nach verwaisten Referenzen.
 *
 * Bewusst NUR `auftraegeDritter`: die beiden anderen Grids mit AP-Bezug
 * (`personalkostentemp.personalbogen_editgrid`, `auftraegefp.personalbogen_editgrid`)
 * stehen auf der Datenschutz-Deny-Liste. Aus einem gesperrten Teilbaum wird
 * nichts gelesen — auch nichts Harmloses, sonst wäre die Sperre keine mehr und
 * der Verworfen-Nachweis im Report unwahr.
 */
export const GEMEINSAME_AP_REF_PFADE: readonly string[] = [
  'data.auftraegeDritter.auftragnehmer_grid.*.auftrage.*.zuordnungZuArbeitspaketenUA',
];

/**
 * Beschriftungen für Checkbox-Gruppen mit numerischen Schlüsseln.
 *
 * `patentsituation_checklist` nutzt die Schlüssel `"0"`–`"4"` OHNE jede
 * Beschriftung in der Datei; die Bedeutung steht nur im Antragsformular der
 * Plattform. Solange sie nicht belastbar vorliegt, bleibt die Zuordnung leer —
 * die UI zeigt dann „Position 0…4" und kennzeichnet die Herkunft als
 * `'unbekannt'`, statt eine Bedeutung zu erfinden.
 */
export const GEMEINSAME_CHECKBOX_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  patentsituation: {},
  technologieneuerung: {},
};
