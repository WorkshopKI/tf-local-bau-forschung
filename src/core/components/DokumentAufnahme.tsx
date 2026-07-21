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
import { Button } from '@/components/ui/button';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { DocConverter, maxConversionLevel, type ConvertedDoc } from '@/core/services/converter';
import { vbUeberschreitetCap } from '@/core/services/skills';
import { uuid } from '@/core/services/id-generator';
import type { AntragDokumentTyp } from '@/core/services/csv/types';
import { useDokumenteStore } from '@/plugins/dokumente/store';
import { KonvertierungReviewDialog } from './KonvertierungReviewDialog';
import { classifyFkz, typAusDateiname, DOKUMENT_TYP_OPTIONEN, type FkzCase } from './dokumentAufnahmeFkz';
import { useVbCharCap } from '@/core/hooks/useVbCharCap';

const converter = new DocConverter();

// Volles Dokumenttyp-Vokabular lebt jetzt in `dokumentAufnahmeFkz` (pure, geteilt mit
// der Typ-Label-Ableitung des Assistenten). Re-Export für bestehende Importe.
export { DOKUMENT_TYP_OPTIONEN } from './dokumentAufnahmeFkz';

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
  /** Vorbelegter Typ für neu abgelegte Dateien (Default `'vorhabensbeschreibung'`).
   *  WICHTIG: eine per FKZ-Dateiname sofort aufgenommene Datei (`fkzCase==='match'`)
   *  wird mit diesem Typ getaggt — Caller außerhalb des VB-Flusses (z.B. die
   *  Aufbereitungs-Quellen) übergeben `'sonstiges'`, damit eine abgelegte Anlage 5 /
   *  ein Marketingkonzept die VB-Auflösung (`resolveVb` = neuestes VB-Doc) NICHT
   *  überschreibt. */
  defaultTyp?: AntragDokumentTyp;
  /** Wählbare Typ-Pills (Default = `DOKUMENT_TYP_OPTIONEN`, das volle Vokabular). */
  typOptionen?: ReadonlyArray<{ value: AntragDokumentTyp; label: string }>;
  /** Wenn true: Aufnahmefläche bleibt nach der Aufnahme offen — die Pro-Datei-Erkennung
   *  + „Konvertierung prüfen" bleibt sichtbar; `onIngested` feuert erst beim expliziten
   *  „Fertig"-Klick. Default false = bisheriges Sofort-Verhalten (andere Aufrufer, z.B. die
   *  Aufbereitungs-Quellen, bleiben unverändert). */
  offenHalten?: boolean;
  /** Optionales Label für den Abschluss-Button (nur bei `offenHalten`; Default „Fertig"). */
  abschlussLabel?: string;
}

