/**
 * felderGruppen: kuratierte SOLL-Gruppierung (Handoff `_design/handoff/alle-felder`).
 * Deckt die Vorrang-Stufe-0 in `groupDisplayRows` ab: kuratierte Gruppe > Schema-group_path,
 * Flag-Felder ausgespart, SOLL-Reihenfolge + „Weitere Felder" zuletzt.
 */
import { describe, it, expect } from 'vitest';
import { kuratierteGruppe, GRUPPEN_ORDER } from '../felderGruppen';
import { groupDisplayRows, type DisplayRow } from '../buildDisplayRows';
import type { CsvSchema } from '@/core/services/csv/types';

function row(field: string, label = field, sourceSchemaId?: string): DisplayRow {
  return { field, label, value: '', rawValue: 'x', sourceSchemaId, isCanonical: false };
}

function schemaWithGroup(id: string, field: string, group_path: string[]): CsvSchema {
  return {
    id,
    programm_id: 'p1',
    csv_source_name: id,
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 0,
    column_mapping: { [field]: { custom: field, type: 'string', group_path } },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('kuratierteGruppe', () => {
  it('mappt per canonical-Key', () => {
    expect(kuratierteGruppe(row('akronym', 'Akronym'))).toBe('Vorhabensinformation');
    expect(kuratierteGruppe(row('foerdersumme', 'Fördersumme'))).toBe('Finanzen');
    expect(kuratierteGruppe(row('antragsdatum', 'Antragsdatum'))).toBe('Termine');
    expect(kuratierteGruppe(row('frist_datum', 'Fristdatum'))).toBe('Termine');
  });

  it('mappt per C16-Label (label-tolerant)', () => {
    expect(kuratierteGruppe(row('x', 'beantragte Kosten (Deckblatt Mantelbogen)'))).toBe('Finanzen');
    expect(kuratierteGruppe(row('x', 'NF an ASt'))).toBe('Nachforderung');
    expect(kuratierteGruppe(row('x', 'Nachlieferung Eingang'))).toBe('Nachforderung');
    expect(kuratierteGruppe(row('x', 'NACE-Code (FuE) Organisationsebene'))).toBe('Klassifikation & Deskriptoren');
  });

  it('spart Flag-Felder aus (zt_-Präfix → null, bleibt dem Flag-Cluster)', () => {
    expect(kuratierteGruppe(row('zt_additive_fertigung_tv', 'Additive Fertigung / 3D-Druck'))).toBeNull();
  });

  it('gibt null für unbekannte Felder (fallen auf group_path zurück)', () => {
    expect(kuratierteGruppe(row('irgendein_feld', 'Unbekanntes Feld'))).toBeNull();
  });
});

describe('groupDisplayRows — kuratierte Gruppierung', () => {
  it('kuratierte Gruppe gewinnt über Schema-group_path', () => {
    // Feld trägt einen abweichenden group_path, ist aber kuratiert → kuratierte Gruppe gewinnt.
    const r = row('beantragte_kosten', 'beantragte Kosten (Deckblatt Mantelbogen)', 'src-1');
    const groups = groupDisplayRows([r], [schemaWithGroup('src-1', 'beantragte_kosten', ['Vorhabensinformation'])]);
    expect(groups.map(g => g.label)).toEqual(['Finanzen']);
  });

  it('ordnet kuratierte Gruppen nach GRUPPEN_ORDER, „Weitere Felder" zuletzt', () => {
    const rows = [
      row('x1', 'NACE-Code (FuE) Organisationsebene'), // Klassifikation & Deskriptoren
      row('irgendein_feld', 'Unbekannt'),               // Weitere Felder
      row('akronym', 'Akronym'),                        // Vorhabensinformation
      row('x2', 'NF an ASt'),                           // Nachforderung
    ];
    const groups = groupDisplayRows(rows, []);
    expect(groups.map(g => g.label)).toEqual([
      'Vorhabensinformation',
      'Nachforderung',
      'Klassifikation & Deskriptoren',
      'Weitere Felder',
    ]);
  });

  it('übrige group_path-Gruppen stehen zwischen kuratierten und „Weitere Felder"', () => {
    const rows = [
      row('sonstiges', 'Sonstiges Feld', 'src-1'), // group_path ['Spezial'] → eigene Gruppe
      row('akronym', 'Akronym'),                    // Vorhabensinformation (kuratiert)
      row('frei', 'Freies Feld'),                   // Weitere Felder
    ];
    const groups = groupDisplayRows(rows, [schemaWithGroup('src-1', 'sonstiges', ['Spezial'])]);
    expect(groups.map(g => g.label)).toEqual(['Vorhabensinformation', 'Spezial', 'Weitere Felder']);
  });

  it('GRUPPEN_ORDER enthält die fünf SOLL-Lesegruppen', () => {
    expect(GRUPPEN_ORDER).toEqual([
      'Vorhabensinformation',
      'Finanzen',
      'Termine',
      'Nachforderung',
      'Klassifikation & Deskriptoren',
    ]);
  });
});
