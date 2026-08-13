/**
 * Gruppe „Tags" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 10, rechte Spalte).
 *
 * Tags entstehen beim Arbeiten an Anträgen; hier lassen sie sich umbenennen,
 * löschen (nur ungenutzte) und neu zählen. Die Liste steht in der Klappe —
 * sichtbar bleibt, wie viele es sind.
 */
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListItem } from '@/components/ui/ListItem';
import { useStorage } from '@/core/hooks/useStorage';
import { useTags } from '@/core/hooks/useTags';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  SettingsGruppe,
  SettingsGruppenAktion,
  SettingsKlappe,
  SettingsLeer,
} from '../_shared/settings-layout';

export function TagsGruppe(): React.ReactElement {
  const { allTags, removeTag, renameTag, recountTags } = useTags();
  const storage = useStorage();
  const [editTag, setEditTag] = useState<string | null>(null);
  const [editWert, setEditWert] = useState('');

  const neuZaehlen = useAsyncAction(async () => {
    const vKeys = await storage.idb.keys('vorgang:');
    const dKeys = await storage.idb.keys('doc:');
    const namen: string[] = [];
    for (const k of vKeys) {
      const v = await storage.idb.get<{ tags: string[] }>(k);
      if (v?.tags) namen.push(...v.tags);
    }
    for (const k of dKeys) {
      const d = await storage.idb.get<{ tags: string[] }>(k);
      if (d?.tags) namen.push(...d.tags);
    }
    recountTags(namen);
  });

  return (
    <SettingsGruppe
      id="sec-tags"
      titel="Tags"
      aktion={
        <SettingsGruppenAktion onClick={() => neuZaehlen.run()} disabled={neuZaehlen.busy}>
          {neuZaehlen.busy ? 'Zähle…' : 'Neu zählen'}
        </SettingsGruppenAktion>
      }
    >
      {allTags.length === 0 ? (
        <SettingsLeer>Noch keine Tags — sie entstehen beim Arbeiten an Anträgen.</SettingsLeer>
      ) : (
        <SettingsKlappe
          id="sec-tags-liste"
          label="Alle Tags"
          storageKey="teamflow_settings_tags_collapsed"
          zaehler={allTags.length}
        >
          <div className="rounded-[var(--tf-radius)] overflow-hidden bg-[var(--tf-bg)]" style={{ border: '0.5px solid var(--tf-border)' }}>
            {allTags.map((tag, i) => (
              <ListItem
                key={tag.name}
                title={editTag === tag.name ? '' : tag.name}
                subtitle={editTag === tag.name ? undefined : `${tag.count} ${tag.count === 1 ? 'Verwendung' : 'Verwendungen'}`}
                meta={editTag === tag.name ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editWert}
                      onChange={e => setEditWert(e.target.value)}
                      autoFocus
                      aria-label="Neuer Tag-Name"
                      className="px-2 py-1 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none w-32"
                      style={{ border: '0.5px solid var(--tf-border)' }}
                      onKeyDown={e => { if (e.key === 'Enter') { renameTag(tag.name, editWert); setEditTag(null); } }}
                    />
                    <Button variant="ghost" size="sm" onClick={() => { renameTag(tag.name, editWert); setEditTag(null); }}>OK</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Badge variant="default">{tag.count}</Badge>
                    <button
                      onClick={() => { setEditTag(tag.name); setEditWert(tag.name); }}
                      className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                      title="Umbenennen"
                    >
                      <Pencil size={12} />
                    </button>
                    {tag.count === 0 && (
                      <button
                        onClick={() => removeTag(tag.name)}
                        className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
                        title="Löschen"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
                last={i === allTags.length - 1}
              />
            ))}
          </div>
        </SettingsKlappe>
      )}
      {neuZaehlen.error && (
        <p className="text-[12px] text-[var(--tf-danger-text)] pt-1.5">{neuZaehlen.error}</p>
      )}
    </SettingsGruppe>
  );
}
