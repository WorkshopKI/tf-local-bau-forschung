/**
 * Spaltenname ist nicht Spalten-IDENTITÄT.
 *
 * C16 kürzt Spaltenköpfe auf 10 Zeichen, dadurch stehen Namen mehrfach im
 * Export (in `9052_PrjBsp`: 163 Spalten, 35 mehrfach vergebene Namen, 72
 * betroffene Spalten). PapaParse benennt jedes weitere Vorkommen
 * POSITIONSABHÄNGIG in `<Name>_1`, `<Name>_2` um — und genau dieser
 * synthetische Name ist der Mapping-Schlüssel. Die Zuordnung „Spalte → Feld"
 * hängt damit an der Reihenfolge, die Drift-Prüfung verglich aber nur
 * Namensmengen.
 *
 * Folge: kommt eine weitere Spalte mit einem bereits vergebenen Namen VOR das
 * bisherige zweite Vorkommen, wandert `_1` auf sie; die echte Spalte wird zu
 * `_2` und damit zur „neuen Spalte", die der Auto-Refresh headless als
 * `{ignore:true}` adoptiert. Ab da liest das Feld aus der falschen Spalte,
 * ohne dass irgendwo eine Drift gemeldet worden wäre.
 *
 * Was der Kopfzeilen-Vergleich NICHT sehen kann: zwei gleichnamige Spalten
 * tauschen die Plätze. Die Kopfzeile ist dann byte-identisch — das ist eine
 * Grenze der Quelle, keine der Prüfung.
 */
import { describe, it, expect } from 'vitest';
import {
  aliasGruppen, entscheideDrift, hasDrift, isNewColumnsOnlyDrift, validateHeaders,
} from '../csv-drift-check';
import type { ColumnMapping, CsvSchema } from '@/core/services/csv/types';

function schema(mapping: ColumnMapping): CsvSchema {
  return {
    id: 's', programm_id: 'p', csv_source_name: 'Projektbeschreibung', is_master: false,
    priority: 40, join_key: 'aktenzeichen', column_mapping: mapping,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

/** Zwillingsspalten wie im echten Export: derselbe 10-Zeichen-Name, TV und VB. */
const ZWILLINGE = schema({
  FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
  Nachhaltig: { custom: 'zt_nachhaltig_tv', type: 'string' },
  Nachhaltig_1: { custom: 'zt_nachhaltig_vb', type: 'string' },
});

describe('aliasGruppen', () => {
  it('zählt `X` und `X_1` als eine Gruppe', () => {
    expect(aliasGruppen(['FKZ', 'Nachhaltig', 'Nachhaltig_1']).get('Nachhaltig')).toBe(2);
  });

  it('lässt einen echten Spaltennamen auf `_1` in Ruhe, wenn die Basis fehlt', () => {
    const g = aliasGruppen(['FKZ', 'Quartal_1', 'Quartal_2']);
    expect(g.get('Quartal_1')).toBe(1);
    expect(g.get('Quartal_2')).toBe(1);
    expect(g.has('Quartal')).toBe(false);
  });

  it('löst mehrstufige Aliase auf die echte Basis auf', () => {
    expect(aliasGruppen(['A', 'A_1', 'A_1_1']).get('A')).toBe(3);
  });
});

describe('validateHeaders erkennt verschobene Alias-Zuordnungen', () => {
  it('unveränderte Kopfzeile mit Doppelnamen ist keine Drift', () => {
    const v = validateHeaders(ZWILLINGE, ['FKZ', 'Nachhaltig', 'Nachhaltig_1']);
    expect(v.mehrdeutigeSpalten).toEqual([]);
    expect(hasDrift(v)).toBe(false);
  });

  it('eine dritte gleichnamige Spalte macht die ganze Gruppe mehrdeutig', () => {
    const v = validateHeaders(ZWILLINGE, ['FKZ', 'Nachhaltig', 'Nachhaltig_1', 'Nachhaltig_2']);
    expect(v.mehrdeutigeSpalten).toEqual(['Nachhaltig']);
    expect(hasDrift(v)).toBe(true);
  });

  it('die zusätzliche Alias-Spalte gilt NICHT als harmlose Zusatzspalte', () => {
    const v = validateHeaders(ZWILLINGE, ['FKZ', 'Nachhaltig', 'Nachhaltig_1', 'Nachhaltig_2']);
    expect(v.newColumns).toEqual(['Nachhaltig_2']);
    expect(isNewColumnsOnlyDrift(v)).toBe(false);
    expect(entscheideDrift(v, false).neueSpaltenAdoptieren).toBe(false);
  });

  it('auch eine geschrumpfte Gruppe ist mehrdeutig — welche der beiden blieb übrig?', () => {
    const v = validateHeaders(ZWILLINGE, ['FKZ', 'Nachhaltig']);
    expect(v.mehrdeutigeSpalten).toEqual(['Nachhaltig']);
    expect(v.missingFromCsv).toEqual(['Nachhaltig_1']);
  });

  it('eine ganz verschwundene Gruppe ist schlicht fehlend, nicht mehrdeutig', () => {
    const v = validateHeaders(ZWILLINGE, ['FKZ']);
    expect(v.mehrdeutigeSpalten).toEqual([]);
    expect(v.missingFromCsv).toEqual(['Nachhaltig', 'Nachhaltig_1']);
  });

  it('eine bisher einzelne Spalte, die plötzlich doppelt vorkommt, ist mehrdeutig', () => {
    const einzeln = schema({
      FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
      Nachhaltig: { custom: 'zt_nachhaltig_tv', type: 'string' },
    });
    const v = validateHeaders(einzeln, ['FKZ', 'Nachhaltig', 'Nachhaltig_1']);
    expect(v.mehrdeutigeSpalten).toEqual(['Nachhaltig']);
  });
});

describe('entscheideDrift bei mehrdeutigen Spalten', () => {
  it('blockiert — auch wenn der Kurator „Trotzdem importieren" geklickt hat', () => {
    const v = validateHeaders(ZWILLINGE, ['FKZ', 'Nachhaltig', 'Nachhaltig_1', 'Nachhaltig_2']);
    expect(entscheideDrift(v, true).importieren).toBe(false);
    expect(entscheideDrift(v, false).importieren).toBe(false);
  });

  it('ohne Mehrdeutigkeit bleibt die Zustimmung wirksam', () => {
    const v = validateHeaders(ZWILLINGE, ['FKZ']);
    expect(v.mehrdeutigeSpalten).toEqual([]);
    expect(entscheideDrift(v, true).importieren).toBe(true);
  });
});
