/**
 * Der Stillstands-Wächter. Die wichtigste Zusage steht im ersten Block:
 * **ohne Zieltage gibt es kein „ok"**, sondern `unbewertet`. Eine Ampel, die
 * mangels Grundlage grün zeigt, ist schlimmer als gar keine — man glaubt ihr,
 * bis man es einmal nachrechnet, und danach nie wieder.
 */
import { describe, it, expect } from 'vitest';
import {
  pruefeStillstand, zieltageFuer, medianLiegezeit, KUERZEL_PAARE,
} from '@/core/status/waechter';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type {
  MappingVersion, StatusFeldEintrag, StatusWertEintrag,
} from '@/core/status/typen';

const STICHTAG = '2026-08-01T00:00:00.000Z';

function vorTagen(tage: number): string {
  const d = new Date(new Date(STICHTAG).getTime() - tage * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

const feld = (code: string, over: Partial<StatusFeldEintrag> = {}): StatusFeldEintrag => ({
  feldId: `D_${code}`,
  label: `Bezeichnung ${code}`,
  typ: 'datum',
  ebene: 'tv',
  code,
  prominenzDefault: 'normal',
  aktiv: true,
  unkuratiert: false,
  ...over,
});

const wert = (code: number, zieltage?: number): StatusWertEintrag => ({
  id: `status::w${code}`,
  feldId: 'status',
  wert: `wert-${code}`,
  kategorie: 'sonstige',
  spinePhase: 'keine',
  rang: 0,
  prominenz: 'normal',
  terminal: false,
  aktiv: true,
  unkuratiert: false,
  code,
  ...(zieltage !== undefined ? { zieltage } : {}),
});

const ALLE_CODES = ['AK4', 'AT4', 'ARK', 'ART', 'ABLK', 'ABLT', 'ALT', 'ALU', 'ANY'];

function fassung(over: Partial<MappingVersion> = {}): MappingVersion {
  return {
    version: 1,
    autor: null,
    zeitstempel: STICHTAG,
    kategorien: [],
    felder: [
      ...ALLE_CODES.map(c => feld(c)),
      feld('AT4x', { feldId: 'D_AT4', code: 'AT4', rollen: ['fb'] }),
    ].filter((f, i, a) => a.findIndex(x => x.feldId === f.feldId) === i),
    werte: [wert(35, 21), wert(88)],
    regeln: [],
    ...over,
  };
}

const vk = (code: string, tage: number): FeldVorkommen => ({
  feld: feld(code), wert: vorTagen(tage),
});

const lauf = (
  vorkommen: FeldVorkommen[], statusCode: number | null, over: Partial<MappingVersion> = {},
): ReturnType<typeof pruefeStillstand> =>
  pruefeStillstand({ version: fassung(over), vorkommen, statusCode, stichtag: STICHTAG });

describe('Ohne Grundlage kein Urteil', () => {
  it('ohne Zieltage lautet das Urteil „unbewertet", nicht „ok"', () => {
    const e = lauf([vk('ANY', 400)], 88);
    expect(e.urteil).toBe('unbewertet');
    expect(e.grund).toContain('keine Zieltage');
    expect(e.zieltage).toBeNull();
  });

  it('unbekannter Status sagt das ausdrücklich', () => {
    expect(lauf([vk('ANY', 5)], null).grund).toContain('nicht im Katalog');
  });

  it('ohne datierte Aktivität ist die Liegezeit nicht bestimmbar', () => {
    const e = lauf([], 35);
    expect(e.urteil).toBe('unbewertet');
    expect(e.grund).toContain('Keine datierte Aktivität');
    // Die Zieltage sind bekannt — nur der Bezugspunkt fehlt.
    expect(e.zieltage).toBe(21);
  });

  it('rechnet Textfelder nicht als Aktivität', () => {
    const text: FeldVorkommen = { feld: feld('ANY', { typ: 'text' }), wert: 'Notiz' };
    expect(lauf([text], 35).urteil).toBe('unbewertet');
  });
});

describe('Stufe 1 — generische Liegezeit', () => {
  it('innerhalb der Zieltage ist es „ok"', () => {
    const e = lauf([vk('ANY', 10)], 35);
    expect(e.urteil).toBe('ok');
    expect(e.tage).toBe(10);
  });

  it('an der Grenze noch „ok" — echtes „größer als"', () => {
    expect(lauf([vk('ANY', 21)], 35).urteil).toBe('ok');
    expect(lauf([vk('ANY', 22)], 35).urteil).toBe('haengt');
  });

  it('nimmt die JÜNGSTE Aktivität, nicht die erste', () => {
    const e = lauf([vk('ANY', 90), vk('AK4', 3)], 35);
    expect(e.tage).toBe(3);
    expect(e.urteil).toBe('ok');
  });

  it('nennt im Grund immer Ist und Ziel', () => {
    expect(lauf([vk('ANY', 40)], 35).grund).toContain('40 Tagen, Ziel 21');
  });

  it('betrachtet nur relevante Kürzel, sobald die Fassung welche markiert', () => {
    // Nur AK4 ist relevant; der junge Nebenvermerk zählt dann nicht mehr.
    const nurAk4 = fassung().felder.map(f => (f.code === 'AK4' ? { ...f, relevant: true } : f));
    const e = lauf([vk('ANY', 3), vk('AK4', 60)], 35, { felder: nurAk4 });
    expect(e.tage).toBe(60);
    expect(e.urteil).toBe('haengt');
  });
});

describe('Stufe 2 — halb offene Kürzel-Paare', () => {
  it('erkennt die gesetzte Seite und benennt die fehlende', () => {
    const e = lauf([vk('AT4', 30)], 35);
    expect(e.paar?.gesetzt).toBe('AT4');
    expect(e.paar?.fehlt).toBe('AK4');
    expect(e.paar?.tage).toBe(30);
    expect(e.grund).toContain('AK4');
  });

  it('meldet kein Paar, wenn beide Seiten gesetzt sind', () => {
    expect(lauf([vk('AK4', 30), vk('AT4', 20)], 35).paar).toBeNull();
  });

  it('meldet kein Paar, wenn der Katalog die Gegenseite nicht kennt', () => {
    // „Gegenseite leer" hieße hier nur „wir können sie nicht lesen".
    const ohneAk4 = fassung().felder.filter(f => f.code !== 'AK4');
    expect(lauf([vk('AT4', 30)], 35, { felder: ohneAk4 }).paar).toBeNull();
  });

  it('wählt das am längsten offene Paar', () => {
    const e = lauf([vk('AT4', 10), vk('ABLT', 90)], 35);
    expect(e.paar?.gesetzt).toBe('ABLT');
    expect(e.paar?.tage).toBe(90);
  });

  it('leitet die Rolle aus dem FEHLENDEN Kürzel ab', () => {
    const mitRolle = fassung().felder.map(f => (f.code === 'AK4' ? { ...f, rollen: ['ab' as const] } : f));
    expect(lauf([vk('AT4', 30)], 35, { felder: mitRolle }).rolle).toBe('ab');
  });

  it('fällt ohne Paar auf die Rolle des To-dos zurück', () => {
    const e = pruefeStillstand({
      version: fassung(), vorkommen: [vk('ANY', 40)], statusCode: 35, stichtag: STICHTAG,
      todo: {
        todo: 'SV in QS', regelId: 'r4', beschreibung: null,
        zustaendig: [], wartetAuf: 'qs', belege: [], gesperrtDurch: [], weitereTreffer: [],
      },
    });
    expect(e.rolle).toBe('qs');
  });

  it('die Paar-Tabelle nennt jede Seite ausdrücklich (keine Buchstaben-Heuristik)', () => {
    // ALT/ALU dreht die K/T-Konvention um — deshalb steht die Seite dran.
    const alt = KUERZEL_PAARE.find(p => p.adm === 'ALT');
    expect(alt?.fachl).toBe('ALU');
    expect(new Set(KUERZEL_PAARE.map(p => p.adm)).size).toBe(KUERZEL_PAARE.length);
  });
});

describe('zieltageFuer', () => {
  it('liest die Zieltage des Status-Codes', () => {
    expect(zieltageFuer(fassung(), 35)).toBe(21);
  });

  it('liefert null für Status ohne Zieltage und für unbekannte', () => {
    expect(zieltageFuer(fassung(), 88)).toBeNull();
    expect(zieltageFuer(fassung(), 99)).toBeNull();
    expect(zieltageFuer(fassung(), null)).toBeNull();
  });
});

describe('medianLiegezeit — Vorschlag aus der Ist-Verteilung', () => {
  it('rechnet den Median je Status und zählt die Proben', () => {
    const m = medianLiegezeit([
      { statusCode: 35, tage: 10 }, { statusCode: 35, tage: 20 }, { statusCode: 35, tage: 30 },
      { statusCode: 70, tage: 5 },
    ]);
    expect(m.get(35)).toEqual({ median: 20, p90: 30, n: 3 });
    expect(m.get(70)).toEqual({ median: 5, p90: 5, n: 1 });
  });

  it('mittelt bei gerader Anzahl', () => {
    expect(medianLiegezeit([
      { statusCode: 1, tage: 10 }, { statusCode: 1, tage: 21 },
    ]).get(1)?.median).toBe(16);
  });

  it('zeigt im p90 den langen Schwanz, den der Median verschweigt', () => {
    // Fünf schnelle, fünf zähe Vorgänge: der Median sagt 55, das p90 sagt 200.
    const tage = [10, 10, 10, 10, 10, 100, 120, 150, 180, 200];
    const v = medianLiegezeit(tage.map(t => ({ statusCode: 1, tage: t })))!.get(1)!;
    expect(v.median).toBe(55);
    expect(v.p90).toBe(180);
    expect(v.n).toBe(10);
  });

  it('nutzt den nächstgelegenen Rang — bei kleinem n ist p90 der letzte Wert', () => {
    // Kein Interpolieren: bei n = 3 gibt die Stichprobe keine Zwischenwerte her.
    expect(medianLiegezeit([
      { statusCode: 1, tage: 1 }, { statusCode: 1, tage: 2 }, { statusCode: 1, tage: 90 },
    ]).get(1)?.p90).toBe(90);
  });

  it('lässt Proben ohne Code oder ohne Liegezeit weg', () => {
    const m = medianLiegezeit([
      { statusCode: null, tage: 10 }, { statusCode: 1, tage: null }, { statusCode: 1, tage: 7 },
    ]);
    expect(m.get(1)).toEqual({ median: 7, p90: 7, n: 1 });
    expect(m.size).toBe(1);
  });
});
