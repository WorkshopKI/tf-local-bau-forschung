import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button, Badge, MarkdownRenderer } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useDokumenteStore } from './store';

export function DokumentPreview(): React.ReactElement | null {
  const storage = useStorage();
  const { documents, selectedId, setSelectedId, remove, updateTags } = useDokumenteStore();
  const doc = documents.find(d => d.id === selectedId);
  const [tagsInput, setTagsInput] = useState(doc?.tags.join(', ') ?? '');

  if (!doc) return null;

  const handleTagsSave = (): void => {
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    updateTags(doc.id, tags, storage);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => setSelectedId(null)}
        className="flex items-center gap-1 text-sm text-[var(--tf-primary)] hover:underline mb-4 cursor-pointer">
        <ArrowLeft size={16} /> Alle Dokumente
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--tf-text)]">{doc.filename}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="info">{doc.format.toUpperCase()}</Badge>
            <span className="text-xs text-[var(--tf-text-secondary)]">
              {new Date(doc.created).toLocaleDateString('de-DE')}
            </span>
          </div>
        </div>
        <Button variant="danger" icon={Trash2} size="sm" onClick={() => { remove(doc.id, storage); }}>
          Löschen
        </Button>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium text-[var(--tf-text)] block mb-1">Tags</label>
        <div className="flex gap-2">
          <input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
            onBlur={handleTagsSave}
            placeholder="Komma-separiert"
            className="flex-1 px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]" />
        </div>
      </div>

      <div className="border border-[var(--tf-border)] rounded-[var(--tf-radius)] p-6 bg-[var(--tf-bg)]">
        <MarkdownRenderer content={doc.markdown} />
      </div>
    </div>
  );
}
