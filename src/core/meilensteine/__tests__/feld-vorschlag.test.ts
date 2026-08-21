/**
 * Feld-Vorschläge — gemessen an dem, was wirklich dasteht.
 *
 * Der Vorrat unten ist der **echte** Spalten-Katalog des Entwicklungs-Bestands
 * (abgelesen im Auswahlfeld des Bedingungs-Editors), die Bezeichnungen sind die
 * zehn Meilensteine des ausgelieferten Plans. Ein Vorschlag, der an diesen
 * beiden Listen nichts trifft, ist wertlos — deshalb wird hier gegen sie
 * gemessen und nicht gegen erfundene Sätze.
 *
 * Die zweite Hälfte ist genauso wichtig: **was NICHT vorgeschlagen wird.** Ein
 * falscher Vorschlag an prominenter Stelle kostet mehr, als ein fehlender spart.
 */
import { describe, expect, it } from 'vitest';
import type { SpaltenEintrag } from '../spalten-katalog';
import { schlageBedingungVor, schlageFelderVor } from '../feld-vorschlag';

function eintrag(
  feldId: string, label: string, typ: SpaltenEintrag['typ'] = 'wert',
  quellCodes: string[] = [],
): SpaltenEintrag {
  return {
    feldId, label, typ,
    quelle: feldId === feldId.toUpperCase() && feldId.includes('_') ? 'csv' : 'kanonisch',
    schemaAnzahl: 1, programmAnzahl: 1, quellCodes,
  };
}

/** Der Vorrat aus dem laufenden Entwicklungs-Bestand, in Katalog-Reihenfolge. */
const VORRAT: SpaltenEintrag[] = [
  eintrag('akronym', 'VB Kurzname'),
  eintrag('aktenzeichen', 'aktenzeichen'),
  eintrag('antragsdatum', 'Antrags eingang', 'datum', ['D_AN']),
  eintrag('antragsteller', 'ausführende Stelle'),
  eintrag('bewilligung_datum', 'Bewilligung', 'datum', ['D_ABB']),
  eintrag('bib_kuerz', 'BIB'),
  eintrag('erstentscheidung', 'Erstentscheidung', 'datum', ['D_AZ1']),
  eintrag('pfm_kuerz', 'PFM'),
  eintrag('status', 'Status TV'),
  eintrag('tib_kuerz', 'TIB'),
  eintrag('tib_mail', 'tib_mail'),
  eintrag('titel', 'TV Titel'),
  eintrag('unterprogramm_id', 'Programm'),
  eintrag('vb_phase', 'Phase'),
  eintrag('verbund_id', 'VB Kennz.'),
  eintrag('verbund_status', 'Status VB'),
  eintrag('verbund_titel', 'VB Titel'),
  eintrag('ztp_kuerz', 'ZTP'),
];

const bestes = (text: string): string | null =>
  schlageFelderVor(text, VORRAT, 1)[0]?.feldId ?? null;

describe('feld-vorschlag · die zehn echten Meilenstein-Bezeichnungen', () => {
  it('„Antrag im System eingegeben" → antragsdatum', () => {
    expect(bestes('Antrag im System eingegeben')).toBe('antragsdatum');
  });

  it('„Antrag zugewiesen" → tib_kuerz (über das Fachwort, nicht über den Namen)', () => {
    // „TIB" heißt die Spalte; „zugewiesen" steht in keiner Beschriftung. Genau
    // diese Lücke schließt die Synonym-Tabelle.
    expect(bestes('Antrag zugewiesen')).toBe('tib_kuerz');
  });

  it('nimmt die Beschreibung mit, wenn der Aufrufer sie anhängt', () => {
    const text = 'Antrag zugewiesen Bearbeiter mit passender Expertise und freier Kapazität eingetragen.';
    const treffer = schlageFelderVor(text, VORRAT, 5).map(v => v.feldId);
    expect(treffer).toContain('tib_kuerz');
    expect(treffer).toContain('bib_kuerz');
  });

  it('„PreCheck mit Erstentscheidung" → erstentscheidung', () => {
    expect(bestes('PreCheck mit Erstentscheidung')).toBe('erstentscheidung');
  });

  it('„QS der finalen Erstentscheidung" → erstentscheidung', () => {
    expect(bestes('QS der finalen Erstentscheidung')).toBe('erstentscheidung');
  });

  it('„Bewilligungsunterlagen versendet" → bewilligung_datum (Präfix-Treffer)', () => {
    expect(bestes('Bewilligungsunterlagen versendet')).toBe('bewilligung_datum');
  });

  it('„Antrag vollständig" schlägt nichts vor, statt zu raten', () => {
    // Es gibt im Bestand kein Feld für Vollständigkeit. Ein Vorschlag hier wäre
    // geraten — und würde als bare Münze genommen.
    expect(schlageFelderVor('Antrag vollständig', VORRAT)).toEqual([]);
  });

  it('„QS freigegeben und versendet" schlägt nichts vor', () => {
    expect(schlageFelderVor('QS freigegeben und versendet', VORRAT)).toEqual([]);
  });
});

