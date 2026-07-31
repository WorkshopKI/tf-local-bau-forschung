/**
 * Protokoll-Vertrag der local-fs-Brücke.
 *
 * Client und Server müssen sich über Fehler-Semantik einig sein: der
 * Infrastructure-Layer verlässt sich fast überall auf den WURF statt auf `null`
 * (`atomic-write.ts` `exists()` fängt `getFileHandle` ab, `csv-source-handle.ts`
 * unterscheidet `NotFoundError` von echten Fehlern). Ein falsch gemappter Status
 * äussert sich deshalb nicht als Fehlermeldung, sondern als stilles Fehlverhalten
 * — z.B. „Datei existiert nicht" statt „Server kaputt".
 */

import { describe, it, expect } from 'vitest';
import {
  LOCAL_FS_PREFIX,
  baueUrl,
  leseAnfrage,
  leseParameter,
  statusFuerFehler,
  domNameFuerFehler,
  domNameFuerAntwort,
  istSchreibOperation,
  istLocalFsFehler,
  type LocalFsFehler,
} from '../protokoll';

describe('URL-Aufbau und -Zerlegung', () => {
  it('ist round-trip-fest', () => {
    const url = baueUrl('write', { root: 'daten-share', path: '_intern/audit-log.jsonl', keep: true, position: 42 });
    const gelesen = leseAnfrage(url);
    expect(gelesen?.op).toBe('write');
    expect(gelesen?.params.root).toBe('daten-share');
    expect(gelesen?.params.path).toBe('_intern/audit-log.jsonl');
    expect(gelesen?.params.keep).toBe(true);
    expect(gelesen?.params.position).toBe(42);
  });

  it('kodiert Sonderzeichen in Pfaden korrekt', () => {
    // „DMS Vorlagen" (Leerzeichen) und „Hübsch" (Umlaut) sind echte Ordnernamen
    // der Share-Kopie — beide müssen unbeschadet durch die Query kommen.
    for (const pfad of ['DMS Vorlagen/Gutachten_VB.DOCX', 'Hübsch/ZAH/profile.json', 'a+b/c&d=e.json']) {
      expect(leseAnfrage(baueUrl('stat', { root: 'x', path: pfad }))?.params.path).toBe(pfad);
    }
  });

  it('ignoriert fremde URLs', () => {
    expect(leseAnfrage('/src/main.tsx')).toBeNull();
    expect(leseAnfrage('/')).toBeNull();
    expect(leseAnfrage(`${LOCAL_FS_PREFIX}/erfunden`)).toBeNull();
  });

  it('dekodiert NICHT doppelt (sonst wäre %252e%252e ein Traversal)', () => {
    // URLSearchParams dekodiert bereits einmal. Ein zusätzliches
    // decodeURIComponent machte aus `%252e%252e` wieder `..`.
    const url = baueUrl('stat', { root: 'x', path: '%2e%2e/geheim' });
    expect(leseAnfrage(url)?.params.path).toBe('%2e%2e/geheim');
  });

  it('lehnt negative und krumme Zahlen ab', () => {
    const p = leseParameter(new URLSearchParams('position=-1&size=abc'));
    expect(p.position).toBeUndefined();
    expect(p.size).toBeUndefined();
  });
});

describe('Verb-Zuordnung', () => {
  it('trennt lesende von schreibenden Operationen', () => {
    for (const op of ['roots', 'stat', 'list', 'read'] as const) {
      expect(istSchreibOperation(op), op).toBe(false);
    }
    for (const op of ['write', 'truncate', 'mkdir', 'remove', 'move'] as const) {
      expect(istSchreibOperation(op), op).toBe(true);
    }
  });
});

describe('Fehler-Übersetzung', () => {
  const faelle: Array<[LocalFsFehler, number, string]> = [
    ['nicht-gefunden', 404, 'NotFoundError'],
    ['falsche-art', 409, 'TypeMismatchError'],
    ['nicht-leer', 409, 'InvalidModificationError'],
    ['ungueltiger-pfad', 400, 'TypeError'],
    ['unbekannter-slot', 400, 'TypeError'],
    ['io-fehler', 500, 'NotReadableError'],
  ];

  it.each(faelle)('%s → HTTP %i → %s', (fehler, status, domName) => {
    expect(statusFuerFehler(fehler)).toBe(status);
    expect(domNameFuerFehler(fehler)).toBe(domName);
    expect(domNameFuerAntwort(status, fehler)).toBe(domName);
  });

  it('macht aus einem I/O-Fehler NIE ein NotFoundError', () => {
    // Sonst schluckt jeder `catch`-Zweig, der „Datei gibt es nicht" bedeutet,
    // einen kaputten Server — und die App zeigt stillschweigend leere Daten.
    expect(domNameFuerFehler('io-fehler')).not.toBe('NotFoundError');
    expect(domNameFuerAntwort(500, null)).not.toBe('NotFoundError');
  });

  it('fällt ohne Fehler-Header auf den Status zurück', () => {
    expect(domNameFuerAntwort(404, null)).toBe('NotFoundError');
    expect(domNameFuerAntwort(400, null)).toBe('TypeError');
    expect(domNameFuerAntwort(502, null)).toBe('NotReadableError');
  });

  it('vertraut einem unbekannten Header-Wert nicht', () => {
    expect(istLocalFsFehler('quatsch')).toBe(false);
    expect(istLocalFsFehler(null)).toBe(false);
    expect(domNameFuerAntwort(404, 'quatsch')).toBe('NotFoundError');
  });
});
