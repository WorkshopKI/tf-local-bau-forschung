/**
 * Tests für die Belege, die ein Treffer selbst ausschreiben muss (v4.23).
 *
 * Der Anlass steht im Modul-Kopf von `autoSpalten.ts`: eine Ortssuche lieferte
 * 485 Treffer, von denen die Zeile nur bei einer Handvoll zeigte, WO das Wort
 * stand. Die Regel dagegen ist knapp — und genau deshalb muss sie festgenagelt
 * sein: die Versuchung, „der Vollständigkeit halber" alle Trefferstellen
 * einzutragen, würde die Tabelle für nichts verbreitern.
 */
import { describe, it, expect } from 'vitest';
import { autoSpalten, belegWerte } from '../autoSpalten';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { Trefferfeld } from '@/core/services/search/trefferstelle';

function treffer(
  felder: Trefferfeld[],
  extra: Partial<UnifiedSearchResult> = {},
): UnifiedSearchResult {
  return {
    id: extra.fkz ?? '16DS250481',
    type: 'antrag',
    score: 0.5,
    method: 'fulltext',
    title: 'Ein Vorhaben',
    snippet: 'Eine Firma · AKRO',
    trefferfelder: felder,
    ...extra,
  };
}

describe('autoSpalten — die Einstellung', () => {
  it('blendet den Ort ein, sobald jemand den Ortsbereich wählt', () => {
    // Auch ohne Treffer: die Einstellung ist eine Ansage, kein Zufall.
    expect(autoSpalten('standort', [])).toEqual(['standort']);
  });

  it('nimmt den Wahlkreis NICHT automatisch dazu', () => {
    // Er gehört seit v4.50 zum selben Bereich, ist dort aber die seltenere
    // Fundstelle — zwei Dauerspalten für eine Wahl wären eine zu viel. Er
    // erscheint, sobald ein Treffer ihn wirklich trägt.
    expect(autoSpalten('standort', [])).not.toContain('wahlkreis');
    const menge = [treffer(['wahlkreis'], { wahlkreis: 'Goslar - Northeim - Göttingen II' })];
    expect(autoSpalten('standort', menge)).toEqual(['standort', 'wahlkreis']);
  });

  it('blendet in den übrigen Bereichen nichts ein, was schon sichtbar ist', () => {
    const t = treffer(['titel', 'organisation', 'aktenzeichen', 'akronym']);
    expect(autoSpalten('alles', [t])).toEqual([]);
    expect(autoSpalten('inhalt', [t])).toEqual([]);
    expect(autoSpalten('einrichtung', [t])).toEqual([]);
    expect(autoSpalten('dokumente', [t])).toEqual([]);
  });
});

describe('autoSpalten — die Fundstelle', () => {
  it('blendet den Ort auch im Standardbereich ein, sobald EIN Treffer ihn trägt', () => {
    const menge = [
      treffer(['titel']),
      treffer(['standort'], { standort: 'Dresden · Sachsen' }),
    ];
    expect(autoSpalten('alles', menge)).toEqual(['standort']);
  });

  it('blendet Deskriptoren ein, wenn dort getroffen wurde', () => {
    const menge = [treffer(['deskriptoren'], { deskriptoren: 'cloud computing' })];
    expect(autoSpalten('alles', menge)).toEqual(['deskriptoren']);
  });

  it('hält die Reihenfolge stabil, wenn beide Belege vorkommen', () => {
    const menge = [
      treffer(['deskriptoren'], { deskriptoren: 'cloud computing' }),
      treffer(['standort'], { standort: 'Fürth · Bayern' }),
    ];
    expect(autoSpalten('alles', menge)).toEqual(['standort', 'deskriptoren']);
  });

  it('blendet Netzwerk und Notiz ein, wenn dort getroffen wurde', () => {
    // Beide stehen in keiner anderen Zelle: der Netzwerkname nicht im Snippet
    // (das zeigt AST · Akronym · Geber), die Arbeitsnotiz überhaupt nur auf der
    // Detailseite des Antrags.
    const menge = [
      treffer(['netzwerk'], { netzwerk: '"LOHCmobil" 16KN065602_AM' }),
      treffer(['notiz'], { notiz: 'ZA nicht erinnern, da bereits Einbehalt bis VN' }),
    ];
    expect(autoSpalten('alles', menge)).toEqual(['netzwerk', 'notiz']);
  });

  it('blendet das Verbundkennzeichen ein, aber nicht das Aktenzeichen', () => {
    // Die Spalte „FKZ" zeigt das Teilvorhaben — der Verbund, zu dem es gehört,
    // steht in keiner Zelle. Wer `ZKN073232` tippt, bekäme sonst Zeilen ohne
    // ein einziges Zeichen seiner Anfrage.
    const menge = [treffer(['verbundkennzeichen'], { verbundkennzeichen: 'ZKN073232' })];
    expect(autoSpalten('alles', menge)).toEqual(['verbundkennzeichen']);
    // Das Aktenzeichen bleibt draußen — auch in der Schreibweise des
    // Fachsystems ist es dieselbe Nummer wie in der FKZ-Spalte.
    expect(autoSpalten('alles', [treffer(['aktenzeichen'])])).toEqual([]);
  });

  it('blendet keine leere Spalte ein — Fundstelle ohne Text zählt nicht', () => {
    // Reine Vektortreffer haben keinen Korpus-Eintrag. Eine Spalte voller
    // leerer Zellen erklärt nichts.
    expect(autoSpalten('alles', [treffer(['standort'])])).toEqual([]);
    expect(autoSpalten('alles', [treffer(['standort'], { standort: '' })])).toEqual([]);
  });

  it('kommt mit Treffern ohne Fundstellen-Angabe zurecht', () => {
    const ohne = treffer([]);
    delete ohne.trefferfelder;
    expect(autoSpalten('alles', [ohne])).toEqual([]);
    expect(autoSpalten('alles', [])).toEqual([]);
  });
});

describe('belegWerte — was die Trefferzeile ausschreibt', () => {
  it('liefert Wert und Feld des Belegs', () => {
    const t = treffer(['titel', 'standort'], { standort: 'Cham · Bayern' });
    expect(belegWerte(t)).toEqual([{ feld: 'standort', wert: 'Cham · Bayern' }]);
  });

  it('schreibt nur aus, was auch Fundstelle war', () => {
    // Der Ort steht am Treffer, getroffen wurde aber der Titel: ihn trotzdem
    // anzuhängen wäre Rauschen in jeder Zeile.
    const t = treffer(['titel'], { standort: 'Cham · Bayern' });
    expect(belegWerte(t)).toEqual([]);
  });

  it('führt beide Belege in derselben Reihenfolge wie die Spalten', () => {
    const t = treffer(['deskriptoren', 'standort'], {
      standort: 'Fürth · Bayern',
      deskriptoren: 'cloud computing',
    });
    expect(belegWerte(t).map(b => b.feld)).toEqual(['standort', 'deskriptoren']);
  });

  it('bleibt bei einem Dokumenttreffer leer', () => {
    const dok: UnifiedSearchResult = {
      id: 'chunk-1', type: 'dokument', score: 0.4, method: 'fulltext',
      title: 'Anlage 5', snippet: '…', trefferfelder: ['dokument'],
    };
    expect(belegWerte(dok)).toEqual([]);
    expect(autoSpalten('alles', [dok])).toEqual([]);
  });
});
