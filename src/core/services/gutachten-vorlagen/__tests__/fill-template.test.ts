import { describe, it, expect } from 'vitest';
import { processDocumentXml } from '../fill-template';
import type { Antrag } from '@/core/services/csv/types';

const antrag: Antrag = {
  aktenzeichen: '16EP034512',
  programm_id: 'zim',
  titel: 'Adaptive Prozess<überwachung> & mehr',
  antragsteller: 'ACME-Sensorik GmbH',
  _field_sources: {},
  _updated_at: '2026-01-01T00:00:00.000Z',
};

const FINAL = 'Das Vorhaben überwacht Prozesse.\n\nEs funktioniert dezentral.';

function p(inner: string): string {
  return `<w:document><w:body>${inner}</w:body></w:document>`;
}

describe('processDocumentXml — Platzhalter-Ersetzung', () => {
  it('ersetzt einen Platzhalter in einem einzelnen Run (roh-&)', () => {
    const xml = p('<w:p><w:r><w:t>&F:VMS AD FKZ&</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, FINAL);
    expect(r.xml).toContain('>16EP034512<');
    expect(r.xml).not.toContain('VMS AD FKZ');
    expect(r.mappedFields.find(f => f.code === 'VMS AD FKZ')?.value).toBe('16EP034512');
  });

  it('ersetzt einen Platzhalter in &amp;-Schreibweise (echte Word-XML-Form)', () => {
    const xml = p('<w:p><w:r><w:t>&amp;F:VMS AD FKZ&amp;</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, FINAL);
    expect(r.xml).toContain('>16EP034512<');
  });

  it('ersetzt einen über mehrere Runs zersplitterten Platzhalter, rPr bleibt erhalten', () => {
    const xml = p(
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>&F:VMS </w:t></w:r><w:r><w:t>VB Projekt&</w:t></w:r></w:p>',
    );
    const r = processDocumentXml(xml, antrag, FINAL);
    // Wert escaped im ersten Run, Platzhalter-Reste weg
    expect(r.xml).toContain('Adaptive Prozess&lt;überwachung&gt; &amp; mehr');
    expect(r.xml).not.toContain('VB Projekt&');
    // Formatierung des ersten Runs unangetastet
    expect(r.xml).toContain('<w:rPr><w:b/></w:rPr>');
  });

  it('escapt XML-Sonderzeichen im Ersatzwert (&, <, >)', () => {
    const xml = p('<w:p><w:r><w:t>&F:VMS VB Projekt&</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, FINAL);
    expect(r.xml).toContain('Adaptive Prozess&lt;überwachung&gt; &amp; mehr');
    expect(r.xml).not.toContain('<überwachung>');
  });

  it('lässt unbekannte Codes unverändert und meldet sie als nicht befüllbar', () => {
    const xml = p('<w:p><w:r><w:t>&F:DMS.V.900000120001&</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, FINAL);
    expect(r.xml).toContain('DMS.V.900000120001'); // unverändert
    expect(r.unfilledCodes).toContain('DMS.V.900000120001');
    expect(r.mappedFields.find(f => f.code === 'DMS.V.900000120001')?.befuellbar).toBe(false);
  });
});

describe('processDocumentXml — Anker-Einfügung', () => {
  it('fügt die Kurzfassung direkt nach dem Anker-Absatz ein', () => {
    const xml = p('<w:p><w:r><w:t>Kurzfassung der Projektbeschreibung</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, FINAL);
    expect(r.anchorFound).toBe(true);
    expect(r.xml).toContain('Das Vorhaben überwacht Prozesse.');
    expect(r.xml).toContain('Es funktioniert dezentral.');
    // Reihenfolge: Anker zuerst, dann eingefügter Text
    expect(r.xml.indexOf('Projektbeschreibung')).toBeLessThan(r.xml.indexOf('Das Vorhaben überwacht'));
  });

  it('findet den Anker auch über Run-Grenzen + zusätzliche Whitespaces hinweg', () => {
    const xml = p(
      '<w:p><w:r><w:t>Kurzfassung der  </w:t></w:r><w:r><w:t>Projektbeschreibung</w:t></w:r></w:p>',
    );
    const r = processDocumentXml(xml, antrag, FINAL);
    expect(r.anchorFound).toBe(true);
  });

  it('lässt die Vorlage ohne Anker unangetastet (anchorFound=false)', () => {
    const xml = p('<w:p><w:r><w:t>Ein anderer Absatz.</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, FINAL);
    expect(r.anchorFound).toBe(false);
    expect(r.xml).not.toContain('Das Vorhaben überwacht Prozesse.');
  });
});
