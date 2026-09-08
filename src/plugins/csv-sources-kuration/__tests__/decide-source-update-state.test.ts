/**
 * `decideSourceUpdateState` entscheidet up_to_date vs. update_available für eine
 * aufgelöste Quelldatei. Kernregel (Fix für den Cold-Start-Fehlalarm auf der pl):
 * wenn die mtime-Baseline (`source_last_modified`) fehlt oder die Datei laut mtime
 * „neuer" ist, wird per INHALT (`file_checksum`, SHA-1 der Rohbytes) bestätigt —
 * mtime ist über die Snapshot-Grenze nicht portabel, der Inhalts-Hash schon.
 */
import { describe, it, expect } from 'vitest';
import { decideSourceUpdateState } from '../csv-source-handle';
import { sha1Hex } from '@/core/services/csv/sha1';
import type { CsvSchema } from '@/core/services/csv/types';
import type { LokalerImportStempel } from '@/core/services/csv/lokaler-stempel';

const CONTENT = 'AZ;Titel\n16KN1;Projekt A\n';

function makeSchema(over: Partial<CsvSchema> = {}): CsvSchema {
  return {
    id: 'schema-1',
    programm_id: 'p1',
    csv_source_name: '9052_PrjBsp',
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 50,
    column_mapping: { AZ: { canonical: 'aktenzeichen' } },
    encoding: 'windows-1252',
    separator: ';',
    created_at: '2026-06-03T00:00:00.000Z',
    ...over,
  };
}

function makeFile(content: string, lastModified: number): File {
  return new File([content], 'quelle.csv', { type: 'text/csv', lastModified });
}

describe('decideSourceUpdateState', () => {
  it('byte-gleiche Datei + fehlende Baseline (undefined) → up_to_date via file_checksum', async () => {
    const checksum = await sha1Hex(new Blob([CONTENT]));
    const schema = makeSchema({ file_checksum: checksum, source_last_modified: undefined });
    // mtime „neu", aber Inhalt identisch → KEIN Fehlalarm (das war der Bug).
    const r = await decideSourceUpdateState(makeFile(CONTENT, 1_800_000_000_000), schema, 'quelle.csv');
    expect(r.state).toBe('up_to_date');
  });

  it('inhaltlich geänderte Datei → update_available', async () => {
    const checksum = await sha1Hex(new Blob([CONTENT]));
    const schema = makeSchema({ file_checksum: checksum, source_last_modified: undefined });
    const r = await decideSourceUpdateState(makeFile(CONTENT + '16KN2;Projekt B\n', 1_800_000_000_000), schema, 'quelle.csv');
    expect(r.state).toBe('update_available');
  });

  it('mtime <= Baseline UND Größe unverändert → up_to_date über den billigen Fast-Path (kein Inhalts-Read)', async () => {
    // file_checksum bewusst falsch: greift der Fast-Path (mtime + size), wird er nie gelesen.
    const file = makeFile(CONTENT, 1_900_000_000_000);
    const schema = makeSchema({
      file_checksum: 'deadbeef',
      source_last_modified: 2_000_000_000_000,
      last_file_size: file.size,
    });
    const r = await decideSourceUpdateState(file, schema, 'quelle.csv');
    expect(r.state).toBe('up_to_date');
  });

  it('kein file_checksum + mtime neuer/keine Baseline → update_available (sicherer Default)', async () => {
    const schema = makeSchema({ file_checksum: undefined, source_last_modified: undefined });
    const r = await decideSourceUpdateState(makeFile(CONTENT, 1_800_000_000_000), schema, 'quelle.csv');
    expect(r.state).toBe('update_available');
  });

  // Citrix-False-Negative (v2.137): die nächtlich neu geschriebene CSV trägt eine
  // mtime, die NICHT über die (per Snapshot gereiste, nicht-portable) Baseline
  // hinausgeht. Der reine mtime-Fast-Path verschluckte die Inhaltsänderung. Der
  // Size-Guard zwingt bei abweichender Byte-Größe in den autoritativen Hash-Pfad.
  it('mtime <= Baseline + geänderte Größe + geänderter Inhalt → update_available', async () => {
    const original = makeFile(CONTENT, 1_900_000_000_000);
    const checksum = await sha1Hex(new Blob([CONTENT]));
    const schema = makeSchema({
      file_checksum: checksum,
      source_last_modified: 2_000_000_000_000,
      last_file_size: original.size,
    });
    // mtime NICHT fortgeschritten (<= Baseline), aber Inhalt + Größe geändert.
    const changed = makeFile(CONTENT + '16KN2;Projekt B\n', 1_800_000_000_000);
    const r = await decideSourceUpdateState(changed, schema, 'quelle.csv');
    expect(r.state).toBe('update_available');
  });

  // Übergang: Alt-Schema ohne last_file_size + mtime <= Baseline + Inhalt gleich →
  // fällt einmalig in den Hash-Pfad und bestätigt up_to_date (kein Fehlalarm).
  it('mtime <= Baseline + last_file_size fehlt + Inhalt gleich → up_to_date via Hash', async () => {
    const checksum = await sha1Hex(new Blob([CONTENT]));
    const schema = makeSchema({ file_checksum: checksum, source_last_modified: 2_000_000_000_000 });
    const r = await decideSourceUpdateState(makeFile(CONTENT, 1_900_000_000_000), schema, 'quelle.csv');
    expect(r.state).toBe('up_to_date');
  });

  // „Erzwungen neu prüfen" (v2.155): der Selbstbedienungs-Weg für pl gegen einen
  // Citrix-False-Negative. Umgeht mtime/Größe/Checksum KOMPLETT → jede aufgelöste
  // Datei wird zum Kandidaten, auch wenn sie sonst als „unverändert" gälte.
  it('forceRecheck → update_available trotz mtime<=Baseline + gleiche Größe + gleichem Checksum', async () => {
    const file = makeFile(CONTENT, 1_900_000_000_000);
    const checksum = await sha1Hex(new Blob([CONTENT]));
    const schema = makeSchema({
      file_checksum: checksum,
      source_last_modified: 2_000_000_000_000,
      last_file_size: file.size,
    });
    // Ohne force wäre das up_to_date (Fast-Path). Mit force → Kandidat.
    const baseline = await decideSourceUpdateState(file, schema, 'quelle.csv');
    expect(baseline.state).toBe('up_to_date');
    const forced = await decideSourceUpdateState(file, schema, 'quelle.csv', { forceRecheck: true });
    expect(forced.state).toBe('update_available');
  });
});