describe('feld-vorschlag · was NICHT vorgeschlagen wird', () => {
  it('„Rückmeldung des Antragstellers" nennt nicht das Feld antragsteller', () => {
    // Das Wort steht da, das Feld ist trotzdem falsch: „ausführende Stelle" ist
    // ab Tag eins gefüllt, der Meilenstein wäre sofort erreicht.
    const treffer = schlageFelderVor('Rückmeldung des Antragstellers', VORRAT).map(v => v.feldId);
    expect(treffer).not.toContain('antragsteller');
  });

  it('nennt keine Benennungs-Felder (Titel, Kennzeichen, Programm)', () => {
    const treffer = schlageFelderVor('TV Titel VB Kennz. Programm aktenzeichen', VORRAT)
      .map(v => v.feldId);
    expect(treffer).toEqual([]);
  });

  it('lässt Stoppwörter und Kurzwörter nicht treffen', () => {
    // „QS", „AB", „FB" sind zwei Zeichen und träfen sonst jede Spalte, die sie
    // irgendwo enthält.
    expect(schlageFelderVor('QS der AB und FB', VORRAT)).toEqual([]);
    expect(schlageFelderVor('von der bei zum', VORRAT)).toEqual([]);
  });

  it('gibt bei leerem Text nichts zurück', () => {
    expect(schlageFelderVor('', VORRAT)).toEqual([]);
    expect(schlageFelderVor('   ', VORRAT)).toEqual([]);
  });
});

describe('feld-vorschlag · Form der Antwort', () => {
  it('hält die Grenze ein und sortiert absteigend nach Punkten', () => {
    const treffer = schlageFelderVor('Antrag zugewiesen Bearbeiter', VORRAT, 2);
    expect(treffer.length).toBeLessThanOrEqual(2);
    expect(treffer[0]!.punkte).toBeGreaterThanOrEqual(treffer[1]?.punkte ?? 0);
  });

  it('begründet jeden Vorschlag mit dem Wort, das ihn ausgelöst hat', () => {
    const [erster] = schlageFelderVor('Antrag zugewiesen', VORRAT);
    expect(erster?.grund).toContain('zugewiesen');
  });

  it('findet ein Feld auch über den rohen Spalten-Code', () => {
    const vorrat = [eintrag('erstentscheidung', 'Erstentscheidung', 'datum', ['D_AZ1'])];
    const [treffer] = schlageFelderVor('Termin az1 gesetzt', vorrat);
    expect(treffer?.feldId).toBe('erstentscheidung');
    expect(treffer?.grund).toContain('D_AZ1');
  });

  it('schlageBedingungVor liefert ein gefuellt-Blatt, nie ein wertloses ist', () => {
    expect(schlageBedingungVor('Antrag im System eingegeben', VORRAT))
      .toEqual({ feldId: 'antragsdatum', op: 'gefuellt' });
  });

  it('schlageBedingungVor gibt null, wenn nichts trägt', () => {
    expect(schlageBedingungVor('Antrag vollständig', VORRAT)).toBeNull();
  });

  it('bevorzugt bei Gleichstand die Datumsspalte', () => {
    const vorrat = [
      eintrag('abstimmung_kuerz', 'Abstimmung'),
      eintrag('abstimmung_datum', 'Abstimmung', 'datum'),
    ];
    expect(schlageFelderVor('Abstimmung erfolgt', vorrat, 1)[0]?.feldId).toBe('abstimmung_datum');
  });
});
