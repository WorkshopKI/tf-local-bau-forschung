import { describe, it, expect } from 'vitest';
import type { QuellenBeleg } from '@/core/services/skills';
import {
  liveGueltigeIndizes, belegHatZuordnung, belegeFuerSatz, belegBetrifftSaetze, belegAbdeckung,
} from '../belege';

const b = (satzIndizes: number[], zitat = 'Z'): QuellenBeleg => ({ zitat, satzIndizes });

describe('belege — Zuordnung Beleg ↔ Satz (Journey-Paket 4)', () => {
  it('liveGueltigeIndizes filtert außerhalb liegende Indizes (Live-Degradation)', () => {
    expect(liveGueltigeIndizes(b([0, 2, 9]), 3)).toEqual([0, 2]); // 9 raus (Text nur 3 Sätze)
    expect(liveGueltigeIndizes(b([5]), 3)).toEqual([]);            // alles raus → ohne Zuordnung
  });

  it('belegHatZuordnung: false, wenn alle Indizes veraltet sind', () => {
    expect(belegHatZuordnung(b([1]), 5)).toBe(true);
    expect(belegHatZuordnung(b([7, 8]), 5)).toBe(false);
  });

  it('belegeFuerSatz: Belege, die einen Satz stützen (live-gültig)', () => {
    const belege = [b([0, 1], 'A'), b([2], 'B'), b([9], 'C')];
    expect(belegeFuerSatz(belege, 1, 3).map(x => x.zitat)).toEqual(['A']);
    expect(belegeFuerSatz(belege, 2, 3).map(x => x.zitat)).toEqual(['B']);
    // Satz 9 existiert nicht mehr → Beleg C zählt nicht
    expect(belegeFuerSatz(belege, 9, 3)).toEqual([]);
  });

  it('belegBetrifftSaetze: beidseitige Hover-Zuordnung (Karte ↔ Satz)', () => {
    const beleg = b([2, 4]);
    expect(belegBetrifftSaetze(beleg, [4], 5)).toBe(true);   // Satz 4 gehovert → Karte highlightet
    expect(belegBetrifftSaetze(beleg, [0, 1], 5)).toBe(false);
    expect(belegBetrifftSaetze(beleg, [], 5)).toBe(false);   // nichts gehovert
    expect(belegBetrifftSaetze(b([9]), [9], 5)).toBe(false); // veralteter Index zählt nicht
  });

  it('belegAbdeckung: distinkte Sätze mit ≥1 Beleg / Gesamt', () => {
    const belege = [b([0, 1]), b([1, 2]), b([9])]; // 9 veraltet
    expect(belegAbdeckung(belege, 5)).toEqual({ abgedeckt: 3, gesamt: 5 }); // {0,1,2}
  });

  it('Stale-Degradation: schrumpft der Text, sinkt die Abdeckung automatisch', () => {
    const belege = [b([0]), b([1]), b([2])];
    expect(belegAbdeckung(belege, 3)).toEqual({ abgedeckt: 3, gesamt: 3 });
    // Nutzer kürzt auf 2 Sätze → Beleg für Satz 2 fällt raus
    expect(belegAbdeckung(belege, 2)).toEqual({ abgedeckt: 2, gesamt: 2 });
  });
});
