/**
 * Wiederverwendbare Dokumenten-Aufnahmefläche (Gutachten-Durchstich, Baustein 1).
 * Funktioniert vollständig ohne LLM.
 *
 * Pro Datei: Kennung aus dem Dateinamen (Verbund-ID ODER ein TV-FKZ, siehe
 * dokumentAufnahmeFkz) → Typ-Wahl per Pills → Pipeline Converter →
 * Dokumente-Store → Such-Index mit `tags:[relationTag, typ]`. Die Zuordnung läuft
 * ausschließlich über die Tag-Relation (kein Schreiben in den CSV-`Antrag`-Record);
 * `relationTag` ist die Verbund-ID.
 *
 * Zwei Fälle:
 *  - `match`: Dateiname enthält eine bekannte Kennung des Verbundes → direkt aufnehmen.
 *  - `ambig`: nicht eindeutig zuzuordnen → der Bearbeiter ordnet per Klick zu
 *    („Diesem Verbund zuordnen") oder verwirft.
 */
import { useState } from 'react';
import { FileText, Loader2, Check } from 'lucide-react';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { DocConverter, maxConversionLevel, type ConvertedDoc } from '@/core/services/converter';
import { uuid } from '@/core/services/id-generator';
import type { AntragDokumentTyp } from '@/core/services/csv/types';
import { useDokumenteStore } from '@/plugins/dokumente/store';
import { KonvertierungReviewDialog } from './KonvertierungReviewDialog';
import { classifyFkz, type FkzCase } from './dokumentAufnahmeFkz';

const converter = new DocConverter();

