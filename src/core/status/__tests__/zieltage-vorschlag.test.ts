/**
 * Die Auswahlregeln der Zieltage-Sammelübernahme. Drei Zusagen:
 *
 * 1. **Nur Antragsphasen.** Bei „Begleitung"/„Abgeschlossen" ist „liegt zu
 *    lange" keine sinnvolle Frage, Marker laufen ohne Phase mit.
 * 2. **Nur mit Stichprobe.** Ein Median aus zwei Beobachtungen wird NICHT
 *    gesetzt, sondern als „zu wenig Daten" ausgewiesen — ehrlich statt geraten.
 * 3. **Nichts stillschweigend.** Ein gepflegter Wert steht mit alt → neu da.
 */
import { describe, it, expect } from 'vitest';
import { waehleZieltageVorschlaege, MIN_STICHPROBE } from '@/core/status/zieltage-vorschlag';
import { setzeZieltage } from '@/core/status/katalog-edit';
import type { MappingVersion, StatusWertEintrag, ZahPhaseId } from '@/core/status/typen';

const wert = (p: Partial<StatusWertEintrag> & { id: string; code: number }): StatusWertEintrag => ({
  feldId: 'status', wert: `Status ${p.code}`, kategorie: 'offen', prominenz: 'normal',
  aktiv: true, unkuratiert: false, ...p,
});

/** Code → Phase, wie sie die Fassung führen würde. */
const PHASEN: Record<number, ZahPhaseId> = {
  31: 'eingang', 35: 'vollstaendigkeit', 40: 'pruefung', 51: 'entscheidung',
  59: 'begleitung', 99: 'abgeschlossen',
};
const phaseVon = (w: StatusWertEintrag): ZahPhaseId | null => PHASEN[w.code!] ?? null;

const WERTE: StatusWertEintrag[] = [
  wert({ id: 'w31', code: 31 }),
  wert({ id: 'w35', code: 35, zieltage: 21 }),
  wert({ id: 'w40', code: 40 }),
  wert({ id: 'w51', code: 51 }),
  wert({ id: 'w59', code: 59 }),                 // Begleitung — außerhalb
  wert({ id: 'w99', code: 99 }),                 // Abgeschlossen — außerhalb
  wert({ id: 'w88', code: 88 }),                 // Marker, keine Phase
  wert({ id: 'wAus', code: 41, aktiv: false }),  // stillgelegt
];

const VORSCHLAEGE = new Map<number, { median: number; n: number }>([
  [31, { median: 14, n: 120 }],
  [35, { median: 21, n: 30 }],   // steht schon so da
  [40, { median: 27, n: 3 }],    // zu wenig Daten
  [51, { median: 9, n: 8 }],
  [59, { median: 400, n: 900 }],
  [99, { median: 800, n: 900 }],
  [88, { median: 5, n: 50 }],
  [41, { median: 3, n: 50 }],
]);

describe('waehleZieltageVorschlaege', () => {
  const auswahl = waehleZieltageVorschlaege(WERTE, VORSCHLAEGE, phaseVon);

  it('nimmt nur die Phasen Eingang bis Entscheidung', () => {
    expect(auswahl.uebernehmen.map(u => u.code)).toEqual([31, 51]);
  });

  it('lässt Begleitung, Abgeschlossen und Marker aus — auch mit großer Stichprobe', () => {
    for (const code of [59, 99, 88]) {
      expect(auswahl.uebernehmen.some(u => u.code === code), String(code)).toBe(false);
      expect(auswahl.zuWenigDaten.some(z => z.code === code), String(code)).toBe(false);
    }
  });

  it('setzt keinen Wert unter der Stichproben-Grenze, nennt ihn aber', () => {
    expect(auswahl.uebernehmen.some(u => u.code === 40)).toBe(false);
    expect(auswahl.zuWenigDaten).toEqual([{ code: 40, wert: 'Status 40', n: 3 }]);
    expect(MIN_STICHPROBE).toBe(5);
  });

  it('überspringt, was ohnehin schon so dasteht', () => {
    expect(auswahl.uebernehmen.some(u => u.code === 35)).toBe(false);
  });

  it('lässt stillgelegte Statuswerte aus', () => {
    expect(auswahl.uebernehmen.some(u => u.code === 41)).toBe(false);
  });

  it('führt alten und neuen Wert mit, damit nichts stillschweigend kippt', () => {
    const mitAlt = waehleZieltageVorschlaege(
      [wert({ id: 'x', code: 31, zieltage: 90 })], VORSCHLAEGE, phaseVon,
    );
    expect(mitAlt.uebernehmen[0]).toMatchObject({ alt: 90, neu: 14, n: 120 });
  });

  it('respektiert eine abweichende Untergrenze', () => {
    const streng = waehleZieltageVorschlaege(WERTE, VORSCHLAEGE, phaseVon, 100);
    expect(streng.uebernehmen.map(u => u.code)).toEqual([31]);
    // 35 rutscht mit: die Stichprobengröße ist eine Eigenschaft der DATEN, nicht
    // des gepflegten Werts — auch ein schon richtig gesetzter Status hat unter
    // dieser Grenze keine belastbare Grundlage.
    expect(streng.zuWenigDaten.map(z => z.code)).toEqual([35, 40, 51]);
  });
});

describe('setzeZieltage', () => {
  const version = { version: 1, autor: null, zeitstempel: 'x', felder: [], werte: WERTE } as MappingVersion;

  it('setzt alle genannten Werte in EINEM Durchlauf', () => {
    const nachher = setzeZieltage(version, new Map([['w31', 14], ['w51', 9]]));
    expect(nachher.werte.find(w => w.id === 'w31')?.zieltage).toBe(14);
    expect(nachher.werte.find(w => w.id === 'w51')?.zieltage).toBe(9);
  });

  it('rührt nicht an, was die Map nicht nennt', () => {
    const nachher = setzeZieltage(version, new Map([['w31', 14]]));
    expect(nachher.werte.find(w => w.id === 'w35')?.zieltage).toBe(21);
    expect(nachher.werte.find(w => w.id === 'w40')?.zieltage).toBeUndefined();
  });

  it('gibt bei leerer Map dieselbe Referenz zurück', () => {
    expect(setzeZieltage(version, new Map())).toBe(version);
  });
});
