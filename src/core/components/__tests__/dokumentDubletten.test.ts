/**
 * Dubletten-Erkennung: dieselbe Datei zweimal aufgenommen ist eine neue FASSUNG,
 * kein zweites Dokument. Reproduziert den gemeldeten Bestand (5 Dateien × 3 Läufe
 * = 15 Inventar-Zeilen) und prüft, dass das Aufräumen keine Auswahl ins Leere zieht.
 */
import { describe, it, expect } from 'vitest';
import {
  dublettenSchluessel, findeGleichnamiges, gruppiereDubletten, zaehleAltfassungen,
  ziehePickUm, zieheAuswahlUm, type DublettenEintrag,
} from '../dokumentDubletten';

const eintrag = (docId: string, filename: string, created: string): DublettenEintrag =>
  ({ docId, filename, created });

const doc = (id: string, filename: string, created: string, tags: string[]) =>
  ({ id, filename, created, tags });

describe('dublettenSchluessel', () => {
  it('ignoriert Groß-/Kleinschreibung und Randleerraum', () => {
    expect(dublettenSchluessel('  Anlage 5.PDF ')).toBe('anlage 5.pdf');
  });

  it('unterscheidet echte Namensvarianten', () => {
    expect(dublettenSchluessel('Anlage 5 TV1.pdf')).not.toBe(dublettenSchluessel('Anlage 5 TV2.pdf'));
  });
});

describe('findeGleichnamiges', () => {
  const bestand = [
    doc('a', 'Projektbeschreibung.pdf', '2026-07-20T10:00:00Z', ['VB-1', 'vorhabensbeschreibung']),
    doc('b', 'Anlage 5.pdf', '2026-07-20T10:00:01Z', ['VB-1', 'arbeitsplan']),
    doc('c', 'Projektbeschreibung.pdf', '2026-07-21T09:00:00Z', ['VB-2', 'vorhabensbeschreibung']),
  ];

  it('findet den gleichnamigen Record desselben Verbundes', () => {
    expect(findeGleichnamiges(bestand, 'VB-1', 'Projektbeschreibung.pdf')?.id).toBe('a');
  });

  it('greift NICHT über Verbund-Grenzen hinweg', () => {
    // Sonst überschriebe eine gleichnamige Datei das Dokument eines fremden Antrags.
    expect(findeGleichnamiges(bestand, 'VB-3', 'Projektbeschreibung.pdf')).toBeNull();
  });

  it('liefert null, wenn der Name neu ist', () => {
    expect(findeGleichnamiges(bestand, 'VB-1', 'Wirkung.pdf')).toBeNull();
  });

  it('nimmt bei Altbestand mit mehreren Fassungen die jüngste', () => {
    const mehrfach = [
      doc('alt', 'Wirkung.pdf', '2026-07-20T10:00:00Z', ['VB-1']),
      doc('neu', 'Wirkung.pdf', '2026-07-21T10:00:00Z', ['VB-1']),
      doc('mittel', 'Wirkung.pdf', '2026-07-20T18:00:00Z', ['VB-1']),
    ];
    expect(findeGleichnamiges(mehrfach, 'VB-1', 'Wirkung.pdf')?.id).toBe('neu');
  });

  it('matcht unabhängig von Groß-/Kleinschreibung', () => {
    expect(findeGleichnamiges(bestand, 'VB-1', 'anlage 5.PDF')?.id).toBe('b');
  });
});

describe('gruppiereDubletten', () => {
  it('meldet nichts bei sauberem Bestand', () => {
    const rein = [
      eintrag('a', 'VB.pdf', '2026-07-20T10:00:00Z'),
      eintrag('b', 'Anlage 5.pdf', '2026-07-20T10:00:01Z'),
    ];
    expect(gruppiereDubletten(rein)).toEqual([]);
  });

  it('reproduziert den gemeldeten Bestand: 5 Dateien × 3 Läufe → 5 Gruppen, 10 Altfassungen', () => {
    const namen = ['Wirkung.pdf', 'Anlage 5.pdf', 'Anlage 5 TV2.pdf', 'Markt.pdf', 'Projekt.pdf'];
    const inventar = [0, 1, 2].flatMap(runde =>
      namen.map((n, i) => eintrag(`r${runde}-${i}`, n, `2026-07-2${runde}T10:00:0${i}Z`)));

    const gruppen = gruppiereDubletten(inventar);
    expect(gruppen).toHaveLength(5);
    expect(zaehleAltfassungen(gruppen)).toBe(10);
    // Behalten wird je Name die jüngste Fassung — also die aus der letzten Runde.
    for (const g of gruppen) expect(g.behalten.startsWith('r2-')).toBe(true);
  });

  it('behält die jüngste Fassung, unabhängig von der Eingabe-Reihenfolge', () => {
    const gruppen = gruppiereDubletten([
      eintrag('neu', 'X.pdf', '2026-07-21T10:00:00Z'),
      eintrag('alt', 'X.pdf', '2026-07-20T10:00:00Z'),
    ]);
    expect(gruppen[0]!.behalten).toBe('neu');
    expect(gruppen[0]!.entfernen).toEqual(['alt']);
  });

  it('fasst Namensvarianten mit abweichender Schreibung zusammen', () => {
    const gruppen = gruppiereDubletten([
      eintrag('a', 'Anlage 5.pdf', '2026-07-20T10:00:00Z'),
      eintrag('b', 'anlage 5.PDF', '2026-07-21T10:00:00Z'),
    ]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0]!.entfernen).toEqual(['a']);
  });
});

describe('Verweise umziehen', () => {
  const gruppen = gruppiereDubletten([
    eintrag('alt1', 'X.pdf', '2026-07-19T10:00:00Z'),
    eintrag('alt2', 'X.pdf', '2026-07-20T10:00:00Z'),
    eintrag('neu', 'X.pdf', '2026-07-21T10:00:00Z'),
  ]);

  it('zieht eine VB-Wahl von der Altfassung auf die behaltene', () => {
    expect(ziehePickUm('alt1', gruppen)).toBe('neu');
    expect(ziehePickUm('alt2', gruppen)).toBe('neu');
  });

  it('lässt eine Wahl auf ein unbeteiligtes Dokument unangetastet', () => {
    expect(ziehePickUm('anderes', gruppen)).toBe('anderes');
    expect(ziehePickUm(null, gruppen)).toBeNull();
  });

  it('faltet mehrere Altfassungen in der Korpus-Auswahl zu einem Eintrag', () => {
    // Ohne das Falten stünde dasselbe Dokument mehrfach im Korpus.
    expect(zieheAuswahlUm(['alt1', 'alt2', 'y'], gruppen)).toEqual(['neu', 'y']);
  });

  it('erhält die Reihenfolge der verbliebenen Auswahl', () => {
    expect(zieheAuswahlUm(['y', 'alt1', 'z'], gruppen)).toEqual(['y', 'neu', 'z']);
  });
});
