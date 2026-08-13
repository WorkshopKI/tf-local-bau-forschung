/**
 * Der Header-Fallback darf keine FREMDE CSV an ein Schema binden.
 *
 * Der Ordner-Link ist der empfohlene Weg; er löscht die Per-Datei-Handles.
 * Scheitert `getFileHandle` ein einziges Mal (Datei fehlt, umbenannt, gerade in
 * Bearbeitung, Groß-/Kleinschreibung), griff der Header-Fallback — und der nahm
 * JEDE `.csv` mit `score > 0`, also mit auch nur einer bekannten Spalte.
 *
 * Das ist keine theoretische Lücke: die drei C16-Quellen teilen ihren
 * Spaltenvorrat. Gemessen über alle 9 Schema/Datei-Paare der Fixtures matchen
 * fremde Dateien 14–20 von 21–24 gemappten Spalten — jede läge weit über
 * `score > 0`. Der Notnagel wurde zusätzlich als Self-Heal in die lokale
 * Filemap geschrieben, und weil der schnelle Pfad `knownFileName` VOR
 * `schema.source_file_name` probierte, gewann die Fehlbindung dauerhaft — auch
 * wenn die richtige Datei am nächsten Tag zurück war.
 *
 * Zwei Regeln daher: der Fallback überzeugt nur, wenn KEINE Schema-Spalte
 * fehlt (und genau eine Datei das schafft), und der im Schema hinterlegte
 * Dateiname schlägt die lokale Filemap, sobald es ihn wirklich gibt.
 */
import { describe, it, expect } from 'vitest';
import { resolveFileViaDir } from '../csv-source-handle';
import type { ColumnMapping, CsvSchema } from '@/core/services/csv/types';

function schema(mapping: ColumnMapping, sourceFileName?: string): CsvSchema {
  return {
    id: 's-bgl', programm_id: 'p', csv_source_name: 'Bewilligungsdetails', is_master: false,
    priority: 40, join_key: 'aktenzeichen', column_mapping: mapping,
    encoding: 'UTF-8', separator: ';', source_file_name: sourceFileName,
    created_at: '2026-01-01T00:00:00.000Z',
  } as CsvSchema;
}

const BGL = schema({
  FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
  D_VBE: { type: 'date' },
  ZTP_KUERZ: { type: 'string' },
  TIB_MAIL: { type: 'string' },
});

/** Minimaler Verzeichnis-Handle: Name → Kopfzeile. */
function dir(dateien: Record<string, string>): FileSystemDirectoryHandle {
  const eintraege = Object.entries(dateien).map(([name, kopf]) => {
    const file = new File([`${kopf}\n`], name, { type: 'text/csv' });
    const handle = { kind: 'file' as const, name, getFile: async () => file };
    return [name, handle] as const;
  });
  const d = {
    kind: 'directory' as const,
    async getFileHandle(name: string) {
      const treffer = eintraege.find(([n]) => n === name);
      if (!treffer) {
        const e = new Error('NotFound');
        e.name = 'NotFoundError';
        throw e;
      }
      return treffer[1];
    },
    [Symbol.asyncIterator]: async function* () {
      for (const e of eintraege) yield e;
    },
  };
  return d as unknown as FileSystemDirectoryHandle;
}

const BGL_KOPF = 'FKZ;D_VBE;ZTP_KUERZ;TIB_MAIL';
/** Der Master teilt sich den Spaltenvorrat, führt aber nicht alle Spalten. */
const ANB_KOPF = 'FKZ;D_VBE;ZTP_KUERZ;STATUS_TV;THEMA_AD';

describe('resolveFileViaDir: der Header-Fallback muss überzeugen', () => {
  it('nimmt NICHT die fremde Datei, nur weil sie viele Spalten teilt', async () => {
    const treffer = await resolveFileViaDir(dir({ 'sample_9097_AnB.csv': ANB_KOPF }), BGL);
    expect(treffer).toBeNull();
  });

  it('nimmt die Datei, die alle Schema-Spalten führt', async () => {
    const treffer = await resolveFileViaDir(
      dir({ 'sample_9097_AnB.csv': ANB_KOPF, 'sample_7737_Bgl.csv': BGL_KOPF }), BGL,
    );
    expect(treffer?.fileName).toBe('sample_7737_Bgl.csv');
  });

  it('bleibt bei zwei gleich guten Kandidaten lieber ohne Ergebnis', async () => {
    // „Datei fehlt" ist eine reparierbare Meldung, eine Fehlbindung nicht.
    const treffer = await resolveFileViaDir(
      dir({ 'a.csv': BGL_KOPF, 'b.csv': BGL_KOPF }), BGL,
    );
    expect(treffer).toBeNull();
  });
});

describe('resolveFileViaDir: der Schema-Dateiname schlägt die lokale Filemap', () => {
  it('nimmt source_file_name, wenn es die Datei gibt — auch mit gesetzter Filemap', async () => {
    const treffer = await resolveFileViaDir(
      dir({ 'sample_7737_Bgl.csv': BGL_KOPF, 'sample_9097_AnB.csv': ANB_KOPF }),
      schema(BGL.column_mapping, 'sample_7737_Bgl.csv'),
      'sample_9097_AnB.csv', // alte Fehlbindung aus der Filemap
    );
    expect(treffer?.fileName).toBe('sample_7737_Bgl.csv');
  });

  it('fällt auf die Filemap zurück, wenn das Schema keinen Dateinamen führt', async () => {
    const treffer = await resolveFileViaDir(
      dir({ 'sample_7737_Bgl.csv': BGL_KOPF }), BGL, 'sample_7737_Bgl.csv',
    );
    expect(treffer?.fileName).toBe('sample_7737_Bgl.csv');
  });
});