export function DokumentAufnahme({
  relationTag, knownIds, onIngested, defaultTyp = 'vorhabensbeschreibung', typOptionen = DOKUMENT_TYP_OPTIONEN,
  offenHalten = false, abschlussLabel = 'Fertig',
}: Props): React.ReactElement {
  const storage = useStorage();
  const { indexDocument, removeDocument } = useSearch();
  const add = useDokumenteStore(s => s.add);
  const updateTags = useDokumenteStore(s => s.updateTags);
  const removeDoc = useDokumenteStore(s => s.remove);
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
      // Bei `offenHalten` bleibt die Fläche offen (Pro-Datei-Erkennung + „Konvertierung
      // prüfen"); die Sektion wird erst beim expliziten „Fertig"-Klick benachrichtigt.
      if (!offenHalten) onIngested?.(typ);
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
        // Vorbeleg-Typ aus dem Dateinamen (Anlage 5 → arbeitsplan, Marketing → marketingkonzept),
        // sonst der defaultTyp der Fläche — so ist eine Anlage 5 auch im Gutachten-Upload korrekt
        // getaggt und in der Aufbereitung sofort auffindbar (keine VB-Vergiftung).
        typ: typAusDateiname(file.name, defaultTyp),
        status: 'wartet',
      };
      setItems(prev => [...prev, item]);
      // Eindeutig → direkt aufnehmen. Sonst wartet die Zeile auf die Zuordnung.
      if (fkzCase === 'match') void ingest(item, item.typ);
    }
  };

  /** Typ-Pill geklickt: Typ setzen, bei bereits indexiertem Dokument re-taggen und die
   *  Sektion benachrichtigen (Auto-Übernehmen — kein separater „Übernehmen"-Button). Das
   *  `onIngested` ist wie beim Ingest auf `!offenHalten` gegated: in der Aufbereitung rechnet
   *  der Re-Tag sofort neu (behebt „Anlage 5 trotz Umtaggen noch als fehlend"); in der offen
   *  gehaltenen Gutachten-Fläche bleibt die Übernahme beim expliziten „Fertig". */
  const setTyp = (item: IntakeItem, typ: AntragDokumentTyp): void => {
    patch(item.localId, { typ });
    if (item.docId) {
      void updateTags(item.docId, [relationTag, typ].filter(Boolean), storage)
        .then(() => { if (!offenHalten) onIngested?.(typ); })
        .catch(() => { /* re-tag best-effort */ });
    }
  };

  /** Frisch aufgenommenes Dokument wieder entfernen (z.B. schlechte PDF-Konvertierung
   *  → als DOCX neu ablegen, oder falsche Datei erwischt). Vollständige Löschung:
   *  aus dem Such-Index (Orama) UND aus dem Dokumente-Store (IDB). Danach fliegt die
   *  Zeile aus der Aufnahme-Liste. Ein indexiertes Doc, das der Caller schon gezählt
   *  haben könnte, triggert ein Neu-Rechnen — gleich gegated wie Ingest/Re-Tag
   *  (`offenHalten` verschiebt es auf „Fertig"). Fehler-Zeilen (kein `docId`) fliegen
   *  nur aus der Liste. Wird pro Zeile über `useAsyncAction` aufgerufen (Pitfall #15). */
  const entferne = async (item: IntakeItem): Promise<void> => {
    if (item.docId) {
      removeDocument(item.docId);
      await removeDoc(item.docId, storage);
    }
    setItems(prev => prev.filter(it => it.localId !== item.localId));
    if (!offenHalten && item.docId) onIngested?.(item.typ);
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
          typOptionen={typOptionen}
          onSetTyp={setTyp}
          onAssign={() => void ingest(item, item.typ)}
          onDiscard={() => patch(item.localId, { status: 'verworfen' })}
          onRemove={entferne}
        />
      ))}

      {/* Abschluss: Fläche offen halten, bis der Bearbeiter Erkennung + Konvertierung
          jeder Datei geprüft hat und explizit übernimmt. Erst dann feuert `onIngested`. */}
      {offenHalten && items.some(it => it.status === 'indexiert') && (
        <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t-[0.5px] border-[var(--tf-border)]">
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">
            Prüfen Sie die Erkennung und Konvertierung jeder Datei — dann übernehmen.
          </span>
          <Button variant="primary" size="sm" onClick={() => onIngested?.(defaultTyp)}>
            {abschlussLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  item: IntakeItem;
  typOptionen: ReadonlyArray<{ value: AntragDokumentTyp; label: string }>;
  onSetTyp: (item: IntakeItem, typ: AntragDokumentTyp) => void;
  onAssign: () => void;
  onDiscard: () => void;
  onRemove: (item: IntakeItem) => Promise<void>;
}

function IntakeRow({ item, typOptionen, onSetTyp, onAssign, onDiscard, onRemove }: RowProps): React.ReactElement {
  const assigned = item.status === 'konvertiert' || item.status === 'indexiert';
  const showPills = item.fkzCase === 'match' || assigned;
  const [reviewOpen, setReviewOpen] = useState(false);
  const entfernen = useAsyncAction(onRemove);
  // Rückfrage nur bei tatsächlicher Löschung (indexiertes Doc); reine Fehler-Zeilen
  // haben nichts persistiert und fliegen ohne Nachfrage aus der Liste.
  const handleRemove = (): void => {
    if (item.docId && !window.confirm(`„${item.file.name}" entfernen?`)) return;
    void entfernen.run(item);
  };
  const lvl = item.converted ? maxConversionLevel(item.converted.report) : null;
  const vbCap = useVbCharCap();
  const zuLang = item.converted ? vbUeberschreitetCap(item.converted.markdown, vbCap) : false;
  const rep = item.converted?.report;
  const imgCount = rep?.imageCount ?? 0;
  const tblCount = rep?.tableCount ?? 0;

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
              {typOptionen.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={item.typ === opt.value}
                  onClick={() => onSetTyp(item, opt.value)}
                  className={
                    item.typ === opt.value
                      ? 'px-3 py-1 rounded-[16px] text-[11.5px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
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

        {item.status === 'fehler' && (
          <div className="mt-1.5 flex items-center gap-2.5 flex-wrap text-[11px]">
            {item.error && <span className="text-[var(--tf-danger-text)]">Fehler: {item.error}</span>}
            <EntfernenButton busy={entfernen.busy} onClick={handleRemove} />
          </div>
        )}

        {item.status === 'indexiert' && item.converted && (
          <>
            <div className="mt-1.5 flex items-center gap-2.5 flex-wrap text-[11.5px]">
              <button type="button" onClick={() => setReviewOpen(true)} className="text-[var(--tf-primary)] hover:underline">
                Konvertierung prüfen
              </button>
              {lvl === 'warnung' && <span className="text-[var(--tf-warning-text)]">⚠ mögliche Konvertierungsprobleme</span>}
              {lvl === 'hinweis' && <span className="text-[var(--tf-text-tertiary)]">Hinweise zur Konvertierung</span>}
              <span className="text-[var(--tf-border)]" aria-hidden>·</span>
              <EntfernenButton busy={entfernen.busy} onClick={handleRemove} />
            </div>
            {zuLang && (
              <div className="mt-1.5 rounded-[6px] px-2.5 py-1.5 text-[11.5px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)]">
                ⚠ Länger als das Kontextfenster (~{vbCap.toLocaleString('de-DE')} Zeichen) — die KI würde den Schluss nicht sehen.
                Bitte extern kürzen (Anhänge, Literaturverzeichnis, ausführliche Tabellen) und erneut hochladen.
              </div>
            )}
            {(imgCount > 0 || tblCount > 0) && (
              <div className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">
                {imgCount > 0 && `🖼 ${imgCount} Bild${imgCount === 1 ? '' : 'er'} ignoriert (kein Text)`}
                {imgCount > 0 && tblCount > 0 && ' · '}
                {tblCount > 0 && `${tblCount} Tabelle${tblCount === 1 ? '' : 'n'} als Text übernommen`}
              </div>
            )}
          </>
        )}

        {entfernen.error && (
          <div className="mt-1.5 text-[11px] text-[var(--tf-danger-text)]">Entfernen fehlgeschlagen: {entfernen.error}</div>
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

/** Dezenter Text-Link zum Entfernen einer frisch aufgenommenen Datei (danger-getönt beim Hover). */
function EntfernenButton({ busy, onClick }: { busy: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] disabled:opacity-50"
    >
      {busy ? 'Entferne…' : 'Entfernen'}
    </button>
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
