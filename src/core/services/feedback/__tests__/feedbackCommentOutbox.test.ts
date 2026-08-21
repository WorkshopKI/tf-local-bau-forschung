/**
 * `isValidCommentFile` (v5.2): das neue optionale `kind` darf keine
 * Bestandsdatei ungueltig machen — und ein Wert, den dieser Client noch nicht
 * kennt, darf nicht die ganze Datei samt aller Kommentare darin verwerfen.
 * Die Whitelist steht bewusst erst beim Einsammeln.
 */
import { describe, expect, it } from 'vitest';
import { isValidCommentFile } from '../feedbackCommentOutbox';

function datei(comments: unknown[]): unknown {
  return { version: 1, kuerzel: 'TH', comments, updatedAt: '2026-08-21T10:00:00Z' };
}
const basis = { ticketId: 'A', id: 'c1', text: 'hallo', created_at: 't1' };

describe('isValidCommentFile', () => {
  it('akzeptiert eine Bestandsdatei ohne kind', () => {
    expect(isValidCommentFile(datei([basis]))).toBe(true);
  });

  it('akzeptiert eine Datei mit kind', () => {
    expect(isValidCommentFile(datei([{ ...basis, kind: 'ergaenzung' }]))).toBe(true);
  });

  it('verwirft die Datei nicht wegen einer unbekannten Art', () => {
    expect(isValidCommentFile(datei([{ ...basis, kind: 'was-neues' }]))).toBe(true);
  });

  it('verwirft weiterhin, was strukturell fehlt', () => {
    expect(isValidCommentFile(datei([{ id: 'c1', text: 'hallo', created_at: 't1' }]))).toBe(false);
    expect(isValidCommentFile({ version: 2, kuerzel: 'TH', comments: [], updatedAt: 'x' })).toBe(false);
  });
});
