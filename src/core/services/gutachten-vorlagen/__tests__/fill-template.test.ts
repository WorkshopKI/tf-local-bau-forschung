import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { processDocumentXml, fillTemplate } from '../fill-template';
import type { AbschnittEinfuegung, ArtefaktBlock } from '../types';
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
/** Ein-Abschnitt-Helfer (Kurzfassung A) für die Feld-/Anker-Basistests. */
const A_ONLY: AbschnittEinfuegung[] = [{ id: 'A', anker: 'Kurzfassung der Projektbeschreibung', finalerText: FINAL }];

function p(inner: string): string {
  return `<w:document><w:body>${inner}</w:body></w:document>`;
}

describe('processDocumentXml — Platzhalter-Ersetzung', () => {
  it('ersetzt einen Platzhalter in einem einzelnen Run (roh-&)', () => {
    const xml = p('<w:p><w:r><w:t>&F:VMS AD FKZ&</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, A_ONLY);
    expect(r.xml).toContain('>16EP034512<');
    expect(r.xml).not.toContain('VMS AD FKZ');
    expect(r.mappedFields.find(f => f.code === 'VMS AD FKZ')?.value).toBe('16EP034512');
  });

  it('ersetzt einen Platzhalter in &amp;-Schreibweise (echte Word-XML-Form)', () => {
    const xml = p('<w:p><w:r><w:t>&amp;F:VMS AD FKZ&amp;</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, A_ONLY);
    expect(r.xml).toContain('>16EP034512<');
  });

  it('ersetzt einen über mehrere Runs zersplitterten Platzhalter, rPr bleibt erhalten', () => {
    const xml = p(
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>&F:VMS </w:t></w:r><w:r><w:t>VB Projekt&</w:t></w:r></w:p>',
    );
    const r = processDocumentXml(xml, antrag, A_ONLY);
    // Wert escaped im ersten Run, Platzhalter-Reste weg
    expect(r.xml).toContain('Adaptive Prozess&lt;überwachung&gt; &amp; mehr');
    expect(r.xml).not.toContain('VB Projekt&');
    // Formatierung des ersten Runs unangetastet
    expect(r.xml).toContain('<w:rPr><w:b/></w:rPr>');
  });

  it('escapt XML-Sonderzeichen im Ersatzwert (&, <, >)', () => {
    const xml = p('<w:p><w:r><w:t>&F:VMS VB Projekt&</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, A_ONLY);
    expect(r.xml).toContain('Adaptive Prozess&lt;überwachung&gt; &amp; mehr');
    expect(r.xml).not.toContain('<überwachung>');
  });

  it('lässt unbekannte Codes unverändert und meldet sie als nicht befüllbar', () => {
    const xml = p('<w:p><w:r><w:t>&F:DMS.V.900000120001&</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, A_ONLY);
    expect(r.xml).toContain('DMS.V.900000120001'); // unverändert
    expect(r.unfilledCodes).toContain('DMS.V.900000120001');
    expect(r.mappedFields.find(f => f.code === 'DMS.V.900000120001')?.befuellbar).toBe(false);
  });
});

describe('processDocumentXml — Anker-Einfügung (ein Abschnitt)', () => {
  it('fügt die Kurzfassung direkt nach dem Anker-Absatz ein', () => {
    const xml = p('<w:p><w:r><w:t>Kurzfassung der Projektbeschreibung</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, A_ONLY);
    expect(r.sections[0]!.anchorFound).toBe(true);
    expect(r.eingefuegteAnzahl).toBe(1);
    expect(r.xml).toContain('Das Vorhaben überwacht Prozesse.');
    expect(r.xml).toContain('Es funktioniert dezentral.');
    // Reihenfolge: Anker zuerst, dann eingefügter Text
    expect(r.xml.indexOf('Projektbeschreibung')).toBeLessThan(r.xml.indexOf('Das Vorhaben überwacht'));
  });

  it('findet den Anker auch über Run-Grenzen + zusätzliche Whitespaces hinweg', () => {
    const xml = p(
      '<w:p><w:r><w:t>Kurzfassung der  </w:t></w:r><w:r><w:t>Projektbeschreibung</w:t></w:r></w:p>',
    );
    const r = processDocumentXml(xml, antrag, A_ONLY);
    expect(r.sections[0]!.anchorFound).toBe(true);
  });

  it('lässt die Vorlage ohne Anker unangetastet (anchorFound=false)', () => {
    const xml = p('<w:p><w:r><w:t>Ein anderer Absatz.</w:t></w:r></w:p>');
    const r = processDocumentXml(xml, antrag, A_ONLY);
    expect(r.sections[0]!.anchorFound).toBe(false);
    expect(r.eingefuegteAnzahl).toBe(0);
    expect(r.xml).not.toContain('Das Vorhaben überwacht Prozesse.');
  });
});

describe('processDocumentXml — Mehrfach-Anker', () => {
  /** Vorlage mit Anker B vor A (Dokumentreihenfolge ≠ A–G). */
  const docBvorA = p(
    '<w:p><w:r><w:t>Innovationsgehalt, Chancen und Risiken</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t>Marktchancen</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t>Kurzfassung der Projektbeschreibung</w:t></w:r></w:p>',
  );
  const sections: AbschnittEinfuegung[] = [
    { id: 'A', anker: 'Kurzfassung der Projektbeschreibung', finalerText: 'TEXT-A.' },
    { id: 'B', anker: 'Innovationsgehalt, Chancen und Risiken', finalerText: 'TEXT-B.' },
    { id: 'D', anker: 'Marktchancen', finalerText: 'TEXT-D.' },
  ];

  it('fügt jeden Abschnitt an SEINEM Anker ein — dokument-reihenfolge-unabhängig', () => {
    const r = processDocumentXml(docBvorA, antrag, sections);
    expect(r.eingefuegteAnzahl).toBe(3);
    // Jeder Text steht direkt nach seinem Anker:
    expect(r.xml.indexOf('Innovationsgehalt, Chancen und Risiken')).toBeLessThan(r.xml.indexOf('TEXT-B.'));
    expect(r.xml.indexOf('Marktchancen')).toBeLessThan(r.xml.indexOf('TEXT-D.'));
    expect(r.xml.indexOf('Kurzfassung der Projektbeschreibung')).toBeLessThan(r.xml.indexOf('TEXT-A.'));
    // B-Text steht VOR A-Text (Dokumentreihenfolge B→D→A), nicht in A–G-Reihenfolge:
    expect(r.xml.indexOf('TEXT-B.')).toBeLessThan(r.xml.indexOf('TEXT-A.'));
  });

  it('überspringt einen fehlenden Anker, fügt die übrigen ein', () => {
    const mitFehlend: AbschnittEinfuegung[] = [
      ...sections,
      { id: 'G', anker: 'Gibt es nicht in der Vorlage', finalerText: 'TEXT-G.' },
    ];
    const r = processDocumentXml(docBvorA, antrag, mitFehlend);
    expect(r.eingefuegteAnzahl).toBe(3);
    expect(r.sections.find(s => s.id === 'G')!.anchorFound).toBe(false);
    expect(r.xml).not.toContain('TEXT-G.');
  });

  it('Teil-Freigabe: nur die übergebenen Abschnitte werden eingefügt', () => {
    const r = processDocumentXml(docBvorA, antrag, [sections[1]!]); // nur B
    expect(r.eingefuegteAnzahl).toBe(1);
    expect(r.xml).toContain('TEXT-B.');
    expect(r.xml).not.toContain('TEXT-A.');
    expect(r.xml).not.toContain('TEXT-D.');
  });
});

describe('processDocumentXml — generische ArtefaktBlöcke (offene id)', () => {
  it('fügt einen Block mit Nicht-A–G-id (Baustein-ID) am Anker ein und meldet die id zurück', () => {
    const xml = p('<w:p><w:r><w:t>Nachforderungen</w:t></w:r></w:p>');
    const block: ArtefaktBlock[] = [{ id: 'G1.1', anker: 'Nachforderungen', finalerText: 'Baustein-Text.' }];
    const r = processDocumentXml(xml, antrag, block);
    expect(r.sections[0]!.id).toBe('G1.1');
    expect(r.eingefuegteAnzahl).toBe(1);
    expect(r.xml).toContain('Baustein-Text.');
  });
});

describe('fillTemplate — Audit-Hash + Dateiname je Typ + graceful', () => {
  async function makeDocx(documentXml: string): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file('word/document.xml', documentXml);
    return zip.generateAsync({ type: 'arraybuffer' });
  }
  const A_DOC = '<w:document><w:body><w:p><w:r><w:t>Kurzfassung der Projektbeschreibung</w:t></w:r></w:p></w:body></w:document>';

  it('stempelt einen deterministischen SHA-256-Hash (64 Hex, gleiche Bytes → gleicher Hash)', async () => {
    const buf = await makeDocx(A_DOC);
    const r1 = await fillTemplate(buf, antrag, A_ONLY, { dryRun: true });
    const r2 = await fillTemplate(buf, antrag, A_ONLY, { dryRun: true });
    expect(r1.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r1.hash).toBe(r2.hash);
    expect(r1.fehler).toBeUndefined();
  });

  it('Dateiname richtet sich nach dem Präfix (Default Gutachten_EP, NF eigener Präfix)', async () => {
    const buf = await makeDocx(A_DOC);
    expect((await fillTemplate(buf, antrag, A_ONLY, { dryRun: true })).filename)
      .toBe('Gutachten_EP_16EP034512.docx');
    expect((await fillTemplate(buf, antrag, A_ONLY, { dryRun: true, dateiPrefix: 'ZIM-Nachforderung' })).filename)
      .toBe('ZIM-Nachforderung_16EP034512.docx');
  });

  it('fehlende word/document.xml → fehler statt Throw (kein Blob)', async () => {
    const zip = new JSZip();
    zip.file('something-else.xml', '<x/>');
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const r = await fillTemplate(buf, antrag, A_ONLY, {});
    expect(r.fehler).toContain('word/document.xml');
    expect(r.blob).toBeUndefined();
  });

  it('kaputte Eingabe (kein ZIP) → fehler statt Throw', async () => {
    const r = await fillTemplate(new Uint8Array([1, 2, 3, 4]), antrag, A_ONLY, {});
    expect(r.fehler).toBeTruthy();
    expect(r.blob).toBeUndefined();
  });
});
