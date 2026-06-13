import { describe, it, expect } from 'vitest';
import {
  effectiveListWidth,
  clampDragWidth,
  listPaneClass,
  listPaneStyle,
  shouldCloseOnEscape,
} from '../masterDetailLayout-logic';

describe('masterDetailLayout-logic', () => {
  const MIN = 320;
  const DETAIL_MIN = 300;

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
});
