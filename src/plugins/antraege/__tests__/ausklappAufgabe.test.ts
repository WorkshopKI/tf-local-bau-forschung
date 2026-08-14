/**
 * Die **Aufgabe der Zeile** — Faltung über die Teilvorhaben.
 *
 * Zwei Fragen entscheidet dieses Modul, und beide falsch zu beantworten wäre
 * unsichtbar:
 *
 * 1. Eine verdichtete Verbundzeile steht für mehrere Teilvorhaben. Tragen die
 *    verschiedene Aufgaben, darf die erste nicht als „die" Aufgabe dastehen.
 * 2. Die Adresse für „Liegt bei" kommt aus dem AB-Satz. Warten zwei
 *    Teilvorhaben auf verschiedene Rollen, hat die ZEILE keine Adresse — dann
 *    schweigt der Wächter lieber, als die erste zu nehmen.
 */
import { describe, it, expect } from 'vitest';
import { ROLLEN } from '@/core/status/rollen';
import type { Rolle } from '@/core/status/typen';
import type { TodoErgebnis } from '@/core/status/todo-engine';
import {
  adresseFuerWaechter, baueAufgabe, type TvTodo,
} from '@/plugins/antraege/ausklapp/kopfkarte/aufgabe';

function erg(p: Partial<TodoErgebnis> = {}): TodoErgebnis {
  return {
    todo: null, regelId: null, beschreibung: null, zustaendig: [], wartetAuf: null,
    belege: [], gesperrtDurch: [], weitereTreffer: [], quelle: 'regel', ...p,
  };
}

/** Ein Teilvorhaben, dessen Regelsätze alle dasselbe sagen — sofern nicht anders gesetzt. */
function tv(aktenzeichen: string, je: Partial<Record<Rolle, TodoErgebnis>> = {}): TvTodo {
  const todos = {} as Record<Rolle, TodoErgebnis>;
  for (const r of ROLLEN) todos[r] = je[r] ?? erg();
  return { aktenzeichen, todos };
}

const AB = (p: Partial<TodoErgebnis>): Partial<Record<Rolle, TodoErgebnis>> => ({ ab: erg(p) });

describe('baueAufgabe', () => {
  it('zeigt die Aufgabe des einen Teilvorhabens samt Herkunft', () => {
    const a = baueAufgabe({
      jeTv: [tv('A1', AB({ todo: 'Gutachten anfordern', regelId: 'R4', beschreibung: 'R4 · Gutachten' }))],
      rolle: 'ab', ohneRegeln: false,
    });
    expect(a.text).toBe('Gutachten anfordern');
    expect(a.grund).toContain('R4 · Gutachten');
    expect(a.weitere).toEqual([]);
    expect(a.tv).toEqual(['A1']);
  });

  it('bündelt gleiche Aufgaben und führt abweichende gesondert auf', () => {
    const a = baueAufgabe({
      jeTv: [
        tv('A1', AB({ todo: 'Gutachten anfordern' })),
        tv('A2', AB({ todo: 'Gutachten anfordern' })),
        tv('A3', AB({ todo: 'ZuwB erstellen' })),
      ],
      rolle: 'ab', ohneRegeln: false,
    });
    expect(a.text).toBe('Gutachten anfordern');
    expect(a.tv).toEqual(['A1', 'A2']);
    expect(a.tvGesamt).toBe(3);
    // Die abweichende Aufgabe verschwindet NICHT hinter der ersten.
    expect(a.weitere).toEqual([{ text: 'ZuwB erstellen', aktenzeichen: ['A3'] }]);
  });

  it('nimmt das Ergebnis des Teilvorhabens, das die gezeigte Aufgabe trägt', () => {
    // Das erste TV hat kein To-do — die Belege müssen trotzdem zum GEZEIGTEN
    // Text gehören, nicht zum ersten Datensatz der Liste.
    const a = baueAufgabe({
      jeTv: [tv('A1'), tv('A2', AB({ todo: 'ZuwB erstellen', regelId: 'R9' }))],
      rolle: 'ab', ohneRegeln: false,
    });
    expect(a.ergebnis?.regelId).toBe('R9');
    expect(a.tv).toEqual(['A2']);
  });

  it('liest den Regelsatz der gewählten Rolle, nicht den des AB', () => {
    const jeTv = [tv('A1', { ab: erg({ todo: 'AB-Sache' }), fb: erg({ todo: 'FB-Sache' }) })];
    expect(baueAufgabe({ jeTv, rolle: 'fb', ohneRegeln: false }).text).toBe('FB-Sache');
    expect(baueAufgabe({ jeTv, rolle: 'ab', ohneRegeln: false }).text).toBe('AB-Sache');
  });

  it('markiert ein abgeleitetes To-do als solches', () => {
    const a = baueAufgabe({
      jeTv: [tv('A1', { fb: erg({ todo: 'Gutachten liefern', quelle: 'abgeleitet', abgeleitetAus: 'R4' }) })],
      rolle: 'fb', ohneRegeln: false,
    });
    expect(a.grund).toContain('Abgeleitet aus Regel R4');
  });
});

