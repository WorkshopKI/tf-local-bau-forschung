import type { EvalTestCase } from './eval-types';

export const EVAL_TEST_CASES: EvalTestCase[] = [
  // === KEYWORD TESTS (K1-K5) ===
  {
    id: 'K1', query: 'Brandschutz', category: 'keyword', difficulty: 'easy',
    description: 'Exakter Keyword-Match auf Brandschutz-Dokumente',
    expectedDocs: ['Brandschutz_BA013.md', 'Brandschutz_BA006.md', 'Brandschutz_BA018.md', 'Brandschutz_BA002.md', 'Brandschutz_BA012.md'],
  },
  {
    id: 'K2', query: 'Tiefgarage', category: 'keyword', difficulty: 'easy',
    description: 'Keyword findet Tiefgarage-Dokumente und Vorgang',
    expectedDocs: ['Statik_Tragwerk_BA010.md', 'Hydrogeologie_BA010.md'],
  },
  {
    id: 'K3', query: 'Perowskit', category: 'keyword', difficulty: 'easy',
    description: 'Spezieller Fachbegriff findet Forschungsprojekt',
    expectedDocs: ['Projekt_FA002.md'],
    expectedTop1: 'Projekt_FA002.md',
  },
  {
    id: 'K4', query: 'Holzrahmenbau', category: 'keyword', difficulty: 'easy',
    description: 'Baufachbegriff findet relevante Statik/Formular-Dokumente',
    expectedDocs: ['Statik_Tragwerk_BA011.md', 'Bauantragsformular_BA012.md'],
  },
  {
    id: 'K5', query: 'Nachforderung', category: 'keyword', difficulty: 'easy',
    description: 'Verwaltungsbegriff findet Nachforderungsschreiben',
    expectedDocs: ['Nachforderung_BA004.md', 'Nachforderung_BA017.md'],
  },

  // === SEMANTISCHE TESTS (S1-S15) ===
  {
    id: 'S1', query: 'Wie evakuiert man Kleinkinder?', category: 'semantic', difficulty: 'hard',
    description: 'Umgangssprache soll Kita-Brandschutzkonzept finden',
    expectedDocs: ['Brandschutz_BA012.md', 'Brandschutz_BA018.md'],
    expectedTop1: 'Brandschutz_BA012.md',
  },
  {
    id: 'S2', query: 'Gebaeude Energie sparen', category: 'semantic', difficulty: 'medium',
    description: 'Paraphrase soll Energienachweise finden',
    expectedDocs: ['Energienachweis_BA001.md', 'Energienachweis_BA002.md', 'Energienachweis_BA009.md'],
  },
  {
    id: 'S3', query: 'Nachbar klagt wegen Schatten', category: 'semantic', difficulty: 'hard',
    description: 'Umgangssprache soll Nachbar-Stellungnahme finden',
    expectedDocs: ['Stellungnahme_Nachbar_BA002.md'],
    expectedTop1: 'Stellungnahme_Nachbar_BA002.md',
  },
  {
    id: 'S4', query: 'Gift im Boden', category: 'semantic', difficulty: 'medium',
    description: 'Umgangssprache "Gift" soll Altlastengutachten (PAK) finden',
    expectedDocs: ['Altlastengutachten_BA006.md'],
    expectedTop1: 'Altlastengutachten_BA006.md',
  },
  {
    id: 'S5', query: 'Denkmalschutz Sanierung Fachwerk', category: 'semantic', difficulty: 'medium',
    description: 'Sachbearbeiter sucht Denkmalschutz-Stellungnahme fuer Fachwerksanierung',
    expectedDocs: ['Stellungnahme_Denkmalschutz_BA005.md', 'Stellungnahme_Denkmalschutz_BA021.md'],
  },
  {
    id: 'S6', query: 'Grundwasser Baugrube', category: 'semantic', difficulty: 'easy',
    description: 'Fachbegriff-Kombination soll Hydrogeologie-Gutachten finden',
    expectedDocs: ['Hydrogeologie_BA010.md', 'Statik_Tragwerk_BA010.md'],
    expectedTop1: 'Hydrogeologie_BA010.md',
  },
  {
    id: 'S7', query: 'Kuenstliche Intelligenz Infrastruktur', category: 'semantic', difficulty: 'medium',
    description: 'Uebergreifende Begriffe sollen KI-Forschungsprojekte finden',
    expectedDocs: ['Projekt_FA001.md', 'Projekt_FA011.md', 'Projekt_FA014.md'],
  },
  {
    id: 'S8', query: 'Tierversuche Ethik', category: 'semantic', difficulty: 'medium',
    description: 'Ethik-Begriffe sollen Tierversuch-Ethikantrag finden',
    expectedDocs: ['Ethik_FA003.md', 'Review_FA003.md'],
    expectedTop1: 'Ethik_FA003.md',
  },
  {
    id: 'S9', query: 'Datenschutz bei KI', category: 'semantic', difficulty: 'medium',
    description: 'Soll Datenschutzkonzept fuer Verwaltungsautomation finden',
    expectedDocs: ['Datenschutz_FA014.md', 'Projekt_FA014.md'],
    expectedTop1: 'Datenschutz_FA014.md',
  },
  {
    id: 'S10', query: 'Batterie Recycling', category: 'semantic', difficulty: 'medium',
    description: 'Synonym soll Bioleaching-Projekt (Altbatterien) finden',
    expectedDocs: ['Projekt_FA009.md', 'Compliance_FA009.md'],
    expectedTop1: 'Projekt_FA009.md',
  },
  {
    id: 'S11', query: 'Radweg Bruecke Tragwerk', category: 'semantic', difficulty: 'medium',
    description: 'Sachbearbeiter sucht Statik-Gutachten fuer Radschnellweg-Bruecke',
    expectedDocs: ['Statik_Tragwerk_BA024.md', 'Bauantragsformular_BA024.md'],
  },
  {
    id: 'S12', query: 'Senioren Wohnung barrierefrei', category: 'semantic', difficulty: 'medium',
    description: 'Soll Seniorenwohnanlage-Dokumente finden',
    expectedDocs: ['Bauantragsformular_BA018.md', 'Brandschutz_BA018.md'],
  },
  {
    id: 'S13', query: 'Feuerwiderstand Rettungswege', category: 'semantic', difficulty: 'easy',
    description: 'Brandschutz-Fachbegriffe sollen Brandschutz-Dokumente finden',
    expectedDocs: ['Brandschutz_BA002.md', 'Brandschutz_BA012.md', 'Brandschutz_BA018.md'],
  },
  {
    id: 'S14', query: 'Energienachweis Daemmung Aussenwand', category: 'semantic', difficulty: 'easy',
    description: 'Energiefachbegriffe sollen Energienachweise finden',
    expectedDocs: ['Energienachweis_BA001.md', 'Energienachweis_BA002.md'],
  },
  {
    id: 'S15', query: 'Foerdergelder Nachhaltigkeit', category: 'semantic', difficulty: 'hard',
    description: 'Ueberbegriff soll Forschungsprojekte zu Klima/Energie finden',
    expectedDocs: ['Projekt_FA009.md', 'Projekt_FA013.md', 'Projekt_FA016.md'],
  },
];
