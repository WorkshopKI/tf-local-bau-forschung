/**
 * Phase 5 — Export-Guard. Die einzige technische Grenze zwischen echter PII und
 * Zwischenablage. Bekannte Leak-Klassen MÜSSEN als unsicher erkannt werden.
 */
import { describe, expect, it } from 'vitest';
import { pruefeExportSicher } from '../export-guard';
import type { Mapping } from '../../types';

const MAPPING: Mapping[] = [
  { platzhalter: '[PERSON_1]', original: 'Dr. Schmidt', typ: 'person' },
  { platzhalter: '[FIRMA_1]', original: 'ACME Robotics GmbH', typ: 'firma' },
];

describe('pruefeExportSicher', () => {
  it('sauberer anonymisierter Text → sicher', () => {
    const text = 'Sehr geehrte [PERSON_1],\n\nvielen Dank für Ihre Anfrage zu [SONSTIGES_1].\n\n'
      + 'Wir melden uns bis zum 01.01.2026.\n\nMit freundlichen Grüßen, [PERSON_2]';
    const r = pruefeExportSicher(text, MAPPING);
    expect(r.sicher).toBe(true);
    expect(r.treffer).toHaveLength(0);
  });

  it('Mapping-Original noch im Text → Leak (case-insensitiv, whitespace-tolerant)', () => {
    const r = pruefeExportSicher('Hallo Dr.   schmidt, anbei …', MAPPING);
    expect(r.sicher).toBe(false);
    expect(r.treffer[0]?.quelle).toBe('mapping');
    expect(r.treffer[0]?.typ).toBe('person');
  });

  it('residuales FKZ → Leak', () => {
    const r = pruefeExportSicher('Das Förderkennzeichen 16EP1234 betrifft …', []);
    expect(r.sicher).toBe(false);
    expect(r.treffer.some(t => t.typ === 'fkz' && t.wert === '16EP1234')).toBe(true);
  });

  it('residuale E-Mail → Leak', () => {
    const r = pruefeExportSicher('Bitte an max.mustermann@example.de senden.', []);
    expect(r.sicher).toBe(false);
    expect(r.treffer.some(t => t.typ === 'email')).toBe(true);
  });

  it('residuale X.500-DN → Leak', () => {
    const r = pruefeExportSicher('/O=VDIVDEIT/OU=EAG/CN=RECIPIENTS/CN=USER2D9F', []);
    expect(r.sicher).toBe(false);
    expect(r.treffer.some(t => t.typ === 'x500')).toBe(true);
  });

  it('residuale IBAN → Leak', () => {
    const r = pruefeExportSicher('Konto: DE89 3704 0044 0532 0130 00', []);
    expect(r.sicher).toBe(false);
    expect(r.treffer.some(t => t.typ === 'iban')).toBe(true);
  });

  it('residualer Hostname → Leak', () => {
    const r = pruefeExportSicher('Header von mail.intern.vdivde-it.de', []);
    expect(r.sicher).toBe(false);
    expect(r.treffer.some(t => t.typ === 'hostname')).toBe(true);
  });

  it('residuale Telefonnummer → Leak; Datum bleibt sauber', () => {
    expect(pruefeExportSicher('Tel: 030 12345678', []).sicher).toBe(false);
    expect(pruefeExportSicher('Rückruf unter +49 30 1234567', []).sicher).toBe(false);
    // Datum darf NICHT als Telefonnummer durchgehen.
    expect(pruefeExportSicher('Frist am 01.01.2026.', []).treffer.some(t => t.typ === 'telefon')).toBe(false);
  });

  it('Treffer tragen Position + Länge für die Inline-Markierung', () => {
    const r = pruefeExportSicher('xx 16EP9999 yy', []);
    const t = r.treffer.find(x => x.typ === 'fkz');
    expect(t?.index).toBe(3);
    expect(t?.laenge).toBe('16EP9999'.length);
  });
});
