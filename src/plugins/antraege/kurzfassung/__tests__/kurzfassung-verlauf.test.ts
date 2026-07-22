import { describe, it, expect } from 'vitest';
import { appendVerlauf, restoreVersion, snapshotOf, versionLabel, MAX_VERLAUF, type VerlaufContent } from '../kurzfassung-verlauf';
import type { KurzfassungRecord } from '../types';

function makeRecord(over: Partial<KurzfassungRecord> = {}): KurzfassungRecord {
  return {
    key: 'VB-1',
    quellenanalyse: 'QA',
    entwurf: 'E',
    finalerText: 'Aktueller Text.',
    checks: [{ id: 'c1', level: 'ok', label: 'OK' }],
    status: 'entwurf',
    erstellt_am: '2026-06-01T10:00:00.000Z',
    modell: 'llama',
    ...over,
  };
}

describe('versionLabel', () => {
  it('Erstfassung ohne Modifier', () => {
    expect(versionLabel({})).toBe('Erstfassung');
  });
  it('Modifier-Labels', () => {
    expect(versionLabel({ modifier: 'neu' })).toBe('Neu generiert');
    expect(versionLabel({ modifier: 'kuerzer' })).toBe('Gekürzt');
    expect(versionLabel({ modifier: 'laenger' })).toBe('Verlängert');
  });
  it('sprachlicher Feinschliff hat Vorrang vor dem Modifier (jüngerer Arbeitsgang)', () => {
    expect(versionLabel({ lektoriert: true })).toBe('Sprachlich überarbeitet');
    expect(versionLabel({ modifier: 'kuerzer', lektoriert: true })).toBe('Sprachlich überarbeitet');
  });
});

describe('lektoriert im Verlauf (sprachlicher Feinschliff)', () => {
  function content(over: Partial<VerlaufContent> = {}): VerlaufContent {
    return {
      finalerText: 'Redigiert.', quellenanalyse: 'QA', entwurf: 'E',
      checks: [], erstellt_am: '2026-07-22T10:00:00.000Z', modell: 'qwen', ...over,
    };
  }

  it('snapshotOf führt das Flag mit — und lässt es weg, wenn nicht gesetzt', () => {
    expect(snapshotOf(content({ lektoriert: true })).lektoriert).toBe(true);
    expect('lektoriert' in snapshotOf(content())).toBe(false);
  });

  it('restoreVersion setzt bzw. löscht das Flag beim Rückgriff', () => {
    const lektoriert = restoreVersion(
      content({ lektoriert: false, verlauf: [snapshotOf(content({ lektoriert: true }))] }), 0,
    );
    expect(lektoriert.lektoriert).toBe(true);

    const zurueck = restoreVersion(
      content({ lektoriert: true, verlauf: [snapshotOf(content({ finalerText: 'Original.' }))] }), 0,
    );
    expect(zurueck.finalerText).toBe('Original.');
    expect(zurueck.lektoriert).toBeUndefined(); // Vorfassung war nie lektoriert
  });
});

describe('snapshotOf', () => {
  it('kopiert Fassungs-Felder, lässt optionale weg wenn leer', () => {
    const snap = snapshotOf(makeRecord());
    expect(snap.finalerText).toBe('Aktueller Text.');
    expect(snap.modell).toBe('llama');
    expect('modifier' in snap).toBe(false);
    expect('vbGekuerzt' in snap).toBe(false);
    expect('warnung' in snap).toBe(false);
  });
  it('übernimmt optionale Felder wenn gesetzt', () => {
    const snap = snapshotOf(makeRecord({ modifier: 'kuerzer', vbGekuerzt: true, warnung: 'W', denkprozess: 'Erst überlege ich…' }));
    expect(snap.modifier).toBe('kuerzer');
    expect(snap.vbGekuerzt).toBe(true);
    expect(snap.warnung).toBe('W');
    expect(snap.denkprozess).toBe('Erst überlege ich…');
  });
  it('lässt denkprozess weg, wenn nicht gesetzt', () => {
    expect('denkprozess' in snapshotOf(makeRecord())).toBe(false);
  });
});

