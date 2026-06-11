import { describe, it, expect } from 'vitest';
import { memRoot } from '@/core/services/infrastructure/__tests__/mem-fs';
import {
  writeDokumentMarkdown, readVbAusOrdner, writeManifest, readManifest,
  listEingangBundles, deleteEingangBundle, copyZipToEingang,
} from '../antraege-eingang';
import { leeresManifest, setDateiStatus } from '@/plugins/antraege/aufnahme-einfach/manifest';
import type { DokumentMeta } from '@/plugins/antraege/aufnahme-einfach/frontmatter';

const vbMeta = (fkz: string, am: string): DokumentMeta => ({
  fkz, typ: 'vorhabensbeschreibung', quelle: `VB-${fkz}.pdf`, konvertiert_am: am,
});

describe('antraege-eingang', () => {
  it('schreibt Dokument-MD und findet VB per Frontmatter zurück', async () => {
    const root = memRoot();
    await writeDokumentMarkdown(root, '16EP001234', vbMeta('16EP001234', '2026-06-11T10:00:00.000Z'), '# VB\n\nInhalt');
    const vb = await readVbAusOrdner(root, ['16EP001234']);
    expect(vb?.markdown).toContain('# VB');
    expect(vb?.fkz).toBe('16EP001234');
  });

  it('readVbAusOrdner nimmt die jüngste VB über mehrere knownIds', async () => {
    const root = memRoot();
    await writeDokumentMarkdown(root, '16EP000001', vbMeta('16EP000001', '2026-06-10T08:00:00.000Z'), 'alt');
    await writeDokumentMarkdown(root, '16EP000002', vbMeta('16EP000002', '2026-06-11T09:00:00.000Z'), 'neu');
    const vb = await readVbAusOrdner(root, ['16EP000001', '16EP000002']);
    expect(vb?.markdown).toBe('neu');
    expect(vb?.fkz).toBe('16EP000002');
  });

  it('ignoriert Nicht-VB-Dokumente', async () => {
    const root = memRoot();
    await writeDokumentMarkdown(root, '16EP000003',
      { fkz: '16EP000003', typ: 'stellungnahme', quelle: 'S.pdf', konvertiert_am: '2026-06-11T10:00:00.000Z' }, 'x');
    expect(await readVbAusOrdner(root, ['16EP000003'])).toBeNull();
  });

  it('Manifest schreiben/lesen + Bundle löschen', async () => {
    const root = memRoot();
    let m = leeresManifest('paket', ['a.pdf', 'b.pdf']);
    m = setDateiStatus(m, 'a.pdf', 'konvertiert');
    await copyZipToEingang(root, 'paket', new Blob(['zipbytes']));
    await writeManifest(root, m);
    expect((await readManifest(root, 'paket'))?.dateien.find(d => d.name === 'a.pdf')?.status).toBe('konvertiert');
    expect((await listEingangBundles(root)).map(x => x.zipname)).toEqual(['paket']);
    await deleteEingangBundle(root, 'paket');
    expect(await listEingangBundles(root)).toEqual([]);
  });
});
