import { describe, it, expect } from 'vitest';
import { zipDurchlauf, loseDatei } from '../zip-durchlauf';

async function makeZip(files: Record<string, string>): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const [p, c] of Object.entries(files)) zip.file(p, c);
  return zip.generateAsync({ type: 'blob' });
}

describe('zipDurchlauf', () => {
  it('liefert pdf/docx aus Unterordnern, skippt Müll', async () => {
    const blob = await makeZip({
      'VB.pdf': 'x', 'sub/Anlage.docx': 'y',
      '__MACOSX/._VB.pdf': 'z', '.DS_Store': '', 'Thumbs.db': '',
    });
    const r = await zipDurchlauf(blob);
    expect(r.dateien.map(d => d.name).sort()).toEqual(['Anlage.docx', 'VB.pdf']);
    expect(r.uebersprungen.length).toBeGreaterThan(0);
  });

  it('lehnt .doc ab (Meldung), nimmt aber pdf', async () => {
    const blob = await makeZip({ 'alt.doc': 'x', 'neu.pdf': 'y' });
    const r = await zipDurchlauf(blob);
    expect(r.dateien.map(d => d.name)).toEqual(['neu.pdf']);
    expect(r.abgelehnt.some(a => a.name === 'alt.doc' && /\.doc/.test(a.grund))).toBe(true);
  });

  it('skippt ZIP-in-ZIP und meldet es', async () => {
    const { default: JSZip } = await import('jszip');
    const innerZip = new JSZip();
    innerZip.file('i.pdf', 'a');
    const innerBytes = await innerZip.generateAsync({ type: 'uint8array' });
    const outer = new JSZip();
    outer.file('inner.zip', innerBytes);
    outer.file('ok.pdf', 'b');
    const r = await zipDurchlauf(await outer.generateAsync({ type: 'blob' }));
    expect(r.dateien.map(d => d.name)).toEqual(['ok.pdf']);
    expect(r.uebersprungen.some(u => /inner\.zip/.test(u))).toBe(true);
  });
});

describe('loseDatei', () => {
  it('nimmt pdf/docx, lehnt .doc + Sonstiges ab', () => {
    expect(loseDatei(new File(['x'], 'a.pdf')).dateien.map(d => d.name)).toEqual(['a.pdf']);
    expect(loseDatei(new File(['x'], 'a.doc')).abgelehnt.length).toBe(1);
    expect(loseDatei(new File(['x'], 'a.txt')).abgelehnt.length).toBe(1);
  });
});
