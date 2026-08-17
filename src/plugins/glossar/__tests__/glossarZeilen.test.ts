/**
 * Was diese Datei festnagelt:
 *
 * 1. Ein Statuscode steht EINMAL im Glossar, obwohl die Fassung ihn zweimal führt
 *    (TV-Feld und Verbund-Feld) — die Frage „was heißt 34" gilt dem Code.
 * 2. Die Arbeitsliste wird ABGELEITET, nicht aus dem Wert-Eintrag geglaubt
 *    (Pitfall #45) — eine alte Fassung schleppt ihre eigene sonst mit.
 * 3. Fehlende Zieltage bleiben `null` („nicht prüfbar"), werden nie zu 0.
 * 4. Neutrale Kürzel bleiben aus der Rollensicht heraus und stehen getrennt —
 *    leere Rollen heißen „jeder darf", nie „niemand" (Pitfall #43).
 * 5. Ein KÜRZEL steht ebenfalls einmal da, auch wenn die Fassung es doppelt
 *    führt (Pitfall #44) — gezeigt wird die wertführende Zeile, die andere wird
 *    als Fehlstand benannt statt verschwiegen.
 */
import { describe, it, expect } from 'vitest';
import type {
  Bedingung, MappingVersion, StatusFeldEintrag, StatusWertEintrag, TodoRegel, VorkommenStand,
} from '@/core/status';
import {
  kuerzelZeilen, regelZeilen, regelnZuKuerzel, rollenSicht, sonderErklaerung, statuswertZeilen,
} from '../glossarZeilen';

const wert = (o: Partial<StatusWertEintrag> & { feldId: string; wert: string }): StatusWertEintrag => ({
  id: `${o.feldId}::${o.wert}`, kategorie: 'sonstige', prominenz: 'normal',
  aktiv: true, unkuratiert: false, ...o,
});

