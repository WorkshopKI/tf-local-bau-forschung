import { describe, it, expect } from 'vitest';
import {
  dokumenteDir, dokumentMdPath, gutachtenMdPath, eingangZipPath, eingangManifestPath,
  mdFilename, sanitizeSegment,
} from '../personal-layout';

describe('personal-layout', () => {
  it('nestet unter ZAH/', () => {
    expect(dokumenteDir('16EP001234')).toBe('ZAH/antraege/16EP001234/dokumente');
    expect(eingangZipPath('paket')).toBe('ZAH/eingang/paket.zip');
    expect(eingangManifestPath('paket')).toBe('ZAH/eingang/paket.manifest.json');
  });

  it('mdFilename ersetzt nur die Endung, behält den Stamm', () => {
    expect(mdFilename('Vorhabensbeschreibung.pdf')).toBe('Vorhabensbeschreibung.md');
    expect(mdFilename('Anlage 3.DOCX')).toBe('Anlage 3.md');
    expect(mdFilename('ohne-endung')).toBe('ohne-endung.md');
  });

  it('sanitiert unzulässige Pfadzeichen', () => {
    expect(sanitizeSegment('a/b:c\\d*?')).toBe('a_b_c_d__');
    expect(mdFilename('te/st.pdf')).toBe('te_st.md');
  });

  it('gutachtenMdPath: {stepId}-{slug}.md', () => {
    expect(gutachtenMdPath('16EP001234', 'A', 'kurzfassung')).toBe(
      'ZAH/antraege/16EP001234/gutachten/A-kurzfassung.md');
  });
});
