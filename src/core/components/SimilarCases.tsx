import { useState, useEffect } from 'react';
import { Badge, CollapsibleSection } from '@/ui';
import { useSearch } from '@/core/hooks/useSearch';
import type { Vorgang } from '@/core/types/vorgang';

interface SimilarCasesProps {
  vorgang: Vorgang;
}

export function SimilarCases({ vorgang }: SimilarCasesProps): React.ReactElement {
  const { search, results, vectorReady } = useSearch();
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (searched) return;
    const query = [vorgang.title, ...vorgang.tags].join(' ');
    search(query, { type: 'dokument' }).then(() => setSearched(true));
  }, [vorgang, searched, search]);

  const similar = results
    .filter(r => !r.id.startsWith(vorgang.id))
    .slice(0, 5);

  const subtitle = !vectorReady ? 'Modell laedt...' : `${similar.length} gefunden`;

  return (
    <CollapsibleSection label="Aehnliche Faelle" defaultOpen={true} subtitle={subtitle}>
      {similar.length === 0 && (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">
          {vectorReady ? 'Keine aehnlichen Dokumente gefunden.' : 'Embedding-Modell wird geladen...'}
        </p>
      )}
      {similar.length > 0 && (
        <div className="space-y-2">
          {similar.map(r => (
            <div key={r.id} className="flex items-start justify-between py-2"
              style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-[var(--tf-text)] truncate">{r.title || r.source}</p>
                <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5 line-clamp-2">
                  {r.text.slice(0, 120)}...
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <Badge variant="default">{r.method}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
