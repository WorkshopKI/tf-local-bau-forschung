/**
 * Generische Listen-Section fuer Manifest-Eintraege am Antrag-Detail.
 * Wird zweimal verwendet:
 *   1. variant='wichtig'   — Whitelist-Treffer (gutachten/pdf, projektbeschreibung/pdf,
 *                            nachforderung/doc-docx, verwendungsnachweis/pdf-doc-docx)
 *                            mit triage_state='relevant'.
 *   2. variant='sonstige'  — alle uebrigen mit triage_state='irrelevant'.
 *
 * Beide Sections sind defaultmaessig zugeklappt (User-Vorgabe).
 */
import { useEffect, useState } from 'react';
import { ExternalLink, FileText, FileType2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { useStorage } from '@/core/hooks/useStorage';
import { protokolliereEreignis } from '@/core/services/assistent/protokoll';
import { getDmsSourceHandle } from '@/core/services/infrastructure/smb-handle';
import { DEFAULT_DMS_SOURCE_ID } from '@/core/services/dms-sources';
import {
  listByMatchedAntrag,
  makeLoadBlobFromHandle,
  type DocType,
  type ManifestEntry,
} from '@/phase2';

type Variant = 'wichtig' | 'sonstige';

interface Props {
  aktenzeichen: string;
  variant: Variant;
  /** Im Preview-Modus rendert die Section kein Collapsible, sondern den Section-Header
   *  inline + die ersten 3 Eintraege direkt sichtbar + einen "Alle X" Toggle. Genutzt im
   *  Detail-Panel (variant='wichtig'), damit die wichtigsten Artefakte sofort sichtbar sind. */
  preview?: boolean;
}

const WHITELIST: Array<{ docType: DocType; formats: string[] }> = [
  { docType: 'gutachten', formats: ['pdf'] },
  { docType: 'nachforderung', formats: ['doc', 'docx'] },
  { docType: 'projektbeschreibung', formats: ['pdf'] },
  { docType: 'verwendungsnachweis', formats: ['pdf', 'doc', 'docx'] },
];

/** Lebenszyklus-Reihenfolge fuer "wichtige" Dokumente. */
const WICHTIG_ORDER: Record<string, number> = {
  projektbeschreibung: 0,
  gutachten: 1,
  nachforderung: 2,
  verwendungsnachweis: 3,
  verwendungsnachweispruefung: 4,
};

/** Reihenfolge unter den irrelevanten Eintraegen. gutachten_qs zuerst — ist der
 *  haeufigste "Backup, falls Hauptgutachten nicht da". */
const SONSTIGE_ORDER: Record<string, number> = {
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

function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

function isWhitelisted(entry: ManifestEntry): boolean {
  const ext = fileExtension(entry.filename);
  if (!ext) return false;
  return WHITELIST.some(r => r.docType === entry.doc_type && r.formats.includes(ext));
}

/**
 * Die beiden Sektionen teilen den Bestand **vollständig** auf: was nicht in die
 * Kern-Artefakte gehört, steht unter „Sonstige Dokumente".
 *
 * Bis v4.122 waren die Kriterien nicht komplementär („wichtig" = relevant UND
 * Whitelist, „sonstige" = irrelevant) — die Menge `relevant && !whitelisted`
 * fiel zwischen beide und war auf der Detailseite überhaupt nicht zu sehen.
 * Die Triage erzeugt diese Menge systematisch: Bescheid, Änderungsbescheid,
 * De-minimis, QS-Gutachten, Korrespondenz und jeder unbekannte Aktenplan
 * (`doc_type: 'sonstiges'`) sind `relevant`, stehen aber nicht auf der
 * Whitelist — ebenso jeder Whitelist-Typ im falschen Format. Trug ein Antrag
 * nur solche Dokumente, rendeten beide Sektionen `null`, und die Seite
 * behauptete implizit, es gebe kein einziges Dokument.
 */
function passesFilter(entry: ManifestEntry, variant: Variant): boolean {
  const wichtig = entry.triage_state === 'relevant' && isWhitelisted(entry);
  return variant === 'wichtig' ? wichtig : !wichtig;
}

function sortKey(entry: ManifestEntry, variant: Variant): [number, string, string] {
  const order = variant === 'wichtig' ? WICHTIG_ORDER : SONSTIGE_ORDER;
  return [order[entry.doc_type] ?? 99, entry.doc_type, entry.filename];
}

export function AntragDokumenteSection({ aktenzeichen, variant, preview = false }: Props): React.ReactElement | null {
  const storage = useStorage();
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listByMatchedAntrag(storage.idb, aktenzeichen)
      .then(all => {
        if (cancelled) return;
        const filtered = all
          .filter(e => passesFilter(e, variant))
          .sort((a, b) => {
            const ka = sortKey(a, variant);
            const kb = sortKey(b, variant);
            return ka[0] - kb[0]
              || ka[1].localeCompare(kb[1])
              || ka[2].localeCompare(kb[2]);
          });
        setEntries(filtered);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [storage.idb, aktenzeichen, variant]);

  if (loading) return null;
  if (entries.length === 0) return null;

  const label = variant === 'wichtig' ? 'Dokumente' : 'Sonstige Dokumente';
  const subtitle = `${entries.length} ${entries.length === 1 ? 'Datei' : 'Dateien'}`;

  if (preview) {
    const visible = previewExpanded ? entries : entries.slice(0, 3);
    const hasMore = entries.length > 3;
    return (
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
            {/* Nicht „Letzte": sortiert wird nach Lebenszyklus-Rang (WICHTIG_ORDER),
                nicht nach Datum — die Überschrift versprach eine Zeit-Achse, die
                die Rechnung darunter nicht führt (v4.124). */}
            {variant === 'wichtig' ? 'Wichtigste Artefakte' : label}
          </h3>
          {hasMore ? (
            <button
              type="button"
              onClick={() => setPreviewExpanded(v => !v)}
              className="text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer"
            >
              {previewExpanded ? 'Weniger anzeigen' : `Alle ${entries.length} →`}
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          {visible.map(e => <DokumentRow key={e.filename} entry={e} />)}
        </div>
      </div>
    );
  }

  return (
    <CollapsibleSection label={label} subtitle={subtitle} defaultOpen={false}>
      <div className="flex flex-col gap-1">
        {entries.map(e => <DokumentRow key={e.filename} entry={e} />)}
      </div>
    </CollapsibleSection>
  );
}

interface RowProps {
  entry: ManifestEntry;
}

function DokumentRow({ entry }: RowProps): React.ReactElement {
  const storage = useStorage();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = fileExtension(entry.filename) === 'pdf' ? FileText : FileType2;
  const subline = entry.dms_bezeichnung ?? entry.filepath;

  const handleOpen = async (): Promise<void> => {
    setError(null);
    setOpening(true);
    try {
      // v1.15 Multi-Source: Manifest-Eintrag fuehrt seine Source-ID. Legacy-
      // Eintraege (vor v1.15) haben kein source_id und gehoeren der Default-
      // Source — getDmsSourceHandle('default') faellt transparent auf den
      // alten Slot zurueck, falls die Migration noch nicht gelaufen ist.
      const sourceId = entry.source_id ?? DEFAULT_DMS_SOURCE_ID;
      const handle = await getDmsSourceHandle(storage.idb, sourceId);
      if (!handle) {
        setError(
          entry.source_id
            ? `DMS-Quelle "${entry.source_id}" nicht verbunden — im Plugin Dokumentenquellen verbinden.`
            : 'Keine DMS-Quelle verbunden — im Plugin Dokumentenquellen einrichten.',
        );
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
        setError('Datei nicht im DMS-Quellen-Handle gefunden');
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      void protokolliereEreignis({
        typ: 'dokument_geoeffnet',
        entitaet: { art: 'dokument', id: entry.filename },
        detail: { dokumentArt: entry.doc_type, antrag: entry.matched_antrag_id },
      });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-[6px] hover:bg-[var(--tf-hover)] transition-colors">
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

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
