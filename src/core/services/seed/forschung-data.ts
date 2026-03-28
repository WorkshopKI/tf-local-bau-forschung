import type { Vorgang } from '@/core/types/vorgang';

interface ForschungsVorgang extends Vorgang {
  foerderprogramm: string;
  foerdersumme: number;
  laufzeit: string;
  projektleiter: string;
  institution: string;
  forschungsgebiet: string;
}

const f = (id: string, title: string, status: Vorgang['status'], prio: Vorgang['priority'], fp: string, summe: number, lz: string, pl: string, inst: string, gebiet: string, tags: string[], notes: string, created = '2026-02-01T08:00:00Z'): ForschungsVorgang => ({
  id, type: 'forschung', title, status, priority: prio, assignee: pl, created, modified: created, tags, notes,
  foerderprogramm: fp, foerdersumme: summe, laufzeit: lz, projektleiter: pl, institution: inst, forschungsgebiet: gebiet,
});

export const forschungData: ForschungsVorgang[] = [
  f('FA-2026-001', 'KI-gestützte Schadenserkennung an Brückenbauwerken mittels Drohneninspektion', 'genehmigt', 'hoch', 'BMBF Zukunft Bau', 480000, '36 Monate', 'Prof. Dr. Bergmann', 'TU München', 'Künstliche Intelligenz', ['KI', 'Brücken', 'Drohnen', 'Inspektion'], 'Projektstart 01.04.2026. Erste Drohnenflüge an Pilotbrücken geplant.'),
  f('FA-2026-002', 'Perowskit-Tandemsolarzellen der dritten Generation für Gebäudeintegration', 'in_pruefung', 'normal', 'DFG Sachbeihilfe', 320000, '24 Monate', 'Dr. Nakamura', 'Fraunhofer ISE', 'Energieforschung', ['Solar', 'Perowskit', 'Gebäudeintegration'], 'Vorbegutachtung positiv. Hauptbegutachtung läuft.', '2026-02-10T08:00:00Z'),
  f('FA-2026-003', 'mRNA-basierte Therapieansätze bei chronisch-entzündlichen Darmerkrankungen', 'neu', 'hoch', 'BMBF Gesundheitsforschung', 750000, '48 Monate', 'Prof. Dr. Hartmann', 'Uni Heidelberg', 'Medizin', ['mRNA', 'CED', 'Therapie', 'Immunologie'], 'Ethikantrag eingereicht. Tierschutzprotokoll in Vorbereitung.', '2026-02-15T08:00:00Z'),
  f('FA-2026-004', 'Selbstheilende Betone mit mikroverkapselten Reparaturagentien', 'genehmigt', 'normal', 'DFG Schwerpunktprogramm', 290000, '36 Monate', 'Dr. Steinbach', 'RWTH Aachen', 'Materialwissenschaft', ['Beton', 'Selbstheilung', 'Mikrokapseln'], 'Zwischenbericht nach 12 Monaten positiv bewertet. Verlängerung empfohlen.'),
  f('FA-2026-005', 'Langzeitmonitoring urbaner Biodiversität mittels eDNA-Metabarcoding', 'in_pruefung', 'normal', 'BfN F+E-Vorhaben', 185000, '30 Monate', 'Dr. Waldmann', 'Senckenberg Gesellschaft', 'Umweltwissenschaft', ['Biodiversität', 'eDNA', 'Monitoring', 'Stadt'], 'Probennahmeprotokoll abgestimmt mit Umweltamt.', '2026-02-20T08:00:00Z'),
  f('FA-2026-006', 'Autonome Mikromobilität: Letzte-Meile-Logistik mit Lieferrobotern', 'nachforderung', 'hoch', 'BMWK Reallabore', 420000, '24 Monate', 'Prof. Dr. Richter', 'KIT', 'Mobilität', ['Roboter', 'Logistik', 'Autonomie', 'Letzte Meile'], 'Sicherheitskonzept unzureichend. Nachbesserung bei Haftungsfragen erforderlich.', '2026-02-25T08:00:00Z'),
  f('FA-2026-007', 'Adaptive Lernplattform mit lernpfadbasierter Personalisierung', 'neu', 'normal', 'BMBF Digitale Bildung', 210000, '24 Monate', 'Dr. Lehmann', 'FU Berlin', 'Bildungsforschung', ['E-Learning', 'Personalisierung', 'KI', 'Bildung'], 'Projektskizze eingereicht. Feedback ausstehend.', '2026-03-01T08:00:00Z'),
  f('FA-2026-008', 'Fehlertolerante Quantenalgorithmen für kombinatorische Optimierungsprobleme', 'in_pruefung', 'hoch', 'DFG Exzellenzcluster', 680000, '48 Monate', 'Prof. Dr. Quantum', 'LMU München', 'Quantencomputing', ['Quanten', 'Algorithmen', 'Optimierung'], 'Zweitgutachten angefordert. Erste Bewertung vielversprechend.', '2026-03-05T08:00:00Z'),
  f('FA-2026-009', 'Nachhaltige Lithium-Rückgewinnung aus Altbatterien durch Bioleaching', 'genehmigt', 'normal', 'EU Horizon Europe', 520000, '36 Monate', 'Dr. Grünewald', 'TU Braunschweig', 'Kreislaufwirtschaft', ['Lithium', 'Recycling', 'Bioleaching', 'Batterien'], 'EU-Vertrag unterzeichnet. Kooperationspartner in Finnland und Spanien.'),
  f('FA-2026-010', 'Psychosoziale Resilienzfaktoren bei Langzeitarbeitslosen', 'neu', 'niedrig', 'DFG Sachbeihilfe', 195000, '36 Monate', 'Prof. Dr. Neumann', 'Uni Bielefeld', 'Sozialforschung', ['Resilienz', 'Arbeitslosigkeit', 'Längsschnitt'], 'Datenschutzfolgenabschätzung in Bearbeitung.', '2026-03-10T08:00:00Z'),
  f('FA-2026-011', 'Digitale Zwillinge für prädiktive Instandhaltung kommunaler Wassernetze', 'in_pruefung', 'hoch', 'BMBF Smart Cities', 390000, '30 Monate', 'Dr. Wassermann', 'Fraunhofer IOSB', 'Infrastruktur', ['Digital Twin', 'Wasser', 'KI', 'Infrastruktur'], 'Pilotkommune Karlsruhe hat Kooperationsvertrag unterzeichnet.', '2026-03-12T08:00:00Z'),
  f('FA-2026-012', 'Stammzellbasierte Knorpelregeneration bei Arthrose des Kniegelenks', 'nachforderung', 'hoch', 'BMBF Gesundheitsforschung', 610000, '48 Monate', 'Prof. Dr. Gelenk', 'Charité Berlin', 'Medizin', ['Stammzellen', 'Knorpel', 'Arthrose', 'Regeneration'], 'GMP-Herstellungsprotokoll muss überarbeitet werden.', '2026-03-15T08:00:00Z'),
  f('FA-2026-013', 'Agrivoltaik: Optimierung der Nutzpflanzenproduktion unter Solarmodulen', 'genehmigt', 'normal', 'BMEL Innovationsprogramm', 340000, '30 Monate', 'Dr. Feldmann', 'Uni Hohenheim', 'Agrarforschung', ['Agrivoltaik', 'Solar', 'Landwirtschaft', 'Erträge'], 'Versuchsfläche eingerichtet. Erste Pflanzung im Frühjahr 2026.'),
  f('FA-2026-014', 'Sprachmodell-gestützte Verwaltungsautomation für kommunale Genehmigungsverfahren', 'neu', 'normal', 'BMI Verwaltungsmodernisierung', 280000, '24 Monate', 'Dr. Digitale', 'DFKI', 'Verwaltungsinformatik', ['LLM', 'Verwaltung', 'Automation', 'NLP'], 'Datenschutzkonzept für kommunale Antragsdaten in Abstimmung.', '2026-03-18T08:00:00Z'),
  f('FA-2026-015', 'Klimaadaptive Stadtplanung: Hitzeinseln und Schwammstadt-Konzepte', 'in_pruefung', 'normal', 'BMUV Klimaanpassung', 450000, '36 Monate', 'Prof. Dr. Klima', 'TU Dortmund', 'Stadtplanung', ['Klima', 'Hitze', 'Schwammstadt', 'Stadtplanung'], 'Modellvalidierung mit Realdaten aus Dortmund und Essen.', '2026-03-20T08:00:00Z'),
  f('FA-2026-016', 'Biokunststoffe aus Lignocellulose: Skalierung vom Labor zur Pilotanlage', 'genehmigt', 'hoch', 'BMWK Industrielle Forschung', 870000, '42 Monate', 'Dr. Polymer', 'Fraunhofer IVV', 'Materialwissenschaft', ['Biokunststoff', 'Lignocellulose', 'Pilotanlage', 'Skalierung'], 'Pilotanlage 500kg/d in Planung. Industriepartner BASF und Covestro beteiligt.'),
];
