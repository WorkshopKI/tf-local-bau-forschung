import { useState, useEffect, useMemo } from 'react';
import { Copy, Trash2, Sparkles, RefreshCw } from 'lucide-react';
import { Button, Badge, SectionHeader, ListItem, MarkdownRenderer } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { ArtifactService } from '@/core/services/artifacts';
import { getTemplateTypes, fillTemplate } from '@/core/services/templates';
import type { Artifact, Vorgang } from '@/core/types/vorgang';

const artifactService = new ArtifactService();

const TYPE_LABELS: Record<string, string> = {
  nachforderung: 'Nachforderung', email: 'E-Mail', gutachten: 'Gutachten',
  pruefbericht: 'Prüfbericht', bewilligung: 'Bewilligung',
};

interface ArtefakteTabProps {
  vorgang: Vorgang;
  userName: string;
}

export function ArtefakteTab({ vorgang, userName }: ArtefakteTabProps): React.ReactElement {
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artType, setArtType] = useState('nachforderung');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const templateTypes = useMemo(() => getTemplateTypes(), []);

  useEffect(() => {
    artifactService.loadArtifacts(vorgang.id, storage).then(setArtifacts);
  }, [vorgang.id, storage]);

  const handleGenerate = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await artifactService.generateWithAI(artType, vorgang, context, aiBridge);
      setGenerated(result);
    } catch {
      setGenerated(fillTemplate(artType, vorgang));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!generated) return;
    const art = await artifactService.saveArtifact(vorgang, {
      type: artType as Artifact['type'],
      filename: `${artType}_${Date.now()}.md`,
      content: generated,
      author: userName,
      tags: [],
      vorgangId: vorgang.id,
    }, storage);
    setArtifacts(prev => [art, ...prev]);
    setGenerated(null);
    setContext('');
  };

  const handleDelete = async (id: string): Promise<void> => {
    await artifactService.deleteArtifact(id, storage);
    setArtifacts(prev => prev.filter(a => a.id !== id));
    if (viewingId === id) setViewingId(null);
  };

  const viewingArtifact = artifacts.find(a => a.id === viewingId);

  return (
    <div className="space-y-6">
      {/* Generation */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <select value={artType} onChange={e => setArtType(e.target.value)}
            className="px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
            style={{ border: '0.5px solid var(--tf-border)' }}>
            {templateTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Button icon={Sparkles} onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generiere...' : 'Mit AI generieren'}
          </Button>
        </div>
        <textarea value={context} onChange={e => setContext(e.target.value)}
          placeholder="Zusätzliche Hinweise für die AI (optional)"
          rows={2}
          className="w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)]"
          style={{ border: '0.5px solid var(--tf-border)' }} />
      </div>

      {generated && (
        <div className="space-y-3">
          <SectionHeader label="Vorschau" />
          <textarea value={generated} onChange={e => setGenerated(e.target.value)} rows={12}
            className="w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none font-mono resize-y"
            style={{ border: '0.5px solid var(--tf-border)' }} />
          <div className="flex gap-2">
            <Button onClick={handleSave}>Übernehmen & Speichern</Button>
            <Button variant="secondary" icon={RefreshCw} onClick={handleGenerate}>Neu generieren</Button>
            <Button variant="ghost" onClick={() => setGenerated(null)}>Verwerfen</Button>
          </div>
        </div>
      )}

      {/* Viewing */}
      {viewingArtifact && (
        <div className="space-y-3">
          <SectionHeader label={TYPE_LABELS[viewingArtifact.type] ?? viewingArtifact.type}
            action={<button onClick={() => setViewingId(null)} className="text-[11px] text-[var(--tf-text-secondary)] cursor-pointer hover:text-[var(--tf-text)]">Schließen</button>} />
          <div className="rounded-[var(--tf-radius-lg)] p-4 bg-[var(--tf-bg)]" style={{ border: '0.5px solid var(--tf-border)' }}>
            <MarkdownRenderer content={viewingArtifact.content} />
          </div>
        </div>
      )}

      {/* Saved artifacts */}
      <div>
        <SectionHeader label="Gespeicherte Artefakte" />
        {artifacts.length === 0 ? (
          <p className="text-[13px] text-[var(--tf-text-secondary)]">Noch keine Artefakte</p>
        ) : (
          artifacts.map((a, i) => (
            <ListItem key={a.id}
              title={TYPE_LABELS[a.type] ?? a.type}
              subtitle={new Date(a.created).toLocaleDateString('de-DE')}
              meta={
                <div className="flex items-center gap-1">
                  <Badge variant="default">{a.type}</Badge>
                  <button onClick={() => navigator.clipboard.writeText(a.content)} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer" title="Kopieren"><Copy size={12} /></button>
                  <button onClick={() => handleDelete(a.id)} className="p-1 text-[var(--tf-danger-text)] cursor-pointer" title="Löschen"><Trash2 size={12} /></button>
                </div>
              }
              onClick={() => setViewingId(a.id)}
              last={i === artifacts.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
