/**
 * Listet alle Manifest-Eintraege mit `matched_antrag_id === aktenzeichen` UND
 * `triage_state === 'irrelevant'` als collapsible Section am Ende der Antrag-
 * Detail-Seite. Use-Case: Sachbearbeiter findet das Hauptdokument nicht und
 * schaut nach, ob die QS-Version (gutachten_qs) oder eine Korrespondenz weiter-
 * hilft.
 *
 * "Oeffnen" ladet die Datei via Dokumentenquelle-Handle als Blob und oeffnet
 * sie in einem neuen Tab. Wenn der Handle nicht verbunden ist (z.B. anderer
 * Rechner), zeigt eine Inline-Meldung statt eines Crashes.
 */
import { useEffect, useState } from 'react';
import { ExternalLink, FileText, FileType2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { getDokumentenquelleHandle } from '@/core/services/infrastructure/smb-handle';
import {
  listByMatchedAntrag,
  makeLoadBlobFromHandle,
  type ManifestEntry,
} from '@/phase2';

interface Props {
  aktenzeichen: string;
}

const DOC_TYPE_ORDER: Record<string, number> = {
  gutachten_qs: 0,
  korrespondenz: 1,
  nachforderung: 2,
  bescheid: 3,
  aenderungsbescheid: 4,
  checkliste: 5,
  de_minimis: 6,
  irrelevant: 7,
  sonstiges: 8,
};

function sortKey(e: ManifestEntry): [number, string, string] {
  return [DOC_TYPE_ORDER[e.doc_type] ?? 99, e.doc_type, e.filename];
}

function isPdfLike(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SonstigeDokumenteSection({ aktenzeichen }: Props): React.ReactElement | null {
  const storage = useStorage();
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listByMatchedAntrag(storage.idb, aktenzeichen)
      .then(all => {
        if (cancelled) return;
        const sonstige = all
          .filter(e => e.triage_state === 'irrelevant')
          .sort((a, b) => {
            const ka = sortKey(a);
            const kb = sortKey(b);
            return ka[0] - kb[0]
              || ka[1].localeCompare(kb[1])
              || ka[2].localeCompare(kb[2]);
          });
        setEntries(sonstige);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [storage.idb, aktenzeichen]);

  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <CollapsibleSection
      label="Sonstige Dokumente"
      subtitle={`${entries.length} ${entries.length === 1 ? 'Datei' : 'Dateien'}`}
      defaultOpen={false}
    >
      <div className="flex flex-col gap-1">
        {entries.map(e => (
          <SonstigeRow key={e.filename} entry={e} />
        ))}
      </div>
    </CollapsibleSection>
  );
}

interface RowProps {
  entry: ManifestEntry;
}

function SonstigeRow({ entry }: RowProps): React.ReactElement {
  const storage = useStorage();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = isPdfLike(entry.filename) ? FileText : FileType2;
  const subline = entry.dms_bezeichnung ?? entry.filepath;

  const handleOpen = async (): Promise<void> => {
    setError(null);
    setOpening(true);
    try {
      const handle = await getDokumentenquelleHandle(storage.idb);
      if (!handle) {
        setError('Dokumentenquelle nicht verbunden');
        return;
      }
      const loader = makeLoadBlobFromHandle(handle);
      const blob = await loader({
        filename: entry.filename,
        filepath: entry.filepath,
        size_bytes: entry.size_bytes,
        mtime: entry.mtime,
      });
      if (!blob) {
        setError('Datei nicht im Dokumentenquelle-Handle gefunden');
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-2 py-2 rounded-[6px] hover:bg-[var(--tf-hover)] transition-colors"
    >
      <Icon size={14} className="text-[var(--tf-text-tertiary)] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[12px] text-[var(--tf-text)] truncate" title={entry.filename}>
          {entry.filename}
        </div>
        <div className="text-[11px] text-[var(--tf-text-tertiary)] truncate" title={subline}>
          {subline}
        </div>
      </div>
      <span
        className="inline-flex items-center rounded-full text-[10.5px] font-medium text-zinc-700 bg-zinc-100"
        style={{ padding: '1.5px 8px' }}
      >
        {entry.doc_type}
      </span>
      <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums w-[60px] text-right">
        {formatSize(entry.size_bytes)}
      </span>
      <Button variant="ghost" size="sm" onClick={handleOpen} disabled={opening}>
        {opening ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
        Oeffnen
      </Button>
      {error && (
        <span className="text-[10.5px] text-[var(--tf-danger-text)] max-w-[180px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
