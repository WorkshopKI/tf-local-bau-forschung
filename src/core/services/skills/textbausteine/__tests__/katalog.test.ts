/**
 * Textbaustein-Katalog: Normalisierung, Migration, Fassungen, Selektoren.
 *
 * Alles hier ist rein (kein Share, kein IDB) — die IO-Schicht ist ein dünner Mantel
 * um genau diese Funktionen und wird über den Migrations-/Normalisierungspfad
 * mitgeprüft.
 */
import { describe, it, expect } from 'vitest';
import { NF_BAUSTEINE, extractPlatzhalter } from '../../registry/nf-bausteine.seed';
import { MAX_HISTORIE } from '../../registry/versioning';
import { leererKatalog, mergeFehlendeNfBausteine, nfSeedAlsRecords } from '../migration';
import { normalizeBaustein, normalizeKatalog } from '../storage';
import { bearbeiteBaustein, rollbackBaustein, setzeBausteinStatus } from '../versionierung';
import { bewerteBausteine, freigegebeneBausteine, sucheBausteine } from '../suche';
import type { TextbausteinRecord } from '../types';

const KONTEXT = { zeitpunkt: '2026-08-01T10:00:00.000Z', userId: 'THÜ' };

/**
 * Baustein mit Baseline-Historie — genau so, wie ihn `normalizeBaustein` und die
 * Seed-Migration erzeugen (`historie[0]` ≙ Record). Ohne diesen Eintrag gäbe es
 * nichts, worauf ein Rollback zurückgehen könnte.
 */
function baustein(over: Partial<TextbausteinRecord> = {}): TextbausteinRecord {
  const text = over.text ?? 'Bitte erläutern Sie {das / die} Verfahren.';
  const basis: TextbausteinRecord = {
    id: 'X1',
    artefaktTyp: 'nf',
    scope: 'tv',
    thema: 'Thema',
    kategorie: 'Kategorie',
    aspekte: [],
    stichworte: [],
    text,
    platzhalter: extractPlatzhalter(text),
    status: 'freigegeben',
    version: 1,
    historie: [],
    geaendertAm: '2026-07-01T00:00:00.000Z',
    ...over,
  };
  if (basis.historie.length > 0) return basis;
  return {
    ...basis,
    historie: [{
      version: basis.version,
      thema: basis.thema,
      kategorie: basis.kategorie,
      text: basis.text,
      aspekte: [...basis.aspekte],
      stichworte: [...basis.stichworte],
      status: basis.status,
      geaendertAm: basis.geaendertAm,
    }],
  };
}

describe('NF-Seed-Migration', () => {
  it('übernimmt alle 78 Seed-Bausteine als freigegebene Version 1', () => {
    const records = nfSeedAlsRecords();
    expect(records).toHaveLength(NF_BAUSTEINE.length);
    expect(records.every(r => r.status === 'freigegeben' && r.version === 1)).toBe(true);
    expect(records.every(r => r.artefaktTyp === 'nf')).toBe(true);
    expect(records.every(r => r.historie.length === 1)).toBe(true);
  });

  it('übernimmt den Rechtstext WORTGETREU (Pitfall #34)', () => {
    const records = nfSeedAlsRecords();
    for (const seed of NF_BAUSTEINE) {
      const rec = records.find(r => r.id === seed.id)!;
      expect(rec.text).toBe(seed.text);
      expect(rec.thema).toBe(seed.thema);
      expect(rec.kategorie).toBe(seed.kategorie);
      expect(rec.scope).toBe(seed.scope);
    }
  });

  it('lässt die Aspekt-Tags leer — der Seed kennt keine', () => {
    expect(nfSeedAlsRecords().every(r => r.aspekte.length === 0)).toBe(true);
  });

  it('füllt einen leeren Katalog und ist beim zweiten Lauf ein No-op', () => {
    const erst = mergeFehlendeNfBausteine(leererKatalog());
    expect(erst.ergaenzt).toHaveLength(NF_BAUSTEINE.length);
    const zweit = mergeFehlendeNfBausteine(erst.katalog);
    expect(zweit.ergaenzt).toEqual([]);
    // Identische Referenz → der Aufrufer schreibt nicht unnötig auf den Share.
    expect(zweit.katalog).toBe(erst.katalog);
  });

  it('überschreibt kuratierte Fassungen NIE — auch nicht stillgelegte', () => {
    const kuratiert = baustein({ id: 'G1.1', text: 'Von Hand geändert.', version: 4, status: 'stillgelegt' });
    const { katalog, ergaenzt } = mergeFehlendeNfBausteine({
      version: 1, updated_at: 'x', bausteine: [kuratiert],
    });
    const g11 = katalog.bausteine.find(b => b.id === 'G1.1')!;
    expect(g11.text).toBe('Von Hand geändert.');
    expect(g11.status).toBe('stillgelegt');
    expect(g11.version).toBe(4);
    expect(ergaenzt).not.toContain('G1.1');
    expect(katalog.bausteine).toHaveLength(NF_BAUSTEINE.length);
  });
});