const feld = (o: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag => ({
  label: o.feldId, typ: 'datum', ebene: 'tv',
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false, ...o,
});

const fassung = (o: Partial<MappingVersion>): MappingVersion => ({
  version: 1, autor: null, zeitstempel: '2026-01-01T00:00:00.000Z',
  felder: [], werte: [], ...o,
});

const stand = (o: Partial<VorkommenStand>): VorkommenStand => ({
  proCode: new Map(), proKuerzel: new Map(), gesamt: 0, importiertAm: null, ...o,
});

describe('statuswertZeilen', () => {
  it('fuehrt einen Code EINMAL, obwohl er unter TV und Verbund steht', () => {
    const v = fassung({
      werte: [
        wert({ feldId: 'status', wert: 'bewilligt', code: 59 }),
        wert({ feldId: 'verbund_status', wert: 'bewilligt', code: 59 }),
      ],
    });
    const z = statuswertZeilen(v, null);
    expect(z).toHaveLength(1);
    expect(z[0]?.code).toBe(59);
  });

  it('uebergeht Werte ohne amtlichen Code', () => {
    const v = fassung({ werte: [wert({ feldId: 'status', wert: 'Fantasiestatus' })] });
    expect(statuswertZeilen(v, null)).toEqual([]);
  });

  it('leitet die Arbeitsliste ab, statt sie dem Wert-Eintrag zu glauben', () => {
    // Der Eintrag behauptet „sonstige" — abgeleitet wird trotzdem aus Code+Phase.
    const v = fassung({
      werte: [wert({ feldId: 'status', wert: 'bewilligt', code: 59, kategorie: 'sonstige' })],
    });
    expect(statuswertZeilen(v, null)[0]?.kategorie).toBe('bewilligt');
  });

  it('haelt fehlende Zieltage auf null — nicht auf 0', () => {
    const v = fassung({ werte: [wert({ feldId: 'status', wert: 'beantragt', code: 31 })] });
    expect(statuswertZeilen(v, null)[0]?.zieltage).toBeNull();
  });

  it('nimmt gepflegte Zieltage aus der Fassung', () => {
    const v = fassung({
      werte: [wert({ feldId: 'status', wert: 'beantragt', code: 31, zieltage: 42 })],
    });
    expect(statuswertZeilen(v, null)[0]?.zieltage).toBe(42);
  });

  it('behandelt zahPhaseId null als Marker, nicht als „unbekannt"', () => {
    const v = fassung({
      werte: [wert({ feldId: 'status', wert: 'Irrläufer', code: 29, zahPhaseId: null })],
    });
    expect(statuswertZeilen(v, null)[0]?.phaseId).toBeNull();
  });

  it('reicht die Vorkommen durch; ohne Zaehlung bleibt null', () => {
    const v = fassung({ werte: [wert({ feldId: 'status', wert: 'bewilligt', code: 59 })] });
    expect(statuswertZeilen(v, null)[0]?.vorkommen).toBeNull();
    expect(statuswertZeilen(v, stand({ proCode: new Map([[59, 7]]) }))[0]?.vorkommen).toBe(7);
  });
});

describe('kuerzelZeilen', () => {
  const v = fassung({
    felder: [
      feld({ feldId: 'status', label: 'Status' }),                       // ohne Kürzel
      feld({ feldId: 'D_ABB', code: 'ABB', label: 'Bewilligung', rollen: ['ab'] }),
      feld({ feldId: 'D_XPC', code: 'XPC', label: 'Verbund-PreCheck' }), // neutral
    ],
  });

  it('nimmt nur Felder MIT Kuerzel auf', () => {
    expect(kuerzelZeilen(v, null).map(z => z.code)).toEqual(['ABB', 'XPC']);
  });

  it('liest leere Rollen als „alle", nicht als „niemand"', () => {
    const xpc = kuerzelZeilen(v, null).find(z => z.code === 'XPC');
    expect(xpc?.neutral).toBe(true);
    expect(xpc?.rollenText).toBe('alle');
  });

  it('nennt die Spalte des Exports', () => {
    expect(kuerzelZeilen(v, null).find(z => z.code === 'ABB')?.csvSpalte).toBe('D_ABB');
  });

  it('folgt quelleKey, wenn die Spalte anders heisst als die Feld-Id', () => {
    const mitQuelle = fassung({
      felder: [feld({ feldId: 'ABB', code: 'ABB', quelleKey: 'bewilligung_datum' })],
    });
    expect(kuerzelZeilen(mitQuelle, null)[0]?.csvSpalte).toBe('bewilligung_datum');
  });

  it('meldet im Normalfall nichts Verdraengtes', () => {
    expect(kuerzelZeilen(v, null).every(z => z.verdraengt.length === 0)).toBe(true);
  });

  // Am echten Bestand (Fassung 22, August 2026) traf das genau EINEN Code: `VBE`
  // stand als kanonisches `vn_eingang_datum` UND als `D_VBE`. Zwei Eintraege
  // gaben zwei Antworten auf eine Frage — und der Liste zweimal dieselbe Id.
  it('zeigt einen doppelt gefuehrten Code EINMAL, mit der wertfuehrenden Zeile', () => {
    const doppelt = fassung({
      felder: [
        feld({ feldId: 'D_VBE', code: 'VBE', label: 'Eingang VN-Sach' }),
        feld({ feldId: 'vn_eingang_datum', code: 'VBE', label: 'VN-Eingang (Begleitphase)' }),
      ],
    });
    const zeilen = kuerzelZeilen(doppelt, null);
    expect(zeilen).toHaveLength(1);
    // Das kanonische Feld traegt den Wert — es gewinnt, egal in welcher
    // Reihenfolge die Fassung die beiden Zeilen fuehrt.
    expect(zeilen[0]?.csvSpalte).toBe('vn_eingang_datum');
    expect(zeilen[0]?.label).toBe('VN-Eingang (Begleitphase)');
    expect(zeilen[0]?.verdraengt).toEqual(['D_VBE']);
  });

  it('gewinnt auch, wenn das kanonische Feld ZUERST steht', () => {
    const doppelt = fassung({
      felder: [
        feld({ feldId: 'vn_eingang_datum', code: 'VBE', label: 'VN-Eingang (Begleitphase)' }),
        feld({ feldId: 'D_VBE', code: 'VBE', label: 'Eingang VN-Sach' }),
      ],
    });
    const zeilen = kuerzelZeilen(doppelt, null);
    expect(zeilen[0]?.csvSpalte).toBe('vn_eingang_datum');
    expect(zeilen[0]?.verdraengt).toEqual(['D_VBE']);
  });

  // Ohne kanonische Zeile ist keine der beiden besser — dann traegt der Hinweis
  // die Auskunft, nicht die Auswahl.
  it('faellt bei einer Dublette OHNE kanonische Zeile auf die erste zurueck', () => {
    const doppelt = fassung({
      felder: [
        feld({ feldId: 'D_ZZ9', code: 'ZZ9', label: 'zuerst' }),
        feld({ feldId: 'T_ZZ9', code: 'ZZ9', label: 'danach' }),
      ],
    });
    const zeilen = kuerzelZeilen(doppelt, null);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.label).toBe('zuerst');
    expect(zeilen[0]?.verdraengt).toEqual(['T_ZZ9']);
  });

  it('vergibt je Code genau eine Glossar-Id (der doppelte React-Key)', () => {
    const doppelt = fassung({
      felder: [
        feld({ feldId: 'D_VBE', code: 'VBE' }),
        feld({ feldId: 'vn_eingang_datum', code: 'VBE' }),
        feld({ feldId: 'D_ABB', code: 'ABB' }),
      ],
    });
    const ids = kuerzelZeilen(doppelt, null).map(z => `kuerzel:${z.code}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('rollenSicht', () => {
  const zeilen = kuerzelZeilen(fassung({
    felder: [
      feld({ feldId: 'D_A', code: 'A', rollen: ['ab'] }),
      feld({ feldId: 'D_B', code: 'B', rollen: ['fb'] }),
      feld({ feldId: 'D_C', code: 'C' }),                    // neutral
      feld({ feldId: 'D_D', code: 'D', rollen: ['ab', 'fb'] }),
    ],
  }), stand({ proKuerzel: new Map([['A', 5], ['B', 1], ['C', 9], ['D', 20]]) }));

  it('trennt neutrale Kuerzel von denen der Rolle', () => {
    const { eigene, neutrale } = rollenSicht(zeilen, 'ab');
    expect(eigene.map(z => z.code)).toEqual(['D', 'A']);
    expect(neutrale.map(z => z.code)).toEqual(['C']);
  });

  it('sortiert absteigend nach Vorkommen', () => {
    expect(rollenSicht(zeilen, 'alle').eigene.map(z => z.code)).toEqual(['D', 'A', 'B']);
  });

  it('zeigt unter „alle" die neutralen weiterhin getrennt', () => {
    // Sie unter eine Rolle zu mischen behauptete eine Zustaendigkeit, die es
    // nicht gibt — auch dann nicht, wenn gar keine Rolle gewaehlt ist.
    const { eigene, neutrale } = rollenSicht(zeilen, 'alle');
    expect(eigene.map(z => z.code)).not.toContain('C');
    expect(neutrale.map(z => z.code)).toEqual(['C']);
  });

  it('sortiert ungezaehlte Kuerzel ans Ende statt an den Anfang', () => {
    const ohne = kuerzelZeilen(fassung({
      felder: [feld({ feldId: 'D_A', code: 'A', rollen: ['ab'] }),
        feld({ feldId: 'D_B', code: 'B', rollen: ['ab'] })],
    }), stand({ proKuerzel: new Map([['B', 3]]) }));
    expect(rollenSicht(ohne, 'ab').eigene.map(z => z.code)).toEqual(['B', 'A']);
  });
});

describe('regelnZuKuerzel (Rückwärts-Index Kürzel → Regel)', () => {
  const regel = (id: string, bedingung: Bedingung): TodoRegel => ({
    id, reihenfolge: 10, beschreibung: `Regel ${id}`, bedingung,
    todo: `tu ${id}`, zustaendig: ['ab'], aktiv: true,
  });

  const v = fassung({
    felder: [
      feld({ feldId: 'bewilligung_datum', code: 'ABB', label: 'Bewilligung' }),
      feld({ feldId: 'D_ALS', code: 'ALS', label: 'ohne weitere Nachforderungen' }),
    ],
    todoRegeln: [
      // ABB haengt an einem KANONISCHEN Feld — `D_ABB` gaebe es nie.
      regel('r-kanonisch', { feldId: 'bewilligung_datum', op: 'gefuellt' }),
      regel('r-praefix', { feldId: 'D_ALS', op: 'gefuellt' }),
      regel('r-verschachtelt', {
        alle: [
          { feldId: 'D_ALS', op: 'leer' },
          { einige: [{ feldId: 'bewilligung_datum', op: 'gefuellt' }] },
        ],
      }),
      regel('r-fremd', { feldId: 'D_XYZ', op: 'gefuellt' }),
    ],
  });
  const zeilen = regelZeilen(v);

  it('findet ein Kuerzel, das an einem kanonischen Feld haengt (Pitfall #44)', () => {
    // Wer stattdessen auf `D_ABB` suchte, bekaeme „0 Regeln" — und merkte nichts
    // davon, weil eine leere Liste wie eine Antwort aussieht.
    expect(regelnZuKuerzel(zeilen, 'ABB').map(z => z.regel.id))
      .toEqual(['r-kanonisch', 'r-verschachtelt']);
  });

  it('findet ein Kuerzel mit gewoehnlichem Spalten-Praefix', () => {
    expect(regelnZuKuerzel(zeilen, 'ALS').map(z => z.regel.id))
      .toEqual(['r-praefix', 'r-verschachtelt']);
  });

  it('steigt in UND/ODER-Gruppen hinab', () => {
    expect(regelnZuKuerzel(zeilen, 'ABB').map(z => z.regel.id)).toContain('r-verschachtelt');
  });

  it('liefert eine leere Liste, wo keine Regel prueft', () => {
    expect(regelnZuKuerzel(zeilen, 'AAE')).toEqual([]);
  });
});

describe('regelZeilen', () => {
  it('formuliert die Bedingung ueber den EINEN Formatierer', () => {
    const v = fassung({
      felder: [feld({ feldId: 'D_ABB', code: 'ABB', label: 'Bewilligung' })],
      todoRegeln: [{
        id: 'r1', reihenfolge: 10, beschreibung: 'R1', aktiv: true,
        bedingung: { feldId: 'D_ABB', op: 'gefuellt' }, todo: 'tu was', zustaendig: [],
      }],
    });
    // Das kuratierte Label, nicht die Feld-Id — sonst laese der Nutzer `D_ABB`.
    expect(regelZeilen(v)[0]?.satz).toContain('Bewilligung');
  });

  it('liest den fehlenden Regelsatz als AB, nicht als „keiner"', () => {
    const v = fassung({
      todoRegeln: [{
        id: 'r1', reihenfolge: 10, beschreibung: 'R1', aktiv: true,
        bedingung: { feldId: 'x', op: 'gefuellt' }, todo: '', zustaendig: [],
      }],
    });
    expect(regelZeilen(v)[0]?.regelsatz).toBe('ab');
  });

  it('erkennt eine Sperre an ihrem sperrt-Eintrag', () => {
    const v = fassung({
      todoRegeln: [{
        id: 's0', reihenfolge: 1, beschreibung: 'S0', aktiv: true,
        bedingung: { feldId: 'x', op: 'gefuellt' }, todo: '', zustaendig: [], sperrt: ['*'],
      }],
    });
    expect(regelZeilen(v)[0]?.sperre).toBe(true);
  });

  it('liefert nichts, wenn die Fassung keine Kaskade fuehrt', () => {
    expect(regelZeilen(fassung({}))).toEqual([]);
  });
});

describe('sonderErklaerung', () => {
  it('erklaert die vier Kuerzel, die nicht im Katalog stehen', () => {
    expect(sonderErklaerung('ID')).toContain('Rollenvergabe');
    expect(sonderErklaerung('TTV1')).toContain('Testkürzel');
  });

  it('schweigt bei einem gewoehnlichen Kuerzel', () => {
    expect(sonderErklaerung('ABB')).toBeNull();
  });
});
