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
 */
import { describe, it, expect } from 'vitest';
import type {
  MappingVersion, StatusFeldEintrag, StatusWertEintrag, VorkommenStand,
} from '@/core/status';
import { kuerzelZeilen, rollenSicht, sonderErklaerung, statuswertZeilen } from '../glossarZeilen';

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

describe('sonderErklaerung', () => {
  it('erklaert die vier Kuerzel, die nicht im Katalog stehen', () => {
    expect(sonderErklaerung('ID')).toContain('Rollenvergabe');
    expect(sonderErklaerung('TTV1')).toContain('Testkürzel');
  });

  it('schweigt bei einem gewoehnlichen Kuerzel', () => {
    expect(sonderErklaerung('ABB')).toBeNull();
  });
});
