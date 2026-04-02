import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button, MarkdownRenderer, TagInput } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useTags } from '@/core/hooks/useTags';
import { useDokumenteStore } from './store';
import type { DocumentFull } from './store';

export function DokumentPreview(): React.ReactElement | null {
  const storage = useStorage();
  const { suggest, addTag } = useTags();
  const { documents, selectedId, setSelectedId, remove, updateTags, loadDocument } = useDokumenteStore();
  const meta = documents.find(d => d.id === selectedId);
  const [full, setFull] = useState<DocumentFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    loadDocument(selectedId, storage).then(doc => {
      setFull(doc);
      setLoading(false);
    });
  }, [selectedId, storage, loadDocument]);

  if (!meta) return null;

  const handleTagsChange = (tags: string[]): void => {
    tags.forEach(t => addTag(t));
    updateTags(meta.id, tags, storage);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => setSelectedId(null)}
        className="flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4 cursor-pointer">
        <ArrowLeft size={14} /> Alle Dokumente
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{meta.filename}</h1>
          <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-1">
            {new Date(meta.created).toLocaleDateString('de-DE')}
            {meta.vorgangId && <> · <span className="font-mono">{meta.vorgangId}</span></>}
          </p>
        </div>
        <Button variant="danger" icon={Trash2} size="sm" onClick={() => remove(meta.id, storage)}>Löschen</Button>
      </div>

      <div className="mb-6">
        <label className="text-[13px] font-medium text-[var(--tf-text)] block mb-1.5">Tags</label>
        <TagInput value={meta.tags} onChange={handleTagsChange} suggestions={suggest} />
      </div>

      {loading ? (
        <p className="text-[13px] text-[var(--tf-text-tertiary)] py-8 text-center">Dokument wird geladen...</p>
      ) : full?.markdown ? (
        <div className="rounded-[var(--tf-radius-lg)] p-6 bg-[var(--tf-bg)]" style={{ border: '0.5px solid var(--tf-border)' }}>
          <MarkdownRenderer content={full.markdown} />
        </div>
      ) : (
        <p className="text-[13px] text-[var(--tf-text-tertiary)] py-8 text-center">Kein Inhalt verfügbar</p>
      )}
    </div>
  );
}