const TYP_OPTIONS: ReadonlyArray<{ value: AntragDokumentTyp; label: string }> = [
  { value: 'vorhabensbeschreibung', label: 'Vorhabensbeschreibung' },
  { value: 'teilvorhabensbeschreibung', label: 'Teilvorhabensbeschreibung' },
  { value: 'stellungnahme', label: 'Stellungnahme' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

type ItemStatus = 'wartet' | 'konvertiert' | 'indexiert' | 'fehler' | 'verworfen';

interface IntakeItem {
  localId: string;
  file: File;
  detectedFkz: string | null;
  matchedId: string | null;
  fkzCase: FkzCase;
  typ: AntragDokumentTyp;
  status: ItemStatus;
  docId?: string;
  error?: string;
  /** Konvertierungsergebnis (Markdown + Report) für die „prüfen"-Vorschau. */
  converted?: ConvertedDoc;
}

interface Props {
  /** Tag für die Verbund-Relation — wird an jedes aufgenommene Dokument gehängt
   *  (die Verbund-ID). Über diesen Tag findet die Kurzfassung-Sektion die VB. */
  relationTag: string;
  /** Bekannte Kennungen des Verbundes (Verbund-ID + alle TV-Aktenzeichen) für die
   *  „gehört hierher?"-Erkennung. Leer = alles wird als zugehörig akzeptiert. */
  knownIds: string[];
  /** Callback nach erfolgreicher Aufnahme (z.B. zum Aktualisieren des VB-Status). */
  onIngested?: (typ: AntragDokumentTyp) => void;
}

export function DokumentAufnahme({ relationTag, knownIds, onIngested }: Props): React.ReactElement {
  const storage = useStorage();
  const { indexDocument } = useSearch();
  const add = useDokumenteStore(s => s.add);
  const updateTags = useDokumenteStore(s => s.updateTags);
  const [items, setItems] = useState<IntakeItem[]>([]);

  const patch = (localId: string, p: Partial<IntakeItem>): void =>
    setItems(prev => prev.map(it => (it.localId === localId ? { ...it, ...p } : it)));

  /** Konvertieren → Dokumente-Store → Such-Index. Self-catching (Pitfall #15). */
  const ingest = async (item: IntakeItem, typ: AntragDokumentTyp): Promise<void> => {
    patch(item.localId, { status: 'konvertiert', error: undefined });
    try {
      const converted = await converter.convert(item.file);
      const tags = [relationTag, typ].filter(Boolean);
      const docId = await add({
        filename: converted.filename,
        format: converted.format,
        markdown: converted.markdown,
        tags,
        pages: converted.pages,
        source: 'upload',
        conversion: converted.report,
      }, storage);
      indexDocument({
        id: docId,
        text: converted.markdown,
        title: converted.filename,
        source: converted.filename,
        tags,
        type: 'dokument',
      });
      patch(item.localId, { status: 'indexiert', docId, typ, converted });
      onIngested?.(typ);
    } catch (err) {
      patch(item.localId, { status: 'fehler', error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleFiles = (files: File[]): void => {
    for (const file of files) {
      const { detectedFkz, matchedId, fkzCase } = classifyFkz(file.name, knownIds);
      const item: IntakeItem = {
        localId: uuid(),
        file,
        detectedFkz,
        matchedId,
        fkzCase,
        typ: 'vorhabensbeschreibung',
        status: 'wartet',
      };
      setItems(prev => [...prev, item]);
      // Eindeutig → direkt aufnehmen. Sonst wartet die Zeile auf die Zuordnung.
      if (fkzCase === 'match') void ingest(item, item.typ);
    }
  };

  /** Typ-Pill geklickt: Typ setzen, bei bereits indexiertem Dokument re-taggen. */
  const setTyp = (item: IntakeItem, typ: AntragDokumentTyp): void => {
    patch(item.localId, { typ });
    if (item.docId) {
      void updateTags(item.docId, [relationTag, typ].filter(Boolean), storage).catch(() => { /* re-tag best-effort */ });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <FileDropZone onFiles={handleFiles} accept=".pdf,.docx" multiple>
        <p className="text-[13.5px] text-[var(--tf-text)]">
          Dokumente hier ablegen <span className="text-[var(--tf-text-secondary)]">(PDF, DOCX)</span>
        </p>
        <p className="text-[13px] text-[var(--tf-text-secondary)]">
          oder <span className="text-[var(--tf-primary)]">Datei auswählen</span>
        </p>
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-2">
          Das Förderkennzeichen (Verbund oder Teilvorhaben) wird aus dem Dateinamen erkannt — sonst manuell zuordnen.
        </p>
      </FileDropZone>

      {items.filter(it => it.status !== 'verworfen').map(item => (
        <IntakeRow
          key={item.localId}
          item={item}
          onSetTyp={setTyp}
          onAssign={() => void ingest(item, item.typ)}
          onDiscard={() => patch(item.localId, { status: 'verworfen' })}
        />
      ))}
    </div>
  );
}

interface RowProps {
  item: IntakeItem;
  onSetTyp: (item: IntakeItem, typ: AntragDokumentTyp) => void;
  onAssign: () => void;
  onDiscard: () => void;
}

function IntakeRow({ item, onSetTyp, onAssign, onDiscard }: RowProps): React.ReactElement {
  const assigned = item.status === 'konvertiert' || item.status === 'indexiert';
  const showPills = item.fkzCase === 'match' || assigned;
  const [reviewOpen, setReviewOpen] = useState(false);
  const lvl = item.converted ? maxConversionLevel(item.converted.report) : null;

  return (
    <div className="flex items-start gap-3 py-3 border-t-[0.5px] border-[var(--tf-border)]">
      <FileText size={14} className="text-[var(--tf-text-tertiary)] shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[12px] text-[var(--tf-text)] truncate" title={item.file.name}>
          {item.file.name}
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          {item.fkzCase === 'match' ? (
            <Chip tone="success">
              {item.detectedFkz ? `FKZ erkannt: ${item.detectedFkz}` : `Zugeordnet: ${item.matchedId}`}
            </Chip>
          ) : !assigned ? (
            <Chip tone="warning">
              {item.detectedFkz
                ? `FKZ ${item.detectedFkz} — nicht eindeutig diesem Verbund zugeordnet`
                : 'Kein Förderkennzeichen im Dateinamen erkannt'}
            </Chip>
          ) : null}

          {showPills && (
            <div className="inline-flex gap-1.5 flex-wrap">
              {TYP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={item.typ === opt.value}
                  onClick={() => onSetTyp(item, opt.value)}
                  className={
                    item.typ === opt.value
                      ? 'px-3 py-1 rounded-[16px] text-[11.5px] bg-[var(--tf-text)] text-[var(--tf-bg)]'
                      : 'px-3 py-1 rounded-[16px] text-[11.5px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-hover)]'
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Uneindeutig → Bearbeiter ordnet zu */}
        {item.fkzCase === 'ambig' && item.status === 'wartet' && (
          <div className="flex items-center gap-3.5 mt-2">
            <button type="button" onClick={onAssign} className="text-[11.5px] text-[var(--tf-primary)] hover:underline">
              Diesem Verbund zuordnen
            </button>
            <button type="button" onClick={onDiscard} className="text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]">
              Verwerfen
            </button>
          </div>
        )}

        {item.status === 'fehler' && item.error && (
          <div className="text-[11px] text-[var(--tf-danger-text)] mt-1.5">Fehler: {item.error}</div>
        )}

        {item.status === 'indexiert' && item.converted && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11.5px]">
            <button type="button" onClick={() => setReviewOpen(true)} className="text-[var(--tf-primary)] hover:underline">
              Konvertierung prüfen
            </button>
            {lvl === 'warnung' && <span className="text-[var(--tf-warning-text)]">⚠ mögliche Konvertierungsprobleme</span>}
            {lvl === 'hinweis' && <span className="text-[var(--tf-text-tertiary)]">Hinweise zur Konvertierung</span>}
          </div>
        )}
      </div>

      {/* Status rechts */}
      <div className="shrink-0 text-[11px] text-[var(--tf-text-secondary)] flex items-center gap-1.5 mt-1 whitespace-nowrap">
        {item.status === 'konvertiert' && (<><Loader2 size={12} className="animate-spin" />Konvertiere…</>)}
        {item.status === 'indexiert' && (<><Check size={12} className="text-[var(--tf-success-text)]" />Indexiert</>)}
      </div>

      {item.converted && (
        <KonvertierungReviewDialog
          open={reviewOpen}
          filename={item.converted.filename}
          format={item.converted.format}
          pages={item.converted.pages}
          markdown={item.converted.markdown}
          report={item.converted.report}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}

function Chip({ tone, children }: { tone: 'success' | 'warning'; children: React.ReactNode }): React.ReactElement {
  const cls = tone === 'success'
    ? 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]'
    : 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]';
  return (
    <span className={`inline-flex items-center text-[11px] leading-none px-2.5 py-1 rounded-full ${cls}`}>
      {children}
    </span>
  );
}
