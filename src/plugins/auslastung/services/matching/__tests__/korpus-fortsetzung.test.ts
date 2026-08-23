/**
 * Ein Vollbau über mehrere Seiten-Neustarts — und die Grenzen, die verhindern,
 * dass sich ein Rechner darin festfährt.
 *
 * Der Anlass (08/2026): auf der Maschine des Nutzers stirbt das ONNX-Modul
 * reproduzierbar nach ~807 Einbettungen, und in derselben Seite ist es nicht zu
 * heilen — WebGPU- und CPU-Provider liegen in EINEM WASM-Modul, das ORT global
 * hält; ein zweiter Ladeversuch endet in einem rohen Emscripten-Abbruch.
 * Deshalb: merken, was offen ist, Seite neu laden, weitermachen.
 *
 * Der gefährliche Teil ist nicht das Fortsetzen, sondern das Aufhören.
 */
import { describe, it, expect } from 'vitest';
import {
  beurteileFortsetzung, NEUSTART_MAX, type BauFortsetzung,
} from '../korpus-fortsetzung';

function stand(p: Partial<BauFortsetzung> = {}): BauFortsetzung {
  return {
    programmId: 'default-programm',
    voll: true,
    offeneAz: ['A1', 'A2'],
    erledigt: 807,
    neustarts: 1,
    gestartet: '2026-08-23T10:00:00.000Z',
    grund: '[Device] is lost',
    ...p,
  };
}

describe('beurteileFortsetzung — weitermachen', () => {
  it('setzt fort, solange etwas offen ist und Fortschritt entstand', () => {
    expect(beurteileFortsetzung(stand(), 0).art).toBe('fortsetzen');
  });

  it('gilt als fertig, wenn nichts mehr offen ist', () => {
    expect(beurteileFortsetzung(stand({ offeneAz: [] }), 0)).toEqual({ art: 'fertig' });
  });

  it('setzt fort, wenn nur noch die Verbund-Phase offen ist', () => {
    // Sie kommt nach den Vorhaben und kann selbst am Geräteverlust scheitern —
    // dann ist die Restliste leer und der Bau trotzdem nicht fertig.
    expect(beurteileFortsetzung(stand({ offeneAz: [], verbundOffen: true }), 0).art)
      .toBe('fortsetzen');
  });

  it('gilt als fertig, wenn es gar keinen Merker gibt', () => {
    // Der Normalfall bei jedem gewöhnlichen Seitenaufbau.
    expect(beurteileFortsetzung(null, 0)).toEqual({ art: 'fertig' });
  });
});

describe('beurteileFortsetzung — aufhören', () => {
  it('hält die Obergrenze ein', () => {
    expect(beurteileFortsetzung(stand({ neustarts: NEUSTART_MAX }), 0))
      .toEqual({ art: 'aufgeben', grund: 'obergrenze' });
  });

  it('trägt einen Vollbau über 14.221 Vorhaben, ohne die Obergrenze zu reißen', () => {
    // ~810 Vektoren je Geräteleben — die Grenze muss das aushalten, sonst ist
    // das automatische Fortsetzen eine Zusage, die es nicht halten kann.
    expect(Math.ceil(14_221 / 810)).toBeLessThan(NEUSTART_MAX);
  });

  it('hört auf, wenn eine Runde keinen einzigen Vektor gebracht hat', () => {
    // Sonst laedt sich der Rechner endlos neu: dann liegt es nicht am
    // Grafik-Kontext, sondern am Lauf selbst.
    const s = stand({ neustarts: 2, erledigt: 807 });
    expect(beurteileFortsetzung(s, 807)).toEqual({ art: 'aufgeben', grund: 'kein-fortschritt' });
  });

  it('macht weiter, sobald auch nur ein Vektor dazukam', () => {
    const s = stand({ neustarts: 2, erledigt: 808 });
    expect(beurteileFortsetzung(s, 807).art).toBe('fortsetzen');
  });

  it('prüft den Fortschritt NICHT in der allerersten Runde', () => {
    // Vor dem ersten Neustart gibt es keine Vorrunde, mit der sich vergleichen
    // ließe — `erledigt` steht dort auf dem Ertrag des ersten Anlaufs.
    expect(beurteileFortsetzung(stand({ neustarts: 0, erledigt: 0 }), 0).art).toBe('fortsetzen');
  });
});