describe('baueAufgabe — kein Treffer ist ein Ergebnis', () => {
  it('unterscheidet „gesperrt" von „keine Regel trifft"', () => {
    const offen = baueAufgabe({ jeTv: [tv('A1')], rolle: 'ab', ohneRegeln: false });
    expect(offen.text).toBeNull();
    expect(offen.grund).toContain('keine Regel');

    const gesperrt = baueAufgabe({
      jeTv: [tv('A1', AB({ gesperrtDurch: ['S0'] }))], rolle: 'ab', ohneRegeln: false,
    });
    expect(gesperrt.grund).toContain('S0');
    expect(gesperrt.grund).toContain('Keine Aufgabe mehr');
  });

  it('sagt, wenn die Fassung gar keine Regeln führt', () => {
    const a = baueAufgabe({ jeTv: [tv('A1')], rolle: 'ab', ohneRegeln: true });
    expect(a.grund).toContain('keine To-do-Regeln');
  });

  it('sagt, wenn kein Teilvorhaben geladen ist — statt einer leeren Zeile', () => {
    expect(baueAufgabe({ jeTv: [], rolle: 'ab', ohneRegeln: false }).grund)
      .toContain('Kein Teilvorhaben geladen');
  });
});

describe('adresseFuerWaechter', () => {
  it('nimmt das erste Teilvorhaben, das eine Adresse benennt', () => {
    const l = adresseFuerWaechter([
      tv('A1', AB({ todo: 'irgendwas' })),
      tv('A2', AB({ todo: 'warten', wartetAuf: 'qs' })),
    ]);
    expect(l.todo?.wartetAuf).toBe('qs');
    expect(l.uneinig).toBe(false);
  });

  it('fällt auf `zustaendig` zurück, wo kein `wartetAuf` steht', () => {
    const l = adresseFuerWaechter([tv('A1', AB({ todo: 'tun', zustaendig: ['fb'] }))]);
    expect(l.todo?.zustaendig[0]).toBe('fb');
  });

  it('liefert KEINE Adresse, wenn die Teilvorhaben auf verschiedene warten', () => {
    const l = adresseFuerWaechter([
      tv('A1', AB({ todo: 'a', wartetAuf: 'qs' })),
      tv('A2', AB({ todo: 'b', wartetAuf: 'fb' })),
    ]);
    expect(l.todo).toBeNull();
    expect(l.uneinig).toBe(true);
  });

  it('ist einig, wenn beide dieselbe Rolle nennen — auch bei verschiedenen To-dos', () => {
    const l = adresseFuerWaechter([
      tv('A1', AB({ todo: 'a', wartetAuf: 'qs' })),
      tv('A2', AB({ todo: 'b', wartetAuf: 'qs' })),
    ]);
    expect(l.uneinig).toBe(false);
    expect(l.todo?.wartetAuf).toBe('qs');
  });

  it('liest den AB-Satz, nicht den einer anderen Rolle', () => {
    // Sonst verschöbe sich das Urteil des Wächters, sobald jemand seine
    // Anzeige umschaltet (dieselbe Regel wie im Vorgangs-Board).
    const l = adresseFuerWaechter([
      tv('A1', { ab: erg({ todo: 'a', wartetAuf: 'qs' }), fb: erg({ todo: 'b', wartetAuf: 'pa' }) }),
    ]);
    expect(l.todo?.wartetAuf).toBe('qs');
  });

  it('bleibt still, wo niemand ein To-do hat', () => {
    expect(adresseFuerWaechter([tv('A1')])).toEqual({ todo: null, uneinig: false });
    expect(adresseFuerWaechter([])).toEqual({ todo: null, uneinig: false });
  });
});
