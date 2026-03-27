import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { FileDropZone, Badge, Card } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { DocConverter } from '@/core/services/converter';
import { useDokumenteStore } from './store';

const converter = new DocConverter();

export function DokumenteListe(): React.ReactElement {
  const storage = useStorage();
  const { documents, loadAll, add, setSelectedId } = useDokumenteStore();
  const [converting, setConverting] = useState(false);

  useEffect(() => { loadAll(storage); }, [storage, loadAll]);

  const handleFiles = async (files: File[]): Promise<void> => {
    setConverting(true);
    for (const file of files) {
      try {
        const result = await converter.convert(file);
        await add({
          filename: result.filename,
          format: result.format,
          markdown: result.markdown,
          tags: [],
        }, storage);
      } catch (err) {
        console.error('Conversion failed:', err);
      }
    }
    setConverting(false);
  };

  const formatBadge = (format: string): 'info' | 'success' | 'default' => {
    if (format === 'docx') return 'info';
    if (format === 'md') return 'success';
    return 'default';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-[var(--tf-text)] mb-6">Dokumente</h1>

      <FileDropZone onFiles={handleFiles} accept=".docx,.md,.txt" multiple>
        {converting ? (
          <p className="text-sm text-[var(--tf-primary)]">Konvertiere...</p>
        ) : undefined}
      </FileDropZone>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={48} className="text-[var(--tf-text-secondary)] mb-4" />
          <p className="text-lg text-[var(--tf-text-secondary)]">Noch keine Dokumente</p>
          <p className="text-sm text-[var(--tf-text-secondary)]">Dateien oben ablegen zum Importieren</p>
        </div>
      ) : (
        <div className="space-y-3 mt-6">
          {documents.map(doc => (
            <Card key={doc.id} className="cursor-pointer hover:border-[var(--tf-primary)] transition-colors">
              <div onClick={() => setSelectedId(doc.id)} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-[var(--tf-text-secondary)]" />
                  <span className="text-sm font-medium text-[var(--tf-text)]">{doc.filename}</span>
                  <Badge variant={formatBadge(doc.format)}>{doc.format.toUpperCase()}</Badge>
                </div>
                <span className="text-xs text-[var(--tf-text-secondary)]">
                  {new Date(doc.created).toLocaleDateString('de-DE')}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
