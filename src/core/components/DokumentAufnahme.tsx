/**
 * Wiederverwendbare Dokumenten-Aufnahmefläche (Gutachten-Durchstich, Baustein 1).
 * Funktioniert vollständig ohne LLM.
 *
 * Pro Datei: FKZ aus dem Dateinamen (extractFkz, WIEDERVERWENDET) → Typ-Wahl per
 * Pills → Pipeline Converter → Dokumente-Store → Such-Index mit `tags:[fkz, typ]`.
 * Die Antrag-Zuordnung läuft ausschließlich über die FKZ-Tag-Relation (kein
 * Schreiben in den CSV-`Antrag`-Record).
 *
 * Drei FKZ-Fälle gemäß Mockup `mockup-dokument-aufnahme.html`:
 *  (a) FKZ = aktueller Antrag        → direkt aufnehmen
 *  (b) FKZ erkannt, anderer Antrag   → Warnung + „Trotzdem dort ablegen" / „Verwerfen"
 *  (c) kein FKZ im Dateinamen        → Warnung + manuelle Zuordnung (isValidFkz)
 */
import { useState } from 'react';
import { FileText, Loader2, Check } from 'lucide-react';
import { FileDropZone } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { DocConverter } from '@/core/services/converter';
import { isValidFkz } from '@/phase2/matcher/fkz-extractor';
import { uuid } from '@/core/services/id-generator';
import type { AntragDokumentTyp } from '@/core/services/csv/types';
import { useDokumenteStore } from '@/plugins/dokumente/store';
import { classifyFkz, resolveAntragFkz, type FkzCase } from './dokumentAufnahmeFkz';

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
  fkzCase: FkzCase;
  typ: AntragDokumentTyp;
  manualFkz: string;
  status: ItemStatus;
  docId?: string;
  error?: string;
}

interface Props {
  /** FKZ/Aktenzeichen des aktuellen Antrags (gebundener Modus auf der Detailseite). */
  antragAz?: string;
  /** Callback nach erfolgreicher Aufnahme (z.B. zum Aktualisieren des VB-Status). */
  onIngested?: (typ: AntragDokumentTyp, fkz: string) => void;
}

