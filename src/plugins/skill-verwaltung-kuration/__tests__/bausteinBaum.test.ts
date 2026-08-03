/**
 * Der Katalog-Baum leitet Gruppen aus vorhandenen Feldern ab — er erfindet
 * keine. Festgenagelt sind hier die drei Zusagen, an denen fachlicher Schaden
 * entstünde:
 *
 *  - **Reihenfolge nach Id, nicht nach Alphabet.** `G1.2` steht vor `G1.10`,
 *    und „Gesamtvorhaben" (G…) vor „Entwicklung" (T1…).
 *  - **Verschieben ist Umsortieren, keine Umwidmung.** Bereich, Überkategorie
 *    und Scope-Ast (G↔T) sind gesperrt; erlaubt ist nur Thema→Thema innerhalb
 *    derselben Überkategorie.
 *  - **Ein Thema-Umbenennen trifft genau seine Gruppe** — nicht die
 *    gleichnamige in einem anderen Bereich.
 */
import { describe, it, expect } from 'vitest';
import {
  BAUSTEIN_BAUM_ROOT, OHNE_KATEGORIE, OHNE_THEMA, baueBausteinBaum, bausteinKnotenId,
  bausteineImThema, bereichKnotenId, darfVerschieben, gruppeVon, kategorieKnotenId, themaKnotenId,
} from '../bausteinBaum';
import type { BausteinArtefaktTyp, TextbausteinRecord } from '@/core/services/skills';

function b(
  id: string, kategorie: string, thema: string, artefaktTyp: BausteinArtefaktTyp = 'nf',
): TextbausteinRecord {
  return {
    id, artefaktTyp, thema, kategorie,
    aspekte: [], stichworte: [], text: `Text zu ${id}`, platzhalter: [],
    status: 'freigegeben', version: 1, historie: [], geaendertAm: '2026-01-01T00:00:00.000Z',
  };
}

const G1_1 = b('G1.1', 'Gesamtvorhaben', 'Zur geplanten Entwicklung');
const G1_2 = b('G1.2', 'Gesamtvorhaben', 'Zur geplanten Entwicklung');
const G1_10 = b('G1.10', 'Gesamtvorhaben', 'Zur geplanten Entwicklung');
const G2_1 = b('G2.1', 'Gesamtvorhaben', 'Zur Arbeitsteilung');
const T1_1_1 = b('T1.1.1', 'Entwicklung', 'Innovationsgehalt');
const T3_1_1 = b('T3.1.1', 'Kosten & Verwertung', 'Position a)');
const RNE_A1 = b('RNE-A1', 'Gesamtvorhaben', 'Zur geplanten Entwicklung', 'rne');

const BESTAND = [G1_10, G1_1, G1_2, G2_1, T1_1_1, T3_1_1, RNE_A1];

describe('baueBausteinBaum', () => {
  it('hängt Bereich → Überkategorie → Thema → Baustein ineinander', () => {
    const { items, rootId } = baueBausteinBaum(BESTAND);
    expect(rootId).toBe(BAUSTEIN_BAUM_ROOT);
    expect(items[BAUSTEIN_BAUM_ROOT]?.children).toEqual([bereichKnotenId('nf'), bereichKnotenId('rne')]);
    expect(items[bereichKnotenId('nf')]?.children).toEqual([
      kategorieKnotenId('nf', 'Gesamtvorhaben'),
      kategorieKnotenId('nf', 'Entwicklung'),
      kategorieKnotenId('nf', 'Kosten & Verwertung'),
    ]);
  });

  it('sortiert Bausteine numerisch: G1.2 vor G1.10', () => {
    const { items } = baueBausteinBaum(BESTAND);
    const thema = themaKnotenId('nf', 'Gesamtvorhaben', 'Zur geplanten Entwicklung');
    expect(items[thema]?.children).toEqual([
      bausteinKnotenId('G1.1'), bausteinKnotenId('G1.2'), bausteinKnotenId('G1.10'),
    ]);
  });

  it('ordnet Gruppen nach ihrer kleinsten Id, nicht nach Alphabet', () => {
    const { items } = baueBausteinBaum(BESTAND);
    // „Entwicklung" (T1…) käme alphabetisch vor „Gesamtvorhaben" (G…) — hier nicht.
    const kats = items[bereichKnotenId('nf')]?.children ?? [];
    expect(kats.indexOf(kategorieKnotenId('nf', 'Gesamtvorhaben')))
      .toBeLessThan(kats.indexOf(kategorieKnotenId('nf', 'Entwicklung')));
  });

  it('zählt je Gruppenknoten die Bausteine darunter', () => {
    const { items } = baueBausteinBaum(BESTAND);
    const bereich = items[bereichKnotenId('nf')]?.data;
    const thema = items[themaKnotenId('nf', 'Gesamtvorhaben', 'Zur geplanten Entwicklung')]?.data;
    expect(bereich?.art === 'bereich' && bereich.anzahl).toBe(6);
    expect(thema?.art === 'thema' && thema.anzahl).toBe(3);
  });

  it('markiert Gruppen als Ordner und Bausteine als Blätter', () => {
    const { items } = baueBausteinBaum(BESTAND);
    expect(items[kategorieKnotenId('nf', 'Gesamtvorhaben')]?.isFolder).toBe(true);
    expect(items[bausteinKnotenId('G1.1')]?.isFolder).toBe(false);
  });

  it('fängt leere Felder mit sprechenden Gruppen ab statt mit einer leeren Zeile', () => {
    const leer = b('X1', '', '');
    const g = gruppeVon(leer);
    expect(g).toEqual({ typ: 'nf', kategorie: OHNE_KATEGORIE, thema: OHNE_THEMA });
    const { items } = baueBausteinBaum([leer]);
    expect(items[kategorieKnotenId('nf', OHNE_KATEGORIE)]?.name).toBe(OHNE_KATEGORIE);
  });

  it('liefert bei leerer Liste nur die Wurzel', () => {
    const { items } = baueBausteinBaum([]);
    expect(items[BAUSTEIN_BAUM_ROOT]?.children).toEqual([]);
    expect(Object.keys(items)).toEqual([BAUSTEIN_BAUM_ROOT]);
  });
});

