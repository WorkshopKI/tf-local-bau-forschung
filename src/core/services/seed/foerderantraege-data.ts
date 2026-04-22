import type { Antrag, AntragDokumentRef } from '@/core/services/csv/types';

/**
 * Seed-Fixtures fuer Foerderantraege.
 *
 * Migriert aus dem fruheren forschung-data.ts (v1.13 → v1.14) plus 4 zusatzliche
 * synthetische Antraege mit abweichenden Foerderprogrammen, damit die Demo-Filter
 * und Facetten (Foerdergeber, Branche, Status, Frist-Datum) breiter abgedeckt sind.
 *
 * Das Feld `programm_id` wird beim Seed-Lauf dynamisch aus `ensureDefaultProgramm()`
 * gesetzt — hier als Platzhalter-String, den seed-data.ts vor dem Schreiben ersetzt.
 *
 * Die 4 bestehenden Seed-Markdown-Dokumente (forschung-*.ts in ./docs/) werden hier
 * als AntragDokumentRef auf den zugehoerigen FA-2026-* Eintragen referenziert.
 */

const PROGRAMM_PLACEHOLDER = '__SEED_DEFAULT__';

type SeedInput = {
  aktenzeichen: string;
  titel: string;
  status: string;
  priority: 'hoch' | 'normal' | 'niedrig';
  foerdergeber: string;
  foerdersumme: number;
  laufzeit: string;
  antragsteller: string;
  institution: string;
  branche: string;
  tags: string[];
  notes: string;
  created?: string;
  frist_datum?: string;
  dokumente?: AntragDokumentRef[];
};

function fill(src: SeedInput): Antrag {
  const created = src.created ?? '2026-02-01T08:00:00Z';
  const a: Antrag = {
    aktenzeichen: src.aktenzeichen,
    programm_id: PROGRAMM_PLACEHOLDER,
    titel: src.titel,
    antragsteller: src.antragsteller,
    status: src.status,
    foerdersumme: src.foerdersumme,
    foerdergeber: src.foerdergeber,
    branche: src.branche,
    dokumente: src.dokumente ?? [],
    institution: src.institution,
    laufzeit: src.laufzeit,
    priority: src.priority,
    tags: src.tags,
    notes: src.notes,
    antragsdatum: created,
    frist_datum: src.frist_datum,
    _field_sources: {
      aktenzeichen: 'seed',
      titel: 'seed',
      antragsteller: 'seed',
      status: 'seed',
      foerdersumme: 'seed',
      foerdergeber: 'seed',
      branche: 'seed',
      institution: 'seed',
      laufzeit: 'seed',
      priority: 'seed',
      tags: 'seed',
      notes: 'seed',
      antragsdatum: 'seed',
      ...(src.frist_datum ? { frist_datum: 'seed' } : {}),
      ...(src.dokumente && src.dokumente.length > 0 ? { dokumente: 'seed' } : {}),
    },
    _updated_at: created,
  };
  return a;
}

// --- Dokumenten-Referenzen auf die 4 echten Seed-Markdown-Dokumente ---
// IDs + Dateinamen entsprechen src/core/services/seed/docs/forschung-*.ts

const docFa001: AntragDokumentRef = {
  id: 'seed-doc-036',
  dateiname: 'Projekt_FA001.md',
  typ: 'projektbeschreibung',
  erfasst_am: '2026-01-10',
};
const docFa013: AntragDokumentRef = {
  id: 'seed-doc-043',
  dateiname: 'Projekt_FA013.md',
  typ: 'projektbeschreibung',
  erfasst_am: '2026-01-28',
};
const docFa010: AntragDokumentRef = {
  id: 'seed-doc-050',
  dateiname: 'Review_FA010.md',
  typ: 'gutachten',
  erfasst_am: '2026-03-08',
};
const docFa016: AntragDokumentRef = {
  id: 'seed-doc-053',
  dateiname: 'Review_FA016.md',
  typ: 'gutachten',
  erfasst_am: '2026-03-14',
};

