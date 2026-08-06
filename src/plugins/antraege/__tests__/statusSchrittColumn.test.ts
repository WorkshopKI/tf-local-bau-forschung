/**
 * Kombinierte „Status und nächster Schritt"-Spalte (Journey-Paket 2 Phase 3).
 *
 * Getestet wird die reine Logik der Spalten-Definition (accessor / exportValue /
 * render-Verzweigung) ohne DOM — die Node-Testumgebung rendert kein React, aber
 * `render` liefert ein React-Element (bzw. `null`), dessen `props.title` die
 * sichtbare Entscheidung (Badge+Aktion vs. terminaler Grau-Text) widerspiegelt.
 */
import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { ANTRAG_TABLE_COLUMNS, DEFAULT_VISIBLE_COLUMN_KEYS } from '../tableColumns';
import type { AntragTableRow } from '../tableGrouping';

const col = ANTRAG_TABLE_COLUMNS.find(c => c.key === 'status_naechster_schritt')!;

function row(status: string | undefined, precheckLabel?: string): AntragTableRow {
  return {
    aktenzeichen: '16DL260001',
    programm_id: 'p1',
    status,
    precheck_status_label: precheckLabel,
  } as unknown as AntragTableRow;
}

describe('Spalten-Registry — Default-Sichtbarkeit', () => {
  it('„Status und nächster Schritt" ist Default-sichtbar', () => {
    expect(DEFAULT_VISIBLE_COLUMN_KEYS).toContain('status_naechster_schritt');
  });
  it('altes reines „status"-Badge ist per Default AUS (nur noch Picker-Option)', () => {
    expect(DEFAULT_VISIBLE_COLUMN_KEYS).not.toContain('status');
    // bleibt als wählbare Spalte in der Registry erhalten
    expect(ANTRAG_TABLE_COLUMNS.some(c => c.key === 'status')).toBe(true);
  });
});

describe('accessor — Sortier-String (Rang + Aktion)', () => {
  it('polstert den Status-Rang 2-stellig und hängt die Aktion an', () => {
    // beantragt (offen, Rang 1) ohne PreCheck → Aktion „PreCheck durchführen"
    expect(col.accessor(row('beantragt', ''))).toBe('01 precheck durchführen');
  });

  it('leerer Status → „99" (ans Ende)', () => {
    expect(col.accessor(row(undefined))).toBe('99');
    expect(col.accessor(row(''))).toBe('99');
  });

  it('sortiert entlang des Lebenszyklus (Rang dominiert, Aktion nur Tie-Break)', () => {
    const rows = [
      row('Schlussvermerk'),   // Rang 7
      row('beantragt', 'x'),   // Rang 1
      row('bewilligt'),        // Rang 5
      row('NF gestellt'),      // Rang 3
    ];
    const sorted = [...rows].sort((a, b) =>
      String(col.accessor(a)).localeCompare(String(col.accessor(b)), 'de', { numeric: true }),
    );
    expect(sorted.map(r => r.status)).toEqual([
      'beantragt', 'NF gestellt', 'bewilligt', 'Schlussvermerk',
    ]);
  });
});

describe('exportValue — lesbarer Text statt Sortier-String', () => {
  // Seit v3.15 der VOLLE Bezeichner statt der Kurzform: eine Tabellenzelle hat
  // keine Breitenbeschränkung und keinen Tooltip, und der Export ist das
  // Einzige, was die App verlässt — eine Abkürzung dort ist ohne Rückweg. Die
  // Kleinschreibung ist die amtliche Bezeichnung aus der Parametertabelle
  // (Fremddaten, Pitfall #43); groß geschrieben ist nur unsere Kurzform.
  it('nicht-terminal ohne PreCheck → „{Status} → {Aktion}"', () => {
    expect(col.exportValue!(row('beantragt', ''))).toBe('beantragt → PreCheck durchführen');
  });

  it('PreCheck-Stand fließt in die Aktion ein (positiv → Status-Regel statt PreCheck-Regel)', () => {
    expect(col.exportValue!(row('beantragt', 'PreCheck positiv - Verbund')))
      .toBe('beantragt → Vollständigkeit prüfen');
  });

  it('PreCheck negativ → Klärungs-Aktion', () => {
    expect(col.exportValue!(row('beantragt', 'PreCheck negativ - Verbund')))
      .toBe('beantragt → PreCheck-Ergebnis klären');
  });

  it('terminaler Status → nur der volle Bezeichner (keine Aktion)', () => {
    expect(col.exportValue!(row('Schlussvermerk'))).toBe('Schlussvermerk');
    expect(col.exportValue!(row('abgelehnt/zurückgezogen'))).toBe('abgelehnt/zurückgezogen');
  });

  it('leerer Status → leerer Export', () => {
    expect(col.exportValue!(row(undefined))).toBe('');
  });
});

describe('render — Badge+Aktion vs. terminaler Grau-Text', () => {
  it('leerer Status → null (leere Zelle)', () => {
    expect(col.render(row(undefined))).toBeNull();
    expect(col.render(row(''))).toBeNull();
  });

  it('nicht-terminal → Tooltip trägt den VOLLEN Bezeichner + Aktion', () => {
    // Der Tooltip ist die Auflösung der Kurzform in der Pille daneben — er muss
    // deshalb mehr sagen als sie, nicht dasselbe.
    const el = col.render(row('beantragt', '')) as ReactElement<{ title?: string }>;
    expect(el).not.toBeNull();
    expect(el.props.title).toBe('beantragt → PreCheck durchführen');
  });

  it('terminal → Tooltip trägt nur das Status-Label (kein Pfeil)', () => {
    const el = col.render(row('Schlussvermerk')) as ReactElement<{ title?: string }>;
    expect(el).not.toBeNull();
    expect(el.props.title).toBe('Schlussvermerk');
  });
});