describe('darfVerschieben — die canDrop-Matrix', () => {
  const ziel = (r: TextbausteinRecord) => gruppeVon(r);

  it('erlaubt Thema → Thema innerhalb derselben Überkategorie', () => {
    expect(darfVerschieben(G1_1, ziel(G2_1), BESTAND)).toBe(true);
  });

  it('sperrt den Zug in dasselbe Thema — das wäre kein Zug', () => {
    expect(darfVerschieben(G1_1, ziel(G1_2), BESTAND)).toBe(false);
  });

  it('sperrt Überkategorie ↔ Überkategorie (Id-Stamm und Beschriftung liefen auseinander)', () => {
    expect(darfVerschieben(T1_1_1, ziel(T3_1_1), BESTAND)).toBe(false);
  });

  it('sperrt G ↔ T — das wäre eine fachliche Scope-Änderung', () => {
    expect(darfVerschieben(G1_1, ziel(T1_1_1), BESTAND)).toBe(false);
    expect(darfVerschieben(T1_1_1, ziel(G1_1), BESTAND)).toBe(false);
  });

  it('sperrt Bereich ↔ Bereich, auch bei identischer Überkategorie und identischem Thema', () => {
    expect(darfVerschieben(RNE_A1, ziel(G2_1), BESTAND)).toBe(false);
    expect(darfVerschieben(G1_1, gruppeVon(RNE_A1), BESTAND)).toBe(false);
  });

  it('sperrt den G→T-Zug auch dann, wenn jemand die Überkategorie von Hand angeglichen hat', () => {
    // Kuratierter Sonderfall: ein T-Baustein trägt „Gesamtvorhaben". Die
    // Überkategorie-Regel greift dann nicht mehr — die Scope-Regel schon.
    const verirrt = b('T9.9.9', 'Gesamtvorhaben', 'Verirrt');
    const bestand = [...BESTAND, verirrt];
    expect(darfVerschieben(G1_1, gruppeVon(verirrt), bestand)).toBe(false);
  });
});

describe('bausteineImThema — wen ein Thema-Umbenennen trifft', () => {
  it('liefert genau die Gruppe, in Id-Reihenfolge', () => {
    const treffer = bausteineImThema(BESTAND, gruppeVon(G1_1));
    expect(treffer.map(x => x.id)).toEqual(['G1.1', 'G1.2', 'G1.10']);
  });

  it('greift NICHT auf das gleichnamige Thema eines anderen Bereichs über', () => {
    // RNE-A1 trägt dasselbe Thema und dieselbe Überkategorie wie G1.1.
    expect(bausteineImThema(BESTAND, gruppeVon(G1_1)).map(x => x.id)).not.toContain('RNE-A1');
    expect(bausteineImThema(BESTAND, gruppeVon(RNE_A1)).map(x => x.id)).toEqual(['RNE-A1']);
  });

  it('liefert leer für eine Gruppe, die es nicht gibt', () => {
    expect(bausteineImThema(BESTAND, { typ: 'abl', kategorie: 'X', thema: 'Y' })).toEqual([]);
  });
});