// --- Fiktionale Dokumenten-Referenzen fuer die uebrigen 12 Eintrage + 4 zusatzlichen ---
// Nur Metadaten, kein echter Markdown. Datei-IDs mit fake-* Prefix zur klaren Abgrenzung.

function fake(id: string, dateiname: string, typ: AntragDokumentRef['typ'], erfasst_am: string, groesse_kb = 120): AntragDokumentRef {
  return { id: `fake-${id}`, dateiname, typ, erfasst_am, groesse_bytes: groesse_kb * 1024 };
}

export const foerderantraegeData: Antrag[] = [
  fill({
    aktenzeichen: 'FA-2026-001',
    titel: 'KI-gestützte Schadenserkennung an Brückenbauwerken mittels Drohneninspektion',
    status: 'genehmigt',
    priority: 'hoch',
    foerdergeber: 'BMBF Zukunft Bau',
    foerdersumme: 480000,
    laufzeit: '36 Monate',
    antragsteller: 'Prof. Dr. Bergmann',
    institution: 'TU München',
    branche: 'Künstliche Intelligenz',
    tags: ['KI', 'Brücken', 'Drohnen', 'Inspektion'],
    notes: 'Projektstart 01.04.2026. Erste Drohnenflüge an Pilotbrücken geplant.',
    dokumente: [docFa001],
  }),
  fill({
    aktenzeichen: 'FA-2026-002',
    titel: 'Perowskit-Tandemsolarzellen der dritten Generation für Gebäudeintegration',
    status: 'in_pruefung',
    priority: 'normal',
    foerdergeber: 'DFG Sachbeihilfe',
    foerdersumme: 320000,
    laufzeit: '24 Monate',
    antragsteller: 'Dr. Nakamura',
    institution: 'Fraunhofer ISE',
    branche: 'Energieforschung',
    tags: ['Solar', 'Perowskit', 'Gebäudeintegration'],
    notes: 'Vorbegutachtung positiv. Hauptbegutachtung läuft.',
    created: '2026-02-10T08:00:00Z',
    dokumente: [fake('fa002-proj', 'Projektbeschreibung_FA002.pdf', 'projektbeschreibung', '2026-02-05', 240)],
  }),
  fill({
    aktenzeichen: 'FA-2026-003',
    titel: 'mRNA-basierte Therapieansätze bei chronisch-entzündlichen Darmerkrankungen',
    status: 'neu',
    priority: 'hoch',
    foerdergeber: 'BMBF Gesundheitsforschung',
    foerdersumme: 750000,
    laufzeit: '48 Monate',
    antragsteller: 'Prof. Dr. Hartmann',
    institution: 'Uni Heidelberg',
    branche: 'Medizin',
    tags: ['mRNA', 'CED', 'Therapie', 'Immunologie'],
    notes: 'Ethikantrag eingereicht. Tierschutzprotokoll in Vorbereitung.',
    created: '2026-02-15T08:00:00Z',
    dokumente: [fake('fa003-proj', 'Projektbeschreibung_FA003.pdf', 'projektbeschreibung', '2026-02-12', 310)],
  }),
  fill({
    aktenzeichen: 'FA-2026-004',
    titel: 'Selbstheilende Betone mit mikroverkapselten Reparaturagentien',
    status: 'genehmigt',
    priority: 'normal',
    foerdergeber: 'DFG Schwerpunktprogramm',
    foerdersumme: 290000,
    laufzeit: '36 Monate',
    antragsteller: 'Dr. Steinbach',
    institution: 'RWTH Aachen',
    branche: 'Materialwissenschaft',
    tags: ['Beton', 'Selbstheilung', 'Mikrokapseln'],
    notes: 'Zwischenbericht nach 12 Monaten positiv bewertet. Verlängerung empfohlen.',
    dokumente: [
      fake('fa004-proj', 'Projektbeschreibung_FA004.pdf', 'projektbeschreibung', '2026-01-15', 285),
      fake('fa004-vnw', 'Verwendungsnachweis_FA004_2025.pdf', 'verwendungsnachweis', '2026-01-20', 95),
    ],
  }),
  fill({
    aktenzeichen: 'FA-2026-005',
    titel: 'Langzeitmonitoring urbaner Biodiversität mittels eDNA-Metabarcoding',
    status: 'in_pruefung',
    priority: 'normal',
    foerdergeber: 'BfN F+E-Vorhaben',
    foerdersumme: 185000,
    laufzeit: '30 Monate',
    antragsteller: 'Dr. Waldmann',
    institution: 'Senckenberg Gesellschaft',
    branche: 'Umweltwissenschaft',
    tags: ['Biodiversität', 'eDNA', 'Monitoring', 'Stadt'],
    notes: 'Probennahmeprotokoll abgestimmt mit Umweltamt.',
    created: '2026-02-20T08:00:00Z',
    dokumente: [fake('fa005-proj', 'Projektbeschreibung_FA005.pdf', 'projektbeschreibung', '2026-02-18', 195)],
  }),
  fill({
    aktenzeichen: 'FA-2026-006',
    titel: 'Autonome Mikromobilität: Letzte-Meile-Logistik mit Lieferrobotern',
    status: 'nachforderung',
    priority: 'hoch',
    foerdergeber: 'BMWK Reallabore',
    foerdersumme: 420000,
    laufzeit: '24 Monate',
    antragsteller: 'Prof. Dr. Richter',
    institution: 'KIT',
    branche: 'Mobilität',
    tags: ['Roboter', 'Logistik', 'Autonomie', 'Letzte Meile'],
    notes: 'Sicherheitskonzept unzureichend. Nachbesserung bei Haftungsfragen erforderlich.',
    created: '2026-02-25T08:00:00Z',
    frist_datum: '2026-04-30',
    dokumente: [
      fake('fa006-proj', 'Projektbeschreibung_FA006.pdf', 'projektbeschreibung', '2026-02-22', 215),
      fake('fa006-nach', 'Nachforderung_FA006_Haftung.pdf', 'nachforderung', '2026-03-15', 45),
    ],
  }),
  fill({
    aktenzeichen: 'FA-2026-007',
    titel: 'Adaptive Lernplattform mit lernpfadbasierter Personalisierung',
    status: 'neu',
    priority: 'normal',
    foerdergeber: 'BMBF Digitale Bildung',
    foerdersumme: 210000,
    laufzeit: '24 Monate',
    antragsteller: 'Dr. Lehmann',
    institution: 'FU Berlin',
    branche: 'Bildungsforschung',
    tags: ['E-Learning', 'Personalisierung', 'KI', 'Bildung'],
    notes: 'Projektskizze eingereicht. Feedback ausstehend.',
    created: '2026-03-01T08:00:00Z',
    dokumente: [fake('fa007-proj', 'Projektskizze_FA007.pdf', 'projektbeschreibung', '2026-03-01', 125)],
  }),
  fill({
    aktenzeichen: 'FA-2026-008',
    titel: 'Fehlertolerante Quantenalgorithmen für kombinatorische Optimierungsprobleme',
    status: 'in_pruefung',
    priority: 'hoch',
    foerdergeber: 'DFG Exzellenzcluster',
    foerdersumme: 680000,
    laufzeit: '48 Monate',
    antragsteller: 'Prof. Dr. Quantum',
    institution: 'LMU München',
    branche: 'Quantencomputing',
    tags: ['Quanten', 'Algorithmen', 'Optimierung'],
    notes: 'Zweitgutachten angefordert. Erste Bewertung vielversprechend.',
    created: '2026-03-05T08:00:00Z',
    dokumente: [
      fake('fa008-proj', 'Projektbeschreibung_FA008.pdf', 'projektbeschreibung', '2026-03-01', 340),
      fake('fa008-gut', 'Erstgutachten_FA008.pdf', 'gutachten', '2026-03-20', 68),
    ],
  }),
  fill({
    aktenzeichen: 'FA-2026-009',
    titel: 'Nachhaltige Lithium-Rückgewinnung aus Altbatterien durch Bioleaching',
    status: 'genehmigt',
    priority: 'normal',
    foerdergeber: 'EU Horizon Europe',
    foerdersumme: 520000,
    laufzeit: '36 Monate',
    antragsteller: 'Dr. Grünewald',
    institution: 'TU Braunschweig',
    branche: 'Kreislaufwirtschaft',
    tags: ['Lithium', 'Recycling', 'Bioleaching', 'Batterien'],
    notes: 'EU-Vertrag unterzeichnet. Kooperationspartner in Finnland und Spanien.',
    dokumente: [fake('fa009-proj', 'Projektbeschreibung_FA009.pdf', 'projektbeschreibung', '2026-01-12', 412)],
  }),
  fill({
    aktenzeichen: 'FA-2026-010',
    titel: 'Psychosoziale Resilienzfaktoren bei Langzeitarbeitslosen',
    status: 'neu',
    priority: 'niedrig',
    foerdergeber: 'DFG Sachbeihilfe',
    foerdersumme: 195000,
    laufzeit: '36 Monate',
    antragsteller: 'Prof. Dr. Neumann',
    institution: 'Uni Bielefeld',
    branche: 'Sozialforschung',
    tags: ['Resilienz', 'Arbeitslosigkeit', 'Längsschnitt'],
    notes: 'Datenschutzfolgenabschätzung in Bearbeitung.',
    created: '2026-03-10T08:00:00Z',
    dokumente: [
      fake('fa010-proj', 'Projektskizze_FA010.pdf', 'projektbeschreibung', '2026-03-05', 175),
      docFa010,
    ],
  }),
  fill({
    aktenzeichen: 'FA-2026-011',
    titel: 'Digitale Zwillinge für prädiktive Instandhaltung kommunaler Wassernetze',
    status: 'in_pruefung',
    priority: 'hoch',
    foerdergeber: 'BMBF Smart Cities',
    foerdersumme: 390000,
    laufzeit: '30 Monate',
    antragsteller: 'Dr. Wassermann',
    institution: 'Fraunhofer IOSB',
    branche: 'Infrastruktur',
    tags: ['Digital Twin', 'Wasser', 'KI', 'Infrastruktur'],
    notes: 'Pilotkommune Karlsruhe hat Kooperationsvertrag unterzeichnet.',
    created: '2026-03-12T08:00:00Z',
    dokumente: [fake('fa011-proj', 'Projektbeschreibung_FA011.pdf', 'projektbeschreibung', '2026-03-10', 290)],
  }),
  fill({
    aktenzeichen: 'FA-2026-012',
    titel: 'Stammzellbasierte Knorpelregeneration bei Arthrose des Kniegelenks',
    status: 'nachforderung',
    priority: 'hoch',
    foerdergeber: 'BMBF Gesundheitsforschung',
    foerdersumme: 610000,
    laufzeit: '48 Monate',
    antragsteller: 'Prof. Dr. Gelenk',
    institution: 'Charité Berlin',
    branche: 'Medizin',
    tags: ['Stammzellen', 'Knorpel', 'Arthrose', 'Regeneration'],
    notes: 'GMP-Herstellungsprotokoll muss überarbeitet werden.',
    created: '2026-03-15T08:00:00Z',
    frist_datum: '2026-05-15',
    dokumente: [
      fake('fa012-proj', 'Projektbeschreibung_FA012.pdf', 'projektbeschreibung', '2026-03-12', 420),
      fake('fa012-nach', 'Nachforderung_FA012_GMP.pdf', 'nachforderung', '2026-04-01', 58),
    ],
  }),
  fill({
    aktenzeichen: 'FA-2026-013',
    titel: 'Agrivoltaik: Optimierung der Nutzpflanzenproduktion unter Solarmodulen',
    status: 'genehmigt',
    priority: 'normal',
    foerdergeber: 'BMEL Innovationsprogramm',
    foerdersumme: 340000,
    laufzeit: '30 Monate',
    antragsteller: 'Dr. Feldmann',
    institution: 'Uni Hohenheim',
    branche: 'Agrarforschung',
    tags: ['Agrivoltaik', 'Solar', 'Landwirtschaft', 'Erträge'],
    notes: 'Versuchsfläche eingerichtet. Erste Pflanzung im Frühjahr 2026.',
    dokumente: [docFa013],
  }),
  fill({
    aktenzeichen: 'FA-2026-014',
    titel: 'Sprachmodell-gestützte Verwaltungsautomation für kommunale Genehmigungsverfahren',
    status: 'neu',
    priority: 'normal',
    foerdergeber: 'BMI Verwaltungsmodernisierung',
    foerdersumme: 280000,
    laufzeit: '24 Monate',
    antragsteller: 'Dr. Digitale',
    institution: 'DFKI',
    branche: 'Verwaltungsinformatik',
    tags: ['LLM', 'Verwaltung', 'Automation', 'NLP'],
    notes: 'Datenschutzkonzept für kommunale Antragsdaten in Abstimmung.',
    created: '2026-03-18T08:00:00Z',
    dokumente: [fake('fa014-proj', 'Projektbeschreibung_FA014.pdf', 'projektbeschreibung', '2026-03-15', 220)],
  }),
  fill({
    aktenzeichen: 'FA-2026-015',
    titel: 'Klimaadaptive Stadtplanung: Hitzeinseln und Schwammstadt-Konzepte',
    status: 'in_pruefung',
    priority: 'normal',
    foerdergeber: 'BMUV Klimaanpassung',
    foerdersumme: 450000,
    laufzeit: '36 Monate',
    antragsteller: 'Prof. Dr. Klima',
    institution: 'TU Dortmund',
    branche: 'Stadtplanung',
    tags: ['Klima', 'Hitze', 'Schwammstadt', 'Stadtplanung'],
    notes: 'Modellvalidierung mit Realdaten aus Dortmund und Essen.',
    created: '2026-03-20T08:00:00Z',
    dokumente: [fake('fa015-proj', 'Projektbeschreibung_FA015.pdf', 'projektbeschreibung', '2026-03-18', 315)],
  }),
  fill({
    aktenzeichen: 'FA-2026-016',
    titel: 'Biokunststoffe aus Lignocellulose: Skalierung vom Labor zur Pilotanlage',
    status: 'genehmigt',
    priority: 'hoch',
    foerdergeber: 'BMWK Industrielle Forschung',
    foerdersumme: 870000,
    laufzeit: '42 Monate',
    antragsteller: 'Dr. Polymer',
    institution: 'Fraunhofer IVV',
    branche: 'Materialwissenschaft',
    tags: ['Biokunststoff', 'Lignocellulose', 'Pilotanlage', 'Skalierung'],
    notes: 'Pilotanlage 500kg/d in Planung. Industriepartner BASF und Covestro beteiligt.',
    dokumente: [
      fake('fa016-proj', 'Projektbeschreibung_FA016.pdf', 'projektbeschreibung', '2026-01-05', 510),
      docFa016,
    ],
  }),
  // --- Zusatzliche 4 Antrage fur breitere Filter-Abdeckung ---
  fill({
    aktenzeichen: 'FA-2026-017',
    titel: 'Heisenberg-Förderung: Theoretische Grundlagen dissipativer Quantensysteme',
    status: 'genehmigt',
    priority: 'normal',
    foerdergeber: 'DFG Heisenberg',
    foerdersumme: 390000,
    laufzeit: '60 Monate',
    antragsteller: 'PD Dr. Dissipativ',
    institution: 'Universität Freiburg',
    branche: 'Theoretische Physik',
    tags: ['Quanten', 'Theorie', 'Heisenberg', 'Dissipation'],
    notes: 'Eigenständiges Forschungsprofil etabliert. Habilitation abgeschlossen.',
    created: '2026-01-20T08:00:00Z',
    dokumente: [fake('fa017-proj', 'Projektbeschreibung_FA017.pdf', 'projektbeschreibung', '2026-01-18', 180)],
  }),
  fill({
    aktenzeichen: 'FA-2026-018',
    titel: 'ZIM-Kooperation: Sensorplattform für Predictive Maintenance in KMU-Fertigungslinien',
    status: 'neu',
    priority: 'normal',
    foerdergeber: 'BMWK ZIM-Kooperation',
    foerdersumme: 175000,
    laufzeit: '24 Monate',
    antragsteller: 'Dr.-Ing. Sensortechnik',
    institution: 'SensorCraft GmbH (Verbund mit TU Chemnitz)',
    branche: 'Industrie 4.0',
    tags: ['ZIM', 'Sensor', 'Predictive Maintenance', 'KMU'],
    notes: 'Verbundantrag mit TU Chemnitz. Drei KMU als Anwender angebunden.',
    created: '2026-03-25T08:00:00Z',
    frist_datum: '2026-04-28',
    dokumente: [
      fake('fa018-proj', 'Projektbeschreibung_FA018.pdf', 'projektbeschreibung', '2026-03-22', 245),
      fake('fa018-sonst', 'Verbundvereinbarung_FA018.pdf', 'sonstiges', '2026-03-22', 85),
    ],
  }),
  fill({
    aktenzeichen: 'FA-2026-019',
    titel: 'KMU-innovativ: Federated-Learning-Framework für medizinische Bildgebung ohne Datenabgabe',
    status: 'abgelehnt',
    priority: 'niedrig',
    foerdergeber: 'BMBF KMU-innovativ',
    foerdersumme: 420000,
    laufzeit: '30 Monate',
    antragsteller: 'Dr. Föderal',
    institution: 'MedAI Solutions GmbH',
    branche: 'Medizintechnik',
    tags: ['Federated Learning', 'Medizin', 'Bildgebung', 'KMU'],
    notes: 'Abgelehnt in zweiter Förderrunde. Gutachterkritik: Marktreife nicht ausreichend belegt.',
    created: '2026-02-08T08:00:00Z',
    dokumente: [
      fake('fa019-proj', 'Projektbeschreibung_FA019.pdf', 'projektbeschreibung', '2026-02-05', 275),
      fake('fa019-gut', 'Ablehnungsbescheid_FA019.pdf', 'gutachten', '2026-03-28', 32),
    ],
  }),
  fill({
    aktenzeichen: 'FA-2026-020',
    titel: 'EU EIC Accelerator: Skalierung Grüner-Wasserstoff-Elektrolyseure auf MW-Klasse',
    status: 'in_pruefung',
    priority: 'hoch',
    foerdergeber: 'EU EIC Accelerator',
    foerdersumme: 2400000,
    laufzeit: '36 Monate',
    antragsteller: 'Dr. Wasserstoff',
    institution: 'HydroScale AG',
    branche: 'Energieforschung',
    tags: ['Wasserstoff', 'Elektrolyse', 'EU', 'Skalierung'],
    notes: 'EIC-Jury-Interview durchgeführt. Entscheidung im Mai 2026 erwartet.',
    created: '2026-03-28T08:00:00Z',
    frist_datum: '2026-05-20',
    dokumente: [
      fake('fa020-proj', 'EIC_Proposal_FA020.pdf', 'projektbeschreibung', '2026-03-25', 580),
    ],
  }),
];

export const PROGRAMM_ID_PLACEHOLDER = PROGRAMM_PLACEHOLDER;