/**
 * Lokaler Import-Stempel (Sept. 2026, Produktiv-Fall): der Snapshot-Sync ersetzt
 * `source_last_modified`/`last_file_size`/`file_checksum` im Schema durch die
 * Sicht des Rechners, der zuletzt publiziert hat. Sieht der die Quelle anders
 * (andere Kopie, andere Kodierung, Citrix-mtime), gilt die eigene, längst
 * importierte Datei bei jedem Start wieder als „neu" — Import, Publish, und beim
 * anderen Rechner dasselbe Spiel. Der lokale Beleg „DIESER Rechner hat DIESE
 * Datei importiert" reist nie über den Share und bricht die Kette.
 */
function machLokal(file: File, checksum: string, over: Partial<LokalerImportStempel> = {}): LokalerImportStempel {
  return {
    fileName: file.name,
    lastModified: file.lastModified,
    size: file.size,
    checksum,
    importedAt: '2026-09-08T05:00:00.000Z',
    ...over,
  };
}

describe('decideSourceUpdateState — lokaler Import-Stempel', () => {
  it('fremder Team-Stempel, eigene Datei längst importiert (mtime + Größe) → up_to_date aus dem lokalen Beleg', async () => {
    const file = makeFile(CONTENT, 1_900_000_000_000);
    // Der Team-Stempel beschreibt eine ANDERE Datei: älter, andere Größe, anderer Inhalt.
    const schema = makeSchema({
      file_checksum: 'fremder-checksum',
      source_last_modified: 1_800_000_000_000,
      last_file_size: file.size + 40,
    });
    const r = await decideSourceUpdateState(file, schema, 'quelle.csv', { lokal: machLokal(file, 'egal') });
    expect(r).toMatchObject({ state: 'up_to_date', quelle: 'lokal' });
  });

  it('lokaler Beleg per Inhalt: mtime neuer, Bytes gleich → up_to_date (lokal)', async () => {
    const file = makeFile(CONTENT, 1_900_000_000_000);
    const checksum = await sha1Hex(new Blob([CONTENT]));
    const schema = makeSchema({ file_checksum: 'fremder-checksum', source_last_modified: 1_800_000_000_000 });
    const lokal = machLokal(file, checksum, { lastModified: 1_850_000_000_000 });
    const r = await decideSourceUpdateState(file, schema, 'quelle.csv', { lokal });
    expect(r).toMatchObject({ state: 'up_to_date', quelle: 'lokal', checksum });
  });

  it('lokaler Beleg passt nicht, Team-Stempel passt → up_to_date (team)', async () => {
    const file = makeFile(CONTENT, 1_900_000_000_000);
    const checksum = await sha1Hex(new Blob([CONTENT]));
    const schema = makeSchema({ file_checksum: checksum, source_last_modified: undefined });
    const lokal = machLokal(file, 'alter-eigener-import', { size: file.size + 7, lastModified: 1_000 });
    const r = await decideSourceUpdateState(file, schema, 'quelle.csv', { lokal });
    expect(r).toMatchObject({ state: 'up_to_date', quelle: 'team', checksum });
  });

  it('weder lokal noch Team → update_available, mit Grund und beiden Sichten', async () => {
    const file = makeFile(CONTENT, 1_900_000_000_000);
    const schema = makeSchema({
      file_checksum: 'team-sha',
      source_last_modified: 1_800_000_000_000,
      last_file_size: 999,
    });
    const lokal = machLokal(file, 'alter-eigener-import', { size: file.size + 7, lastModified: 1_000 });
    const r = await decideSourceUpdateState(file, schema, 'quelle.csv', { lokal });
    expect(r).toMatchObject({
      state: 'update_available',
      grund: 'checksum',
      datei: { name: 'quelle.csv', lastModified: 1_900_000_000_000, size: file.size },
      teamStempel: { lastModified: 1_800_000_000_000, size: 999, checksum: 'team-sha' },
    });
  });

  it('ohne jede Baseline → grund keine-baseline', async () => {
    const r = await decideSourceUpdateState(makeFile(CONTENT, 1_900_000_000_000), makeSchema(), 'quelle.csv');
    expect(r).toMatchObject({
      state: 'update_available',
      grund: 'keine-baseline',
      teamStempel: { lastModified: null, size: null, checksum: null },
    });
  });

  it('forceRecheck übergeht auch den lokalen Beleg', async () => {
    const file = makeFile(CONTENT, 1_900_000_000_000);
    const r = await decideSourceUpdateState(file, makeSchema(), 'quelle.csv', {
      forceRecheck: true,
      lokal: machLokal(file, 'egal'),
    });
    expect(r).toMatchObject({ state: 'update_available', grund: 'erzwungen' });
  });
});
