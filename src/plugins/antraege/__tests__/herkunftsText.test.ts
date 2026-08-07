/**
 * **Kurz sichtbar, lang auf Abruf** — und beides sagt dasselbe.
 *
 * Der Vorbehalt zu den `D_`-Spalten ist der Grund, warum die Bahn eine
 * Rekonstruktion ist und kein Protokoll; er gehört unter jede Verlaufs-Anzeige
 * (Abschnitt 12.2). Ihn hinter ein Info-Zeichen zu räumen ist nur zulässig,
 * solange er dort **vollständig** steht — das prüft diese Datei.
 */
import { describe, it, expect } from 'vitest';
import { herkunftsTexte } from '@/plugins/antraege/verlauf-band/herkunftsText';

const BASIS = { bezugsZeitpunkt: '2026-08-07', fassung: 'Fassung 19' };

describe('herkunftsTexte', () => {
  it('nennt in der Kurzzeile Herkunft und Belegstand', () => {
    const t = herkunftsTexte({ ...BASIS, journalAb: '2026-08-05', journalGenutzt: true });
    expect(t.kurz).toBe('Rekonstruiert aus den Datumsspalten · belegt ab 05.08.2026');
  });

  it('unterscheidet die drei Journal-Lagen — auch in der Kurzzeile', () => {
    const ohne = herkunftsTexte({ ...BASIS, journalAb: null, journalGenutzt: false });
    const ungenutzt = herkunftsTexte({ ...BASIS, journalAb: '2026-08-05', journalGenutzt: false });
    const genutzt = herkunftsTexte({ ...BASIS, journalAb: '2026-08-05', journalGenutzt: true });
    const kurz = [ohne.kurz, ungenutzt.kurz, genutzt.kurz];
    expect(new Set(kurz).size).toBe(3);
    expect(ohne.kurz).toContain('kein Journal');
    expect(ungenutzt.kurz).toContain('nicht herangezogen');
  });

  it('trägt den D_-Vorbehalt IMMER in der langen Auskunft', () => {
    for (const journalAb of [null, '2026-08-05']) {
      for (const journalGenutzt of [true, false]) {
        const t = herkunftsTexte({ ...BASIS, journalAb, journalGenutzt });
        expect(t.lang.join(' ')).toContain('D_-Spalten');
        expect(t.lang.join(' ')).toContain('zuletzt gesetzte');
      }
    }
  });

  it('begründet in der langen Fassung, was die Kurzzeile nur behauptet', () => {
    const t = herkunftsTexte({ ...BASIS, journalAb: '2026-08-05', journalGenutzt: false });
    expect(t.lang.join(' ')).toContain('je Teilvorhaben');
  });

  it('nennt Achsenende und Katalogfassung — und lässt eine fehlende Fassung weg', () => {
    const letzte = (z: string[]): string => z[z.length - 1] ?? '';
    const mit = herkunftsTexte({ ...BASIS, journalAb: null, journalGenutzt: false });
    expect(letzte(mit.lang)).toBe('Achse bis 07.08.2026 · Katalogfassung Fassung 19');
    const ohne = herkunftsTexte({ ...BASIS, fassung: null, journalAb: null, journalGenutzt: false });
    expect(letzte(ohne.lang)).toBe('Achse bis 07.08.2026');
  });
});