describe('Normalisierung (tolerant)', () => {
  it('leitet die Platzhalter IMMER aus dem Text ab, nie aus der Datei', () => {
    const rec = normalizeBaustein({
      id: 'A1', text: 'Nennen Sie … und {a / b}.', platzhalter: [{ roh: 'GELOGEN', typ: 'fill' }],
    })!;
    expect(rec.platzhalter).toEqual(extractPlatzhalter('Nennen Sie … und {a / b}.'));
    expect(rec.platzhalter.some(p => p.roh === 'GELOGEN')).toBe(false);
  });

  it('verwirft Einträge ohne id oder ohne Text', () => {
    expect(normalizeBaustein({ text: 'ohne id' })).toBeNull();
    expect(normalizeBaustein({ id: 'A1', text: '' })).toBeNull();
    expect(normalizeBaustein(null)).toBeNull();
  });

  it('defaultet einen unbekannten Status fail-safe auf entwurf', () => {
    expect(normalizeBaustein({ id: 'A1', text: 't', status: 'live' })!.status).toBe('entwurf');
    expect(normalizeBaustein({ id: 'A1', text: 't' })!.status).toBe('entwurf');
    expect(normalizeBaustein({ id: 'A1', text: 't', status: 'freigegeben' })!.status).toBe('freigegeben');
  });

  it('setzt scope nur bei gültigem Wert', () => {
    expect(normalizeBaustein({ id: 'A1', text: 't', scope: 'quatsch' })!.scope).toBeUndefined();
    expect(normalizeBaustein({ id: 'A1', text: 't', scope: 'verbund' })!.scope).toBe('verbund');
  });

  it('erzeugt einen Baseline-Historieneintrag, wenn die Historie fehlt', () => {
    const rec = normalizeBaustein({ id: 'A1', text: 't', version: 3 })!;
    expect(rec.historie).toHaveLength(1);
    expect(rec.historie[0]!.version).toBe(3);
  });

  it('lehnt fremde Datei-Strukturen ab, überspringt aber kaputte Einträge', () => {
    expect(normalizeKatalog({ version: 2, bausteine: [] })).toBeNull();
    expect(normalizeKatalog({ version: 1 })).toBeNull();
    const k = normalizeKatalog({ version: 1, bausteine: [null, { id: 'A1', text: 't' }, 42] })!;
    expect(k.bausteine).toHaveLength(1);
  });
});

describe('Fassungen', () => {
  it('erzeugt bei Bearbeitung neue Version + Snapshot und zieht die Platzhalter nach', () => {
    const neu = bearbeiteBaustein(baustein(), { text: 'Neuer Text ohne Platzhalter.' }, KONTEXT);
    expect(neu.version).toBe(2);
    expect(neu.platzhalter).toEqual([]);
    expect(neu.historie[0]!.version).toBe(2);
    expect(neu.historie[0]!.text).toBe('Neuer Text ohne Platzhalter.');
    expect(neu.geaendertVon).toBe('THÜ');
  });

  it('ist bei inhaltsgleicher Bearbeitung ein No-op (keine Leerlauf-Fassung)', () => {
    const rec = baustein();
    expect(bearbeiteBaustein(rec, { thema: rec.thema, text: rec.text }, KONTEXT)).toBe(rec);
  });

  it('hält die Invariante historie[0] ≙ Record über mehrere Fassungen', () => {
    let rec = baustein();
    for (let i = 0; i < 3; i++) rec = bearbeiteBaustein(rec, { text: `Fassung ${i}` }, KONTEXT);
    expect(rec.historie[0]!.version).toBe(rec.version);
    expect(rec.historie[0]!.text).toBe(rec.text);
  });

  it('kappt die Historie auf MAX_HISTORIE', () => {
    let rec = baustein();
    for (let i = 0; i < MAX_HISTORIE + 5; i++) rec = bearbeiteBaustein(rec, { text: `T${i}` }, KONTEXT);
    expect(rec.historie).toHaveLength(MAX_HISTORIE);
  });

  it('macht aus Freigabe/Stilllegung eine eigene, begründete Fassung', () => {
    const entwurf = baustein({ status: 'entwurf' });
    const frei = setzeBausteinStatus(entwurf, 'freigegeben', { ...KONTEXT, begruendung: 'Geprüft' });
    expect(frei.status).toBe('freigegeben');
    expect(frei.version).toBe(2);
    expect(frei.historie[0]!.begruendung).toBe('Geprüft');
    // Kein Wechsel → kein Eintrag.
    expect(setzeBausteinStatus(frei, 'freigegeben', KONTEXT)).toBe(frei);
  });

  it('rollt auf eine Fassung zurück, ohne die Historie zu beschneiden', () => {
    const v1 = baustein({ text: 'Original.' });
    const v2 = bearbeiteBaustein(v1, { text: 'Verschlimmbessert.' }, KONTEXT);
    const v3 = rollbackBaustein(v2, 1, KONTEXT);
    expect(v3.version).toBe(3);
    expect(v3.text).toBe('Original.');
    expect(v3.historie.map(h => h.version)).toEqual([3, 2, 1]);
  });

  it('rollt den Status NICHT mit zurück — Freigabe gilt dem heutigen Stand', () => {
    const v1 = baustein({ status: 'freigegeben' });
    const v2 = bearbeiteBaustein(v1, { text: 'Neu.' }, KONTEXT);
    const stillgelegt = setzeBausteinStatus(v2, 'stillgelegt', KONTEXT);
    expect(rollbackBaustein(stillgelegt, 1, KONTEXT).status).toBe('stillgelegt');
  });

  it('ignoriert unbekannte Ziel-Fassungen', () => {
    const rec = baustein();
    expect(rollbackBaustein(rec, 99, KONTEXT)).toBe(rec);
    expect(rollbackBaustein(rec, rec.version, KONTEXT)).toBe(rec);
  });
});

