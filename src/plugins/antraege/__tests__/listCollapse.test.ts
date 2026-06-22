import { describe, it, expect } from 'vitest';
import {
  parseCollapsedFlag,
  serializeCollapsedFlag,
  shouldShowList,
} from '../listCollapse';

describe('listCollapse', () => {
  describe('parseCollapsedFlag', () => {
    it('liest "1" als eingeklappt', () => {
      expect(parseCollapsedFlag('1')).toBe(true);
    });
    it('liest alles andere als ausgeklappt (Default)', () => {
      expect(parseCollapsedFlag('0')).toBe(false);
      expect(parseCollapsedFlag(null)).toBe(false);
      expect(parseCollapsedFlag('')).toBe(false);
      expect(parseCollapsedFlag('true')).toBe(false);
    });
  });

  describe('serializeCollapsedFlag', () => {
    it('round-trippt mit parseCollapsedFlag', () => {
      expect(parseCollapsedFlag(serializeCollapsedFlag(true))).toBe(true);
      expect(parseCollapsedFlag(serializeCollapsedFlag(false))).toBe(false);
    });
  });

  describe('shouldShowList', () => {
    it('zeigt die Liste immer ohne offenes Detail (nichts einzuklappen)', () => {
      expect(shouldShowList(false, false)).toBe(true);
      expect(shouldShowList(false, true)).toBe(true);
    });
    it('blendet die Liste nur bei offenem Detail UND eingeklappt aus', () => {
      expect(shouldShowList(true, false)).toBe(true);
      expect(shouldShowList(true, true)).toBe(false);
    });
  });
});
