/**
 * End-to-End des Word-Imports: eine im Speicher gebaute `.docx` läuft durch das
 * ECHTE mammoth und dann die Heuristik. Beweist, dass die Zerlegung genuines
 * mammoth-HTML verträgt (Heading-Styles, Entities) — die reine Heuristik prüft
 * `wordImport.test.ts` gegen HTML-Strings separat.
 *
 * mammoth wird hier DIREKT mit einem Node-Buffer aufgerufen: die Vitest-Umgebung
 * ist node, dort nimmt mammoth `{ buffer }`. Der App-Wrapper `mammothZuHtml` nutzt
 * bewusst `{ arrayBuffer }` (Browser-Runtime, wie `converter/index.ts`) und wird
 * darum nicht in dieser node-Umgebung getestet.
 *
 * Die `.docx` wird mit JSZip aus dem Minimal-OOXML-Gerüst gebaut (Heading1 +
 * Absätze), damit kein Binär-Fixture im Repo liegen muss.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { bausteinKandidaten } from '../wordImport';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** Absatz mit optionalem Heading-Style. */
function p(text: string, heading?: boolean): string {
  const style = heading ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' : '';
  return `<w:p>${style}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${p('G1.1 Zur geplanten Entwicklung', true)}
${p('Bitte erläutern Sie {das / die} Verfahren mit x €.')}
${p('T2.3.7 Kostenplan', true)}
${p('Bitte legen Sie den Kostenplan vor.')}
</w:body>
</w:document>`;

async function baueDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/document.xml', DOCUMENT);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('Word-Import end-to-end', () => {
  it('liest eine .docx über mammoth und erzeugt kategorisierbare Kandidaten', async () => {
    const buffer = await baueDocx();
    const { value: html } = await mammoth.convertToHtml({ buffer });
    const kandidaten = bausteinKandidaten(html, 'nf');
    expect(kandidaten).toHaveLength(2);
    expect(kandidaten[0]).toMatchObject({ id: 'G1.1', thema: 'Zur geplanten Entwicklung', scope: 'verbund' });
    expect(kandidaten[0]!.text).toContain('{das / die}'); // verbatim
    expect(kandidaten[1]).toMatchObject({ id: 'T2.3.7', scope: 'tv' });
  });
});