describe('appendVerlauf', () => {
  it('Erstlauf (prev=null) → leerer Verlauf', () => {
    expect(appendVerlauf(null)).toEqual([]);
  });

  it('hängt die aktuelle Fassung an den bestehenden Verlauf', () => {
    const prev = makeRecord({ finalerText: 'Zweite Fassung.' });
    const verlauf = appendVerlauf(prev);
    expect(verlauf).toHaveLength(1);
    expect(verlauf[0]?.finalerText).toBe('Zweite Fassung.');
  });

  it('kappt auf MAX_VERLAUF — älteste fliegt raus', () => {
    // Record mit bereits MAX_VERLAUF Vorfassungen (v0..v4), aktive = "aktuell"
    let verlauf = Array.from({ length: MAX_VERLAUF }, (_, i) => snapshotOf(makeRecord({ finalerText: `v${i}` })));
    const prev = makeRecord({ finalerText: 'aktuell', verlauf });
    verlauf = appendVerlauf(prev);
    expect(verlauf).toHaveLength(MAX_VERLAUF);
    // v0 (älteste) ist verdrängt, die zuletzt aktive ("aktuell") steht hinten
    expect(verlauf[0]?.finalerText).toBe('v1');
    expect(verlauf[MAX_VERLAUF - 1]?.finalerText).toBe('aktuell');
  });
});

describe('restoreVersion', () => {
  it('macht die gewählte Vorfassung aktiv, schiebt die bisherige in den Verlauf', () => {
    const v0 = snapshotOf(makeRecord({ finalerText: 'alt-0', modifier: undefined }));
    const v1 = snapshotOf(makeRecord({ finalerText: 'alt-1', modifier: 'kuerzer' }));
    const record = makeRecord({ finalerText: 'aktuell', modifier: 'laenger', status: 'freigegeben', verlauf: [v0, v1] });

    const restored = restoreVersion(record, 0); // v0 zurückholen

    expect(restored.finalerText).toBe('alt-0');
    expect(restored.modifier).toBeUndefined(); // v0 war Erstfassung
    expect(restored.status).toBe('entwurf'); // Freigabe zurückgesetzt
    // v0 raus, v1 bleibt, die bisher aktive Fassung kommt hinten dran → nichts verloren
    const texte = restored.verlauf?.map(v => v.finalerText);
    expect(texte).toEqual(['alt-1', 'aktuell']);
  });

  it('Out-of-range-Index → Record unverändert', () => {
    const record = makeRecord({ verlauf: [] });
    expect(restoreVersion(record, 3)).toBe(record);
  });

  it('löscht optionale Felder, wenn die gewählte Fassung sie nicht hat', () => {
    const v0 = snapshotOf(makeRecord({ finalerText: 'alt-0' })); // ohne warnung/vbGekuerzt/denkprozess
    const record = makeRecord({ finalerText: 'aktuell', warnung: 'W', vbGekuerzt: true, denkprozess: 'D', verlauf: [v0] });
    const restored = restoreVersion(record, 0);
    expect(restored.warnung).toBeUndefined();
    expect(restored.vbGekuerzt).toBeUndefined();
    expect(restored.denkprozess).toBeUndefined();
  });

  it('behält den denkprozess der zurückgeholten Fassung', () => {
    const v0 = snapshotOf(makeRecord({ finalerText: 'alt-0', denkprozess: 'Gedanke v0' }));
    const record = makeRecord({ finalerText: 'aktuell', denkprozess: 'Gedanke aktuell', verlauf: [v0] });
    const restored = restoreVersion(record, 0);
    expect(restored.denkprozess).toBe('Gedanke v0');
    // die bisher aktive Fassung (inkl. ihres Denkprozesses) wandert in den Verlauf
    const verlauf = restored.verlauf ?? [];
    expect(verlauf[verlauf.length - 1]?.denkprozess).toBe('Gedanke aktuell');
  });
});