describe('Selektoren + Suche', () => {
  const katalog: TextbausteinRecord[] = [
    baustein({ id: 'N1', thema: 'Schutzrechte', text: 'Bitte legen Sie Ihre Schutzrechte dar.', aspekte: ['E'] }),
    baustein({ id: 'N2', thema: 'Risiken', text: 'Bitte benennen Sie technische Risiken.', stichworte: ['gefahr'] }),
    baustein({ id: 'N3', thema: 'Entwurf-Baustein', text: 'Noch nicht geprüft.', status: 'entwurf' }),
    baustein({ id: 'N4', thema: 'Altlast', text: 'Nicht mehr verwenden.', status: 'stillgelegt' }),
    baustein({ id: 'N5', thema: 'Verbund-Sache', text: 'Gesamtvorhaben.', scope: 'verbund' }),
    baustein({ id: 'R1', thema: 'Rücknahme', text: 'Rücknahme empfohlen.', artefaktTyp: 'rne' }),
  ];

  it('gibt nur freigegebene Bausteine des Typs heraus', () => {
    const ids = freigegebeneBausteine(katalog, 'nf').map(b => b.id);
    expect(ids).toEqual(['N1', 'N2', 'N5']);
  });

  it('filtert zusätzlich nach Scope', () => {
    expect(freigegebeneBausteine(katalog, 'nf', 'tv').map(b => b.id)).toEqual(['N1', 'N2']);
    expect(freigegebeneBausteine(katalog, 'nf', 'verbund').map(b => b.id)).toEqual(['N5']);
    expect(freigegebeneBausteine(katalog, 'rne').map(b => b.id)).toEqual(['R1']);
  });

  it('schlägt Entwürfe und Stillgelegte nie vor', () => {
    const treffer = sucheBausteine(katalog, ['Entwurf-Baustein', 'Altlast'], 'nf');
    expect(treffer).toEqual([]);
  });

  it('gewichtet den Aspekt-Tag höher als einen Wortstamm-Treffer', () => {
    const treffer = sucheBausteine(katalog, ['Risiken'], 'nf', 'tv', { aspektId: 'E' });
    expect(treffer[0]!.baustein.id).toBe('N1'); // Aspekt E schlägt den Thema-Treffer von N2
    expect(treffer[0]!.treffer).toContain('Aspekt E');
  });

  it('findet über Stichworte, gewichtet sie aber unter dem Thema', () => {
    const treffer = bewerteBausteine(katalog, ['gefahr']);
    expect(treffer[0]!.baustein.id).toBe('N2');
    expect(treffer[0]!.punkte).toBe(2);
  });

  it('zählt je Suchwort nur den höchsten Fundort', () => {
    // „schutzrechte" steht in Thema UND Text von N1 → 3 Punkte, nicht 4.
    expect(bewerteBausteine(katalog, ['Schutzrechte'])[0]!.punkte).toBe(3);
  });

  it('liefert ohne Begriffe und ohne Aspekt gar nichts', () => {
    expect(bewerteBausteine(katalog, [])).toEqual([]);
    expect(bewerteBausteine(katalog, ['xyz-unbekannt'])).toEqual([]);
  });
});
