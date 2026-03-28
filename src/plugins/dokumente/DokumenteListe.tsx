import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { FileDropZone, Badge, SectionHeader, ListItem } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { DocConverter } from '@/core/services/converter';
import { useDokumenteStore } from './store';

const converter = new DocConverter();

export function DokumenteListe(): React.ReactElement {
  const storage = useStorage();
  const { indexDocument } = useSearch();
  const { documents, loadAll, add, setSelectedId } = useDokumenteStore();
  const [converting, setConverting] = useState(false);

  useEffect(() => { loadAll(storage); }, [storage, loadAll]);

  const handleFiles = async (files: File[]): Promise<void> => {
    setConverting(true);
    for (const file of files) {
      try {
        const result = await converter.convert(file);
        await add({ filename: result.filename, format: result.format, markdown: result.markdown, tags: [], pages: result.pages }, storage);
        indexDocument({ id: `doc-${Date.now()}`, text: result.markdown, title: result.filename, source: result.filename, tags: [], type: 'dokument' });
      } catch (err) { console.error('Conversion failed:', err); }
    }
    setConverting(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-6">Dokumente</h1>

      <FileDropZone onFiles={handleFiles} accept=".docx,.pdf,.md,.txt" multiple>
        {converting ? <p className="text-[13px] text-[var(--tf-text-secondary)]">Konvertiere...</p> : undefined}
      </FileDropZone>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={40} className="text-[var(--tf-text-tertiary)] mb-4" />
          <p className="text-[var(--tf-text-secondary)]">Noch keine Dokumente</p>
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">Dateien oben ablegen zum Importieren</p>
        </div>
      ) : (
        <div className="mt-6">
          <SectionHeader label="Importierte Dokumente" />
          {documents.map((doc, i) => (
            <ListItem
              key={doc.id}
              icon={<FileText size={14} className="text-[var(--tf-text-tertiary)]" />}
              title={doc.filename}
              meta={
                <>
                  <Badge variant={doc.format === 'pdf' ? 'error' : doc.format === 'docx' ? 'info' : doc.format === 'md' ? 'success' : 'default'}>
                    {doc.format === 'pdf' && doc.pages ? `PDF · ${doc.pages} Seiten` : doc.format.toUpperCase()}
                  </Badge>
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">{new Date(doc.created).toLocaleDateString('de-DE')}</span>
                </>
              }
              onClick={() => setSelectedId(doc.id)}
              last={i === documents.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
