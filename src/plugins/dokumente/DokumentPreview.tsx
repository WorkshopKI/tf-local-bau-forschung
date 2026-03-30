import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button, Badge, MarkdownRenderer, TagInput } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useTags } from '@/core/hooks/useTags';
import { useDokumenteStore } from './store';

export function DokumentPreview(): React.ReactElement | null {
  const storage = useStorage();
  const { suggest, addTag } = useTags();
  const { documents, selectedId, setSelectedId, remove, updateTags } = useDokumenteStore();
  const doc = documents.find(d => d.id === selectedId);

  if (!doc) return null;

  const handleTagsChange = (tags: string[]): void => {
    tags.forEach(t => addTag(t));
    updateTags(doc.id, tags, storage);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => setSelectedId(null)}
        className="flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4 cursor-pointer">
        <ArrowLeft size={14} /> Alle Dokumente
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{doc.filename}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="info">{doc.format.toUpperCase()}</Badge>
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">{new Date(doc.created).toLocaleDateString('de-DE')}</span>
          </div>
        </div>
        <Button variant="danger" icon={Trash2} size="sm" onClick={() => remove(doc.id, storage)}>Löschen</Button>
      </div>

      <div className="mb-6">
        <label className="text-[13px] font-medium text-[var(--tf-text)] block mb-1.5">Tags</label>
        <TagInput value={doc.tags} onChange={handleTagsChange} suggestions={suggest} />
      </div>

      <div className="rounded-[var(--tf-radius-lg)] p-6 bg-[var(--tf-bg)]" style={{ border: '0.5px solid var(--tf-border)' }}>
        <MarkdownRenderer content={doc.markdown} />
      </div>
    </div>
  );
}
