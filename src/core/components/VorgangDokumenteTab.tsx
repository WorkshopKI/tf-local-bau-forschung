import { Badge, FileDropZone, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useDokumenteStore } from '@/plugins/dokumente/store';
import { DocConverter } from '@/core/services/converter';

const converter = new DocConverter();

interface VorgangDokumenteTabProps {
  vorgangId: string;
}

export function VorgangDokumenteTab({ vorgangId }: VorgangDokumenteTabProps): React.ReactElement {
  const storage = useStorage();
  const { documents, add } = useDokumenteStore();
  const vorgangDocs = documents.filter(d => d.vorgangId === vorgangId);

  const handleFiles = async (files: File[]): Promise<void> => {
    for (const file of files) {
      try {
        const r = await converter.convert(file);
        await add({ filename: r.filename, format: r.format, markdown: r.markdown, tags: [], vorgangId }, storage);
      } catch (err) {
        console.error('Conversion failed:', err);
      }
    }
  };

  return (
    <div className="space-y-4">
      <FileDropZone onFiles={handleFiles} accept=".docx,.pdf,.md,.txt" multiple />
      {vorgangDocs.length > 0 ? (
        <div>
          <SectionHeader label="Zugeordnete Dokumente" />
          {vorgangDocs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
              <Badge variant="info">{(doc.format ?? '').toUpperCase()}</Badge>
              <span className="text-[13px] text-[var(--tf-text)]">{doc.filename}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--tf-text-secondary)]">Noch keine Dokumente zugeordnet</p>
      )}
    </div>
  );
}
