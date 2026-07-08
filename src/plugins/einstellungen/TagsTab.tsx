import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListItem } from '@/components/ui/ListItem';
import { useStorage } from '@/core/hooks/useStorage';
import { useTags } from '@/core/hooks/useTags';
import { SettingsSectionHeader } from './_shared/settings-primitives';

export function TagsTab(): React.ReactElement {
  const { allTags, removeTag, renameTag, recountTags } = useTags();
  const storage = useStorage();
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleRecount = async (): Promise<void> => {
    const vKeys = await storage.idb.keys('vorgang:');
    const dKeys = await storage.idb.keys('doc:');
    const allTagNames: string[] = [];
    for (const k of vKeys) {
      const v = await storage.idb.get<{ tags: string[] }>(k);
      if (v?.tags) allTagNames.push(...v.tags);
    }
    for (const k of dKeys) {
      const d = await storage.idb.get<{ tags: string[] }>(k);
      if (d?.tags) allTagNames.push(...d.tags);
    }
    recountTags(allTagNames);
  };

  return (
    <section id="sec-tags" className="scroll-mt-20 space-y-4">
      <SettingsSectionHeader
        label="Tags"
        action={<button type="button" onClick={handleRecount} className="text-[12px] font-medium text-[var(--tf-primary)] hover:underline cursor-pointer">Neu zählen</button>}
      />
      {allTags.length === 0 ? (
        <p className="text-[13px] text-[var(--tf-text-tertiary)]">Noch keine Tags vorhanden — Tags entstehen beim Arbeiten an Anträgen.</p>
      ) : (
        allTags.map((tag, i) => (
          <ListItem key={tag.name}
            title={editingTag === tag.name ? '' : tag.name}
            subtitle={editingTag === tag.name ? undefined : `${tag.count} Verwendungen`}
            meta={editingTag === tag.name ? (
              <div className="flex items-center gap-2">
                <input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                  className="px-2 py-1 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none w-32"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                  onKeyDown={e => { if (e.key === 'Enter') { renameTag(tag.name, editValue); setEditingTag(null); } }} />
                <Button variant="ghost" size="sm" onClick={() => { renameTag(tag.name, editValue); setEditingTag(null); }}>OK</Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Badge variant="default">{tag.count}</Badge>
                <button onClick={() => { setEditingTag(tag.name); setEditValue(tag.name); }} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"><Pencil size={12} /></button>
                {tag.count === 0 && <button onClick={() => removeTag(tag.name)} className="p-1 text-[var(--tf-danger-text)] cursor-pointer"><Trash2 size={12} /></button>}
              </div>
            )}
            last={i === allTags.length - 1}
          />
        ))
      )}
    </section>
  );
}
