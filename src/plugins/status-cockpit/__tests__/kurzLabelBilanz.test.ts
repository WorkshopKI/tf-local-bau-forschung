/**
 * Die Kurzlabel-Bilanz — die Rechnung hinter der Pflegeliste.
 *
 * Zwei Eigenschaften entscheiden, ob die Zahl daneben etwas taugt: die
 * Gruppierung nach CODE (derselbe Code steht unter beiden Wert-Feldern und
 * würde sonst doppelt gelistet) und der Nenner der Deckungsangabe.
 */
import { describe, it, expect } from 'vitest';
import { baueKurzLabelBilanz } from '@/plugins/status-cockpit/kurzLabelBilanz';
import { wertId } from '@/core/status';
import type { StatusWertEintrag } from '@/core/status';

const w = (
  feldId: string, wert: string, code: number, kurzLabel?: string,
): StatusWertEintrag => ({
  id: wertId(feldId, wert),
  feldId,
  wert,
  kategorie: 'sonstige',
  prominenz: 'normal',
  aktiv: true,
  unkuratiert: false,
  code,
  ...(kurzLabel !== undefined ? { kurzLabel } : {}),
});

/** Derselbe Code unter beiden Feldern — so sieht der Seed wirklich aus. */
const beideFelder = (wert: string, code: number, kurz?: string): StatusWertEintrag[] => [
  w('status', wert, code, kurz), w('verbund_status', wert, code, kurz),
];

const vk = (paare: [string, string, number][]): Map<string, number> =>
  new Map(paare.map(([f, v, n]) => [wertId(f, v), n]));

describe('baueKurzLabelBilanz', () => {
  it('gruppiert nach Code und SUMMIERT beide Wert-Felder', () => {
    const b = baueKurzLabelBilanz(
      beideFelder('Sonderstatus', 88),
      vk([['status', 'Sonderstatus', 20716], ['verbund_status', 'Sonderstatus', 0]]),
    );
    expect(b.zeilen).toHaveLength(1);
    expect(b.zeilen[0]).toMatchObject({ code: 88, vorkommen: 20716 });
  });

  it('sortiert absteigend nach Vorkommen — der Kurator fängt oben an', () => {
    const b = baueKurzLabelBilanz(
      [...beideFelder('abgebrochen', 90), ...beideFelder('Schlussvermerk', 99)],
      vk([['status', 'abgebrochen', 2], ['status', 'Schlussvermerk', 6814]]),
    );
    expect(b.zeilen.map(z => z.code)).toEqual([99, 90]);
  });

  it('kuratiert schlägt Auslieferung, und die Herkunft sagt welches', () => {
    const b = baueKurzLabelBilanz(beideFelder('Schlussvermerk', 99, 'SV'), new Map());
    expect(b.zeilen[0]).toMatchObject({ kurz: 'SV', herkunft: 'fassung', laenge: 2 });
  });

  it('ohne Kuration gilt die Auslieferung — das ist keine Lücke', () => {
    const b = baueKurzLabelBilanz(beideFelder('abgelehnt/zurückgezogen', 73), new Map());
    expect(b.zeilen[0]).toMatchObject({ kurz: 'abgel./zurückgez.', herkunft: 'katalog' });
    expect(b.ohneKurz.anzahl).toBe(0);
  });

  it('meldet eine zu lange Kurzform, statt sie zu kürzen', () => {
    const b = baueKurzLabelBilanz(
      beideFelder('Schlussvermerk', 99, 'Schlussvermerk lang'), new Map(),
    );
    expect(b.zeilen[0]!.zuLang).toBe(true);
    expect(b.zuLang).toBe(1);
    expect(b.zeilen[0]!.kurz).toBe('Schlussvermerk lang');   // unverändert
  });

  it('lässt Werte ohne amtlichen Code weg — dort gibt es nichts zu kuratieren', () => {
    const ohneCode: StatusWertEintrag = {
      id: wertId('verbund_status', 'VN gegrüft'),
      feldId: 'verbund_status',
      wert: 'VN gegrüft',
      kategorie: 'sonstige',
      prominenz: 'normal',
      aktiv: true,
      unkuratiert: true,
    };
    const b = baueKurzLabelBilanz([ohneCode, ...beideFelder('beendet', 91)], new Map());
    expect(b.zeilen.map(z => z.code)).toEqual([91]);
  });

  it('ein Code, den die Auslieferung nicht kennt, ist offen und zeigt den Rohwert', () => {
    // Der einzige Weg zu einer echten Lücke: die Kürzel-Zuarbeit bringt einen
    // neuen Code mit. Die 30 ausgelieferten tragen alle eine Kurzform
    // (status-codes.test.ts haelt das fest).
    const b = baueKurzLabelBilanz(beideFelder('Rückfrage offen', 42), new Map());
    expect(b.zeilen[0]).toMatchObject({
      code: 42, voll: 'Rückfrage offen', kurz: '', herkunft: 'ohne', laenge: 0,
    });
    expect(b.ohneKurz.anzahl).toBe(1);
  });

  it('die Deckung misst die OFFENEN Zeilen, nicht den ganzen Bestand', () => {
    // Sonst stiege der Prozentwert beim Kuratieren und läse sich wie
    // Fortschritt, obwohl nur der Nenner schrumpft.
    const b = baueKurzLabelBilanz(
      [
        ...beideFelder('Rückfrage offen', 42),             // offen, 900
        ...beideFelder('Zweitprüfung', 43),                // offen, 100
        ...beideFelder('Schlussvermerk', 99),              // gepflegt, 9000
      ],
      vk([
        ['status', 'Rückfrage offen', 900],
        ['status', 'Zweitprüfung', 100],
        ['status', 'Schlussvermerk', 9000],
      ]),
    );
    expect(b.gesamtVorkommen).toBe(10000);
    expect(b.ohneKurz).toEqual({ anzahl: 2, vorkommen: 1000 });
    expect(b.abdeckung(1)).toBeCloseTo(0.9);
    expect(b.abdeckung(2)).toBe(1);
  });

  it('der ausgelieferte Katalog hat heute KEINE Lücke — das ist der Ist-Stand', () => {
    // Festgehalten, damit die Pflegeliste nicht als kaputt gilt, wenn sie „alle
    // gepflegt" meldet: der Seed von v3.15 hat die Lücke geschlossen, offen
    // wird es erst durch einen Import.
    const b = baueKurzLabelBilanz(
      [...beideFelder('Sonderstatus', 88), ...beideFelder('Skizze eingegangen', 11)],
      new Map(),
    );
    expect(b.ohneKurz.anzahl).toBe(0);
    // Ohne Vorkommen entscheidet der Code — die Liste darf zwischen zwei
    // Aufrufen nicht springen.
    expect(b.zeilen.map(z => z.kurz)).toEqual(['Skizze eing.', 'Sonderstatus']);
  });

  it('ohne offene Zeilen ist die Deckung voll — es ist nichts mehr zu tun', () => {
    const b = baueKurzLabelBilanz(beideFelder('beendet', 91), new Map());
    expect(b.abdeckung(20)).toBe(1);
  });
});
