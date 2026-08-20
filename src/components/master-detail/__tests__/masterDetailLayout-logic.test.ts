import { describe, it, expect } from 'vitest';
import {
  effectiveListWidth,
  clampDragWidth,
  keyboardWidthStep,
  listPaneClass,
  listPaneStyle,
  fokusIstTippziel,
  eineEbeneLiegtDarueber,
  maxListWidth,
  shouldCloseOnEscape,
  startListWidth,
} from '../masterDetailLayout-logic';

describe('masterDetailLayout-logic', () => {
  const MIN = 320;
  const DETAIL_MIN = 300;

  describe('startListWidth', () => {
    it('nimmt die gespeicherte Nutzerbreite, sobald es eine gibt', () => {
      expect(startListWidth(640, 1440, 460)).toBe(640);
      expect(startListWidth(640, 1440, 460, 452)).toBe(640);
    });
    it('ohne Vorgabe von rechts: der Sidebar-Default (bisheriges Verhalten)', () => {
      expect(startListWidth(null, 1440, 460)).toBe(460);
    });
    it('mit Vorgabe von rechts: die Liste bekommt den Rest und WÄCHST mit dem Fenster', () => {
      expect(startListWidth(null, 1440, 460, 452)).toBe(988);
      expect(startListWidth(null, 1920, 460, 452)).toBe(1468);
    });
    it('am engen Fenster übernimmt danach die Klemme in effectiveListWidth', () => {
      // 600 − 452 = 148 → unter narrowMinWidth, effectiveListWidth hebt an.
      expect(startListWidth(null, 600, 460, 452)).toBe(148);
      expect(effectiveListWidth(148, 600, MIN, DETAIL_MIN)).toBe(320);
    });
  });

  describe('effectiveListWidth', () => {
    it('gibt die Wunschbreite zurück, wenn der Viewport genug Platz lässt', () => {
      expect(effectiveListWidth(460, 1440, MIN, DETAIL_MIN)).toBe(460);
    });
    it('cappt gegen viewport − detailMinWidth, damit das Detail-Panel Platz behält', () => {
      // 1000 − 300 = 700 < 900 → 700
      expect(effectiveListWidth(900, 1000, MIN, DETAIL_MIN)).toBe(700);
    });
    it('fällt nie unter narrowMinWidth (enger Viewport)', () => {
      // max(320, 500−300=200) = 320 → min(900, 320) = 320
      expect(effectiveListWidth(900, 500, MIN, DETAIL_MIN)).toBe(320);
    });
  });

  describe('clampDragWidth', () => {
    it('klemmt am Floor narrowMinWidth', () => {
      expect(clampDragWidth(100, 1440, MIN, DETAIL_MIN)).toBe(320);
    });
    it('klemmt am dynamischen Max (viewport − detailMinWidth)', () => {
      // dynMax = max(320, 1000−300=700) = 700; raw 5000 → 700
      expect(clampDragWidth(5000, 1000, MIN, DETAIL_MIN)).toBe(700);
    });
    it('lässt Werte innerhalb der Grenzen unverändert durch', () => {
      expect(clampDragWidth(500, 1440, MIN, DETAIL_MIN)).toBe(500);
    });
  });

  describe('maxListWidth', () => {
    it('lässt dem Detail-Panel seine Mindestbreite', () => {
      expect(maxListWidth(1440, MIN, DETAIL_MIN)).toBe(1140);
    });
    it('fällt nie unter narrowMinWidth (enger Viewport)', () => {
      expect(maxListWidth(500, MIN, DETAIL_MIN)).toBe(320);
    });
  });

  describe('keyboardWidthStep', () => {
    it('→ verbreitert die Liste, ← verschmälert sie (Griff an der rechten Kante)', () => {
      expect(keyboardWidthStep('ArrowRight')).toBe(16);
      expect(keyboardWidthStep('ArrowLeft')).toBe(-16);
    });
    it('gibt bei jeder anderen Taste null zurück (Event nicht abfangen)', () => {
      expect(keyboardWidthStep('ArrowUp')).toBeNull();
      expect(keyboardWidthStep('Enter')).toBeNull();
      expect(keyboardWidthStep('Tab')).toBeNull();
    });
  });

  describe('listPaneClass / listPaneStyle (narrow-Umschaltung)', () => {
    it('füllt die volle Breite, wenn kein Detail offen ist', () => {
      expect(listPaneClass(false)).toBe('flex-1 min-w-0 h-full flex');
      expect(listPaneStyle(false, 460)).toBeUndefined();
    });
    it('wird zur fixen Sidebar, wenn ein Detail offen ist', () => {
      expect(listPaneClass(true)).toBe('h-full flex');
      expect(listPaneStyle(true, 460)).toEqual({ width: 460, flexShrink: 0, position: 'relative' });
    });
  });

  describe('shouldCloseOnEscape', () => {
    it('schließt bei normalem Fokus (BUTTON / DIV / nichts)', () => {
      expect(shouldCloseOnEscape('BUTTON', false)).toBe(true);
      expect(shouldCloseOnEscape('DIV', false)).toBe(true);
      expect(shouldCloseOnEscape(undefined, false)).toBe(true);
      expect(shouldCloseOnEscape(null, false)).toBe(true);
    });
    it('schließt NICHT, wenn ein Eingabefeld fokussiert ist (case-insensitive)', () => {
      expect(shouldCloseOnEscape('INPUT', false)).toBe(false);
      expect(shouldCloseOnEscape('textarea', false)).toBe(false);
      expect(shouldCloseOnEscape('SELECT', false)).toBe(false);
    });
    it('schließt NICHT bei contentEditable', () => {
      expect(shouldCloseOnEscape('DIV', true)).toBe(false);
    });
  });

  describe('fokusIstTippziel', () => {
    it('erkennt Eingabefelder (case-insensitive) und contentEditable', () => {
      expect(fokusIstTippziel('INPUT', false)).toBe(true);
      expect(fokusIstTippziel('textarea', false)).toBe(true);
      expect(fokusIstTippziel('SELECT', false)).toBe(true);
      expect(fokusIstTippziel('DIV', true)).toBe(true);
    });
    it('sieht in Knopf, Fläche oder Nichts kein Tippziel', () => {
      expect(fokusIstTippziel('BUTTON', false)).toBe(false);
      expect(fokusIstTippziel('DIV', false)).toBe(false);
      expect(fokusIstTippziel(undefined, false)).toBe(false);
      expect(fokusIstTippziel(null, false)).toBe(false);
    });
    it('ist die Gegenfrage zu shouldCloseOnEscape — eine Definition, nicht zwei', () => {
      for (const tag of ['INPUT', 'textarea', 'SELECT', 'BUTTON', 'DIV', null, undefined]) {
        for (const editierbar of [true, false]) {
          expect(fokusIstTippziel(tag, editierbar)).toBe(!shouldCloseOnEscape(tag, editierbar));
        }
      }
    });
  });
});

describe('eineEbeneLiegtDarueber + der dritte Parameter (v4.129)', () => {
  const doc = (treffer: boolean) => ({ querySelector: () => (treffer ? ({} as Element) : null) });

  it('erkennt eine schwebende Radix-Ebene', () => {
    expect(eineEbeneLiegtDarueber(doc(true))).toBe(true);
    expect(eineEbeneLiegtDarueber(doc(false))).toBe(false);
  });

  it('liegt eine Ebene darueber, gehoert das Escape IHR — das Detail bleibt offen', () => {
    expect(shouldCloseOnEscape('BUTTON', false, true)).toBe(false);
    expect(shouldCloseOnEscape('DIV', false, true)).toBe(false);
  });

  it('ohne Ebene bleibt alles wie bisher', () => {
    expect(shouldCloseOnEscape('BUTTON', false, false)).toBe(true);
    expect(shouldCloseOnEscape('INPUT', false, false)).toBe(false);
  });
});
