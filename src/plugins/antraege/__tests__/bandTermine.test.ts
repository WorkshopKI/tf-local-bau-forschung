/**
 * **Jeder Termin über der Bahn** — und was passiert, wenn kein Platz ist.
 *
 * Der Befund, der diese Datei begründet: bis v4.49 zeigte die Etage nur die
 * Kürzel, die einen Statuswechsel auslösen (gemessen 7,3 % der Termine). Die
 * Zusagen jetzt: kein Tag doppelt, das best belegte Kürzel steht da, verschwiegen
 * wird nichts (der Rest zählt als `+n`), und was kollidiert **entfällt** statt
 * gekürzt zu werden — ein gekürztes Kürzel wäre ein anderes Kürzel.
 */
import { describe, it, expect } from 'vitest';
import type { Konfidenz, VerlaufsUebergang } from '@/core/status/verlauf';
import type { ZeitAchse } from '@/plugins/antraege/verlauf-band/bandGeometrie';
import { tagesGruppen, verteileTermine } from '@/plugins/antraege/verlauf-band/bandTermine';

/** 6 px je Zeichen — dieselbe Attrappe wie in `bandBeschriftung.test.ts`. */
const messe = (s: string): number => s.length * 6;

function tagMs(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

/** Eine Achse aus Tag→x-Paaren; dazwischen wird linear interpoliert. */
function achse(...paare: [string, number][]): ZeitAchse {
  return { kanten: paare.map(([t]) => tagMs(t)), x: paare.map(([, x]) => x) };
}

function ueb(kuerzel: string, datum: string, konfidenz: Konfidenz = 'kein_kuerzel'): VerlaufsUebergang {
  return {
    kuerzel, datum, feldId: `D_${kuerzel}`, prominenz: 'normal',
    rollen: [], rollenLage: 'neutral', konfidenz,
    bezeichnung: null, bezeichnungEindeutig: true,
  };
}

const ACHSE = achse(['2024-01-01', 0], ['2024-06-01', 200], ['2024-12-31', 400]);

describe('tagesGruppen', () => {
  it('bündelt mehrere Übergänge desselben Tages', () => {
    const g = tagesGruppen([
      ueb('AAE', '2024-01-01'), ueb('XTE', '2024-01-01'), ueb('ABB', '2024-06-01'),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]?.uebergaenge).toHaveLength(2);
  });

  it('sortiert INNERHALB des Tages nach Belegung, nicht die Tagesfolge', () => {
    // Der Export führt keine Uhrzeit — eine Reihenfolge über den Tag hinaus wäre
    // erfundene Präzision.
    const g = tagesGruppen([
      ueb('A', '2024-06-01', 'kein_kuerzel'),
      ueb('B', '2024-06-01', 'trigger_bestaetigt'),
      ueb('C', '2024-06-01', 'zeitliche_naehe'),
      ueb('D', '2024-01-01', 'kein_kuerzel'),
    ]);
    expect(g.map(x => x.tag)).toEqual(['2024-06-01', '2024-01-01']);
    expect(g[0]?.uebergaenge.map(u => u.kuerzel)).toEqual(['B', 'C', 'A']);
  });
});

describe('verteileTermine', () => {
  const setz = { achse: ACHSE, bahnBreite: 400, messeText: messe };

  it('zentriert die Marke über ihrem Tag', () => {
    const m = verteileTermine(tagesGruppen([ueb('ABB', '2024-06-01')]), setz);
    // 'ABB' = 18 px + 10 Polster = 28 → links = 200 − 14.
    expect(m).toEqual([{
      datum: '2024-06-01', links: 186, breite: 28, text: 'ABB',
      uebergaenge: [expect.objectContaining({ kuerzel: 'ABB' })],
    }]);
  });

  it('nennt das best belegte Kürzel und zählt den Rest', () => {
    const m = verteileTermine(tagesGruppen([
      ueb('AAE', '2024-06-01', 'kein_kuerzel'),
      ueb('XPB', '2024-06-01', 'trigger_bestaetigt'),
      ueb('ARZ', '2024-06-01', 'zeitliche_naehe'),
    ]), setz);
    expect(m[0]?.text).toBe('XPB +2');
    // Verschwiegen wird nichts: die Marke führt alle drei mit, für den Titel.
    expect(m[0]?.uebergaenge).toHaveLength(3);
  });

  it('zeigt AUCH Termine, die keinen Statuswechsel auslösen', () => {
    // Der eigentliche Grund dieser Datei: `kein_kuerzel` ist mit 92,7 % der
    // Normalfall, und bis v4.49 fiel er aus dem Bild.
    const m = verteileTermine(tagesGruppen([ueb('FOY', '2024-01-01', 'kein_kuerzel')]), setz);
    expect(m).toHaveLength(1);
  });

  it('lässt weg, was kollidiert — statt zu kürzen', () => {
    const m = verteileTermine(tagesGruppen([
      ueb('AAE', '2024-03-17'), ueb('ABB', '2024-03-24'),
    ]), setz);
    expect(m).toHaveLength(1);
    expect(m[0]?.datum).toBe('2024-03-17');
  });

  it('setzt beide, sobald der Abstand reicht', () => {
    const m = verteileTermine(tagesGruppen([
      ueb('AAE', '2024-01-01'), ueb('ABB', '2024-06-01'),
    ]), setz);
    expect(m).toHaveLength(2);
    expect(m[0]!.links + m[0]!.breite).toBeLessThanOrEqual(m[1]!.links);
  });

  it('rückt am Rand nach innen, statt halb abgeschnitten zu stehen', () => {
    expect(verteileTermine(tagesGruppen([ueb('AAE', '2024-01-01')]), setz)[0]?.links).toBe(0);
    const rechts = verteileTermine(tagesGruppen([ueb('AAE', '2024-12-31')]), setz);
    expect(rechts[0]!.links + rechts[0]!.breite).toBe(400);
  });

  it('setzt KEINE Marke für einen Termin außerhalb der Achse', () => {
    // Geklemmt behauptete er ein Datum, das er nicht hat. Links kann das nicht
    // vorkommen (die Achse deckt den frühesten Termin), rechts schon: die Achse
    // endet am Bezugszeitpunkt.
    expect(verteileTermine(tagesGruppen([ueb('AAE', '2025-04-01')]), setz)).toEqual([]);
  });

  it('schweigt ohne Messung', () => {
    // Ohne Maß ließe sich die Kollision nicht prüfen, und geraten wäre hier
    // schlimmer als still.
    expect(verteileTermine(tagesGruppen([ueb('AAE', '2024-01-01')]), {
      ...setz, messeText: null,
    })).toEqual([]);
  });

  it('lässt eine Marke weg, die breiter ist als die ganze Bahn', () => {
    expect(verteileTermine(tagesGruppen([ueb('AAE', '2024-01-01')]), {
      ...setz, bahnBreite: 10,
    })).toEqual([]);
  });
});
