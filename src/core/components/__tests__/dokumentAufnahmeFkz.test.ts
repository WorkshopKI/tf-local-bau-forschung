import { describe, it, expect } from 'vitest';
import { classifyFkz, normId, typAusDateiname } from '../dokumentAufnahmeFkz';

describe('classifyFkz — Verbund-Zuordnung der Aufnahmefläche', () => {
  // Bekannte Kennungen eines Verbundes: Verbund-ID + zwei TV-Aktenzeichen.
  const KNOWN = ['ZEP260092', '16EP260092', '16EP260093'];

  it('TV-FKZ im Dateinamen → match', () => {
    const r = classifyFkz('16EP260092_Vorhabensbeschreibung_v3.pdf', KNOWN);
    expect(r.matchedId).toBe('16EP260092');
    expect(r.detectedFkz).toBe('16EP260092');
    expect(r.fkzCase).toBe('match');
  });

  it('Verbund-FKZ (ZEP…, vom 16XX-Extraktor NICHT erkannt) → trotzdem match', () => {
    const r = classifyFkz('ZEP260092_Projektbeschreibung.pdf', KNOWN);
    expect(r.matchedId).toBe('ZEP260092');
    expect(r.detectedFkz).toBeNull(); // ZEP ist kein 16XX-Präfix
    expect(r.fkzCase).toBe('match');
  });

  it('anderes TV-FKZ desselben Verbundes (z.B. Nachlieferung) → match', () => {
    expect(classifyFkz('16EP260093_Nachlieferung.pdf', KNOWN).fkzCase).toBe('match');
  });

  it('fremdes FKZ → ambig (Bearbeiter ordnet zu)', () => {
    const r = classifyFkz('16KN065210_Stellungnahme.pdf', KNOWN);
    expect(r.matchedId).toBeNull();
    expect(r.detectedFkz).toBe('16KN065210');
    expect(r.fkzCase).toBe('ambig');
  });

  it('keine erkennbare Kennung → ambig', () => {
    const r = classifyFkz('Projektbeschreibung_final.pdf', KNOWN);
    expect(r.matchedId).toBeNull();
    expect(r.detectedFkz).toBeNull();
    expect(r.fkzCase).toBe('ambig');
  });

  it('normId ignoriert Trennzeichen beim Vergleich', () => {
    expect(normId('16EP_260092 v3')).toBe('16EP260092V3');
  });
});

describe('typAusDateiname — Vorbeleg-Typ aus dem Dateinamen', () => {
  it('„Anlage 5" (diverse Trenner) → arbeitsplan', () => {
    expect(typAusDateiname('16EP260092_Anlage 5 =PROG=.pdf', 'vorhabensbeschreibung')).toBe('arbeitsplan');
    expect(typAusDateiname('16EP260092_Anlage_5_NL.PDF', 'sonstiges')).toBe('arbeitsplan');
    expect(typAusDateiname('Arbeitsplan-Anlage.5.docx', 'vorhabensbeschreibung')).toBe('arbeitsplan');
  });

  it('„Anlage 5" gewinnt vor Marketing (Anlage 5 ist nie ein Marketingkonzept)', () => {
    expect(typAusDateiname('Anlage 5 Verwertung.pdf', 'sonstiges')).toBe('arbeitsplan');
  });

  it('Marketing/Verwertung → marketingkonzept', () => {
    expect(typAusDateiname('16EP260092_Verwertungskonzept.pdf', 'sonstiges')).toBe('marketingkonzept');
    expect(typAusDateiname('Marketing-Plan.docx', 'vorhabensbeschreibung')).toBe('marketingkonzept');
  });

  it('„Anlage 50" matcht NICHT (Wortgrenze wie ANLAGE5_RE)', () => {
    expect(typAusDateiname('Anlage 50 Budget.pdf', 'sonstiges')).toBe('sonstiges');
  });

  it('kein Treffer → fallback', () => {
    expect(typAusDateiname('16EP260092_A4_Projektbeschreibung.pdf', 'vorhabensbeschreibung')).toBe('vorhabensbeschreibung');
    expect(typAusDateiname('Stellungnahme.pdf', 'sonstiges')).toBe('sonstiges');
  });
});