export function DokumentAufnahme({ antragAz, onIngested }: Props): React.ReactElement {
  const storage = useStorage();
  const { indexDocument } = useSearch();
  const add = useDokumenteStore(s => s.add);
  const updateTags = useDokumenteStore(s => s.updateTags);
  const [items, setItems] = useState<IntakeItem[]>([]);

  /** FKZ des aktuellen Antrags (Förderantrag-Aktenzeichen == FKZ). */
  const antragFkz = resolveAntragFkz(antragAz);

  const patch = (localId: string, p: Partial<IntakeItem>): void =>
    setItems(prev => prev.map(it => (it.localId === localId ? { ...it, ...p } : it)));

  /** Konvertieren → Dokumente-Store → Such-Index. Self-catching (Pitfall #15). */
  const ingest = async (item: IntakeItem, fkz: string, typ: AntragDokumentTyp): Promise<void> => {
    patch(item.localId, { status: 'konvertiert', error: undefined });
    try {
      const converted = await converter.convert(item.file);
      const tags = [fkz, typ].filter(Boolean);
      const docId = await add({
        filename: converted.filename,
        format: converted.format,
        markdown: converted.markdown,
        tags,
        pages: converted.pages,
        source: 'upload',
      }, storage);
      indexDocument({
        id: docId,
        text: converted.markdown,
        title: converted.filename,
        source: converted.filename,
        tags,
        type: 'dokument',
      });
      patch(item.localId, { status: 'indexiert', docId, typ });
      onIngested?.(typ, fkz);
    } catch (err) {
      patch(item.localId, { status: 'fehler', error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleFiles = (files: File[]): void => {
    for (const file of files) {
      const { detectedFkz: detected, fkzCase } = classifyFkz(file.name, antragAz);

      const item: IntakeItem = {
        localId: uuid(),
        file,
        detectedFkz: detected,
        fkzCase,
        typ: 'vorhabensbeschreibung',
        manualFkz: antragFkz ?? '',
        status: 'wartet',
      };
      setItems(prev => [...prev, item]);
      // Fall (a): direkt aufnehmen. (b)/(c) warten auf User-Aktion.
      if (fkzCase === 'match') void ingest(item, antragFkz ?? detected!, item.typ);
    }
  };

  /** Typ-Pill geklickt: Typ setzen, bei bereits indexiertem Dokument re-taggen. */
  const setTyp = (item: IntakeItem, typ: AntragDokumentTyp): void => {
    patch(item.localId, { typ });
    if (item.docId) {
      const fkz = antragFkz ?? item.detectedFkz ?? '';
      void updateTags(item.docId, [fkz, typ].filter(Boolean), storage).catch(() => { /* re-tag best-effort */ });
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
          Das Förderkennzeichen wird aus dem Dateinamen erkannt.
        </p>
      </FileDropZone>

      {items.filter(it => it.status !== 'verworfen').map(item => (
        <IntakeRow
          key={item.localId}
          item={item}
          onSetTyp={setTyp}
          onConfirmOther={() => void ingest(item, antragFkz ?? item.detectedFkz!, item.typ)}
          onDiscard={() => patch(item.localId, { status: 'verworfen' })}
          onManualChange={v => patch(item.localId, { manualFkz: v.toUpperCase() })}
          onConfirmManual={() => {
            if (isValidFkz(item.manualFkz)) void ingest(item, item.manualFkz, item.typ);
          }}
        />
      ))}
    </div>
  );
}

interface RowProps {
  item: IntakeItem;
  onSetTyp: (item: IntakeItem, typ: AntragDokumentTyp) => void;
  onConfirmOther: () => void;
  onDiscard: () => void;
  onManualChange: (value: string) => void;
  onConfirmManual: () => void;
}

function IntakeRow({ item, onSetTyp, onConfirmOther, onDiscard, onManualChange, onConfirmManual }: RowProps): React.ReactElement {
  const showPills = item.fkzCase === 'match' || item.status === 'konvertiert' || item.status === 'indexiert';
  return (
    <div className="flex items-start gap-3 py-3 border-t-[0.5px] border-[var(--tf-border)]">
      <FileText size={14} className="text-[var(--tf-text-tertiary)] shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[12px] text-[var(--tf-text)] truncate" title={item.file.name}>
          {item.file.name}
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          {item.fkzCase === 'match' && item.detectedFkz && (
            <Chip tone="success">FKZ erkannt: {item.detectedFkz}</Chip>
          )}
          {item.fkzCase === 'other' && (
            <Chip tone="warning">FKZ {item.detectedFkz} gehört zu einem anderen Antrag</Chip>
          )}
          {item.fkzCase === 'none' && (
            <Chip tone="warning">Kein FKZ im Dateinamen</Chip>
          )}

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

        {/* Fall (c): manuelle FKZ-Zuordnung */}
        {item.fkzCase === 'none' && item.status === 'wartet' && (
          <div className="flex items-center gap-2 mt-2">
            <input
              value={item.manualFkz}
              onChange={e => onManualChange(e.target.value)}
              placeholder="z. B. 16EP034512"
              className="px-2.5 py-1 text-[12px] font-mono rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-transparent text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] w-[150px]"
            />
            <button
              type="button"
              disabled={!isValidFkz(item.manualFkz)}
              onClick={onConfirmManual}
              className="text-[11.5px] text-[var(--tf-primary)] disabled:text-[var(--tf-text-tertiary)] hover:underline disabled:no-underline"
            >
              Manuell zuordnen
            </button>
          </div>
        )}

        {/* Fall (b): anderer Antrag */}
        {item.fkzCase === 'other' && item.status === 'wartet' && (
          <div className="flex items-center gap-3.5 mt-2">
            <button type="button" onClick={onConfirmOther} className="text-[11.5px] text-[var(--tf-primary)] hover:underline">
              Trotzdem dort ablegen
            </button>
            <button type="button" onClick={onDiscard} className="text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]">
              Verwerfen
            </button>
          </div>
        )}

        {item.status === 'fehler' && item.error && (
          <div className="text-[11px] text-[var(--tf-danger-text)] mt-1.5">Fehler: {item.error}</div>
        )}
      </div>

      {/* Status rechts */}
      <div className="shrink-0 text-[11px] text-[var(--tf-text-secondary)] flex items-center gap-1.5 mt-1 whitespace-nowrap">
        {item.status === 'konvertiert' && (<><Loader2 size={12} className="animate-spin" />Konvertiere…</>)}
        {item.status === 'indexiert' && (<><Check size={12} className="text-[var(--tf-success-text)]" />Indexiert</>)}
      </div>
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
