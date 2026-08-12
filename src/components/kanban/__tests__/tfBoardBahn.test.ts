/**
 * Die Ansichts-Rechnung des Board-Primitivs. Portiert aus
 * `plugins/feedback-board/__tests__/boardSpalten.test.ts` (v3.43), wo sie am
 * Feedback-Datenmodell hing — die Fälle sind dieselben.
 *
 * Warum sie einen eigenen Test verdient: bis v3.41 war „aufgeklappt und leer"
 * eine Einbahnstraße — die aufgeklappte leere Bahn verlor mit der Schiene auch
 * ihren Klick und ließ sich nur noch durch Neuladen einklappen. Die Zustände
 * lagen als Boolean-Ausdruck in der Komponente; kein Test konnte sehen, dass das
 * ein eigener Zustand ist, der eine eigene Bedienung braucht. Seit v3.43 gilt
 * dasselbe in der anderen Richtung: auch eine GEFÜLLTE Bahn lässt sich
 * vorübergehend schmal stellen.
 */
import { describe, expect, it } from 'vitest';
import { bahnAnsicht, istSchiene, type TfBahnAnsicht, type TfBahnWunsch } from '../tfBoardBahn';

const leer = (wunsch: TfBahnWunsch): TfBahnAnsicht =>
  bahnAnsicht({ leer: true, unerreichbar: false, wunsch });
const voll = (wunsch: TfBahnWunsch): TfBahnAnsicht =>
  bahnAnsicht({ leer: false, unerreichbar: false, wunsch });

describe('bahnAnsicht', () => {
  it('zeigt eine gefüllte Bahn voll, solange niemand sie eingeklappt hat', () => {
    expect(voll('auto')).toBe('voll');
    // `offen` kann eine volle Bahn nicht „noch offener" machen.
    expect(voll('offen')).toBe('voll');
  });

  it('legt eine gefüllte Bahn auf Wunsch auf die Schiene', () => {
    expect(voll('zu')).toBe('voll-schiene');
  });

  it('faltet eine leere Bahn zur Schiene, bis jemand sie aufklappt', () => {
    expect(leer('auto')).toBe('schiene');
    expect(leer('offen')).toBe('leer-offen');
    // Eine leere Bahn einklappen zu wollen ist keine Aussage — sie ist es schon.
    expect(leer('zu')).toBe('schiene');
  });

  // Beide Zustände, die eine GESTE erzeugt, müssen wieder zu erreichen sein:
  // `leer-offen` trägt den Rückweg in der Bahn, `voll-schiene` auf der Schiene
  // selbst. Der Rückweg ist in beiden Fällen `auto`.
  it('nimmt jede von Hand erzeugte Ansicht mit „auto" wieder zurück', () => {
    const gesten: Array<[(w: TfBahnWunsch) => TfBahnAnsicht, TfBahnWunsch, TfBahnAnsicht]> = [
      [leer, 'offen', 'leer-offen'],
      [voll, 'zu', 'voll-schiene'],
    ];
    for (const [bahn, wunsch, erzeugt] of gesten) {
      expect(bahn(wunsch)).toBe(erzeugt);
      expect(bahn('auto')).not.toBe(erzeugt);
    }
  });

  // Eine Bahn, die die aktive Sicht gar nicht füllen KANN, bleibt Schiene — auch
  // nach einem Klick. Aufgeklappt behauptete sie ein zweites Mal „hier ist
  // nichts", statt auf die Sicht zu zeigen, die ihren Inhalt hätte (v3.39).
  it('lässt eine unerreichbare Bahn nicht aufklappen', () => {
    for (const wunsch of ['auto', 'offen', 'zu'] as const) {
      expect(bahnAnsicht({ leer: true, unerreichbar: true, wunsch })).toBe('schiene');
    }
  });

  // Der Inhalt schlägt die Unerreichbarkeit: solange Karten dastehen, werden sie
  // gezeigt. Sonst verstümmelte ein Sicht-Wechsel die Bahn, die gerade noch
  // etwas enthielt.
  it('zeigt eine gefüllte Bahn auch dann, wenn die Sicht sie nicht füllen könnte', () => {
    expect(bahnAnsicht({ leer: false, unerreichbar: true, wunsch: 'auto' })).toBe('voll');
  });

  it('zählt beide Schienen als Schiene — sie teilen sich Geometrie und Drop-Ziel', () => {
    expect(istSchiene(leer('auto'))).toBe(true);
    expect(istSchiene(voll('zu'))).toBe(true);
    expect(istSchiene(voll('auto'))).toBe(false);
    expect(istSchiene(leer('offen'))).toBe(false);
  });
});
