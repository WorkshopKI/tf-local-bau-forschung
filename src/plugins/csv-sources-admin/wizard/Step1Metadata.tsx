import { useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseCsvPreview } from '@/core/services/csv';
import type { CsvEncoding, CsvSeparator } from '@/core/services/csv/types';
import type { WizardApi } from './useCsvWizardState';
import { TEST_CORPUS, testCorpusBlob } from './testCorpus';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SEPARATOR_LABEL: Record<CsvSeparator, string> = {
  ';': 'Semikolon',
  ',': 'Komma',
  '\t': 'Tab',
  '|': 'Pipe',
};
const ENCODING_LABEL: Record<CsvEncoding, string> = {
  'UTF-8': 'UTF-8',
  'windows-1252': 'Windows-1252',
};

interface Step1Props {
  api: WizardApi;
  existingMasterId: string | null;
}

export function Step1Metadata({ api, existingMasterId }: Step1Props): React.ReactElement {
  const { state, setField, setDisplayName, setFileAndPreview, setEncoding, setSeparator } = api;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleEncodingChange(enc: CsvEncoding): Promise<void> {
    setErr(null);
    try {
      await setEncoding(enc);
    } catch (e) {
      setErr(`Parse-Fehler bei ${enc}: ${(e as Error).message}`);
    }
  }
  async function handleSeparatorChange(sep: CsvSeparator): Promise<void> {
    setErr(null);
    try {
      await setSeparator(sep);
    } catch (e) {
      setErr(`Parse-Fehler bei ${SEPARATOR_LABEL[sep]}: ${(e as Error).message}`);
    }
  }

  async function handleFile(file: File): Promise<void> {
    setLoading(true);
    setErr(null);
    try {
      const preview = await parseCsvPreview(file, 5);
      setFileAndPreview(file, preview);
    } catch (e) {
      setErr(`Parse-Fehler: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadTestCorpus(id: string): Promise<void> {
    const entry = TEST_CORPUS.find(e => e.id === id);
    if (!entry) return;
    const blob = testCorpusBlob(entry);
    const file = new File([blob], entry.filename, { type: 'text/csv' });
    if (!state.displayName) setDisplayName(entry.label);
    await handleFile(file);
  }

  const masterWarning = state.isMaster && existingMasterId && existingMasterId !== state.schemaId;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">Anzeigename</label>
        <Input
          value={state.displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="z.B. Stammdaten"
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">
          Schema-ID
          <span className="ml-2 text-[11px] text-[var(--tf-text-tertiary)]">unveränderlich nach Speichern</span>
        </label>
        <Input
          value={state.schemaId}
          onChange={e => setField('schemaId', e.target.value.replace(/[^a-z0-9-_]/gi, '').toLowerCase())}
          placeholder="stammdaten-v1"
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">CSV-Datei</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="hidden"
        />
        {!state.file ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-[var(--tf-border)] bg-[var(--tf-bg-subtle)] px-4 py-5 text-[13px] font-medium text-[var(--tf-text)] transition hover:border-[var(--tf-text-tertiary)] hover:bg-[var(--tf-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload size={16} />
            <span>CSV-Datei vom Rechner auswählen…</span>
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-subtle)] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileText size={15} className="flex-shrink-0 text-[var(--tf-text-secondary)]" />
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-medium text-[var(--tf-text)]">{state.file.name}</div>
                <div className="text-[11px] text-[var(--tf-text-tertiary)]">
                  {formatBytes(state.file.size)}
                  {state.preview ? ` · ${state.preview.totalLines} Zeilen · ${state.preview.headers.length} Spalten` : ''}
                </div>
              </div>
            </div>
            <Button size="xs" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              Andere Datei…
            </Button>
          </div>
        )}
        {loading ? <div className="mt-1 text-[12px] text-[var(--tf-text-tertiary)]">Parse läuft …</div> : null}
        {err ? <div className="mt-1 text-[12px] text-red-700">{err}</div> : null}

        {state.preview ? (
          <div className="mt-3 rounded border border-[var(--tf-border)] p-2.5 bg-[var(--tf-bg-subtle)]">
            <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1.5">Dateiformat</div>
            {state.detectedEncoding && state.detectedSeparator ? (
              <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-2">
                Erkannt: {SEPARATOR_LABEL[state.detectedSeparator]}-Separator, {ENCODING_LABEL[state.detectedEncoding]} Encoding
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 mb-2">
              <label className="flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)]">
                Encoding:
                <select
                  value={state.encoding}
                  onChange={e => void handleEncodingChange(e.target.value as CsvEncoding)}
                  className="text-[12px] px-1.5 py-1 rounded border border-[var(--tf-border)] bg-[var(--tf-bg)]"
                >
                  <option value="UTF-8">UTF-8</option>
                  <option value="windows-1252">Windows-1252</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)]">
                Separator:
                <select
                  value={state.separator}
                  onChange={e => void handleSeparatorChange(e.target.value as CsvSeparator)}
                  className="text-[12px] px-1.5 py-1 rounded border border-[var(--tf-border)] bg-[var(--tf-bg)]"
                >
                  <option value=";">Semikolon (;)</option>
                  <option value=",">Komma (,)</option>
                  <option value="\t">Tab</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </label>
            </div>
            {state.preview.headers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="text-[11px] w-full">
                  <thead>
                    <tr className="text-left text-[var(--tf-text-tertiary)]">
                      {state.preview.headers.slice(0, 8).map(h => (
                        <th key={h} className="px-1.5 py-0.5 font-medium border-b border-[var(--tf-border)] whitespace-nowrap">{h}</th>
                      ))}
                      {state.preview.headers.length > 8 ? (
                        <th className="px-1.5 py-0.5 text-[var(--tf-text-tertiary)]">…+{state.preview.headers.length - 8}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {state.preview.rows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="text-[var(--tf-text)]">
                        {state.preview!.headers.slice(0, 8).map(h => (
                          <td key={h} className="px-1.5 py-0.5 border-b border-[var(--tf-border)] whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis">
                            {row[h] ?? ''}
                          </td>
                        ))}
                        {state.preview!.headers.length > 8 ? <td /> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-[var(--tf-border)]" />
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">oder zum Testen</div>
            <div className="h-px flex-1 bg-[var(--tf-border)]" />
          </div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1.5">Beispieldaten laden</div>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {TEST_CORPUS.filter(e => e.size === 'small' || !e.size).map(e => (
              <Button key={e.id} size="xs" variant="outline" onClick={() => void loadTestCorpus(e.id)} title={e.hint}>
                {e.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {TEST_CORPUS.filter(e => e.size === 'de').map(e => (
              <Button key={e.id} size="xs" variant="outline" onClick={() => void loadTestCorpus(e.id)} title={e.hint}>
                {e.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEST_CORPUS.filter(e => e.size === 'big').map(e => (
              <Button key={e.id} size="xs" variant="outline" onClick={() => void loadTestCorpus(e.id)} title={e.hint}>
                {e.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">Join-Key</label>
        <div className="flex gap-1.5">
          {(['aktenzeichen', 'verbund_id', 'akronym'] as const).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setField('joinKey', k)}
              className={
                state.joinKey === k
                  ? 'px-3 py-1 rounded-full text-[11.5px] bg-[var(--tf-text)] text-[var(--tf-bg)]'
                  : 'px-3 py-1 rounded-full text-[11.5px] text-[var(--tf-text-secondary)] border-[0.5px] border-[var(--tf-border)]'
              }
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={state.isMaster}
          onChange={e => {
            const checked = e.target.checked;
            setField('isMaster', checked);
            if (checked && state.priority === 50) setField('priority', 100);
            else if (!checked && state.priority === 100) setField('priority', 50);
          }}
          className="mt-1"
        />
        <div>
          <label className="text-[13px] text-[var(--tf-text)]">Master-Source</label>
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Nur genau eine Master-Source pro Programm. Definiert die Menge der Anträge.
          </div>
          {masterWarning ? (
            <div className="mt-1 text-[12px] text-amber-700">
              Warnung: Es gibt bereits eine Master-Source ({existingMasterId}). Beim Speichern wird die
              bisherige abgelöst.
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">Priority</label>
        <Input
          type="number"
          value={String(state.priority)}
          onChange={e => setField('priority', Math.max(0, parseInt(e.target.value || '0', 10)))}
        />
        <div className="mt-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
          Höherer Wert gewinnt bei Feld-Konflikten. Typisch: 50 = normal, 100 = Master, 30 = zusätzliche Quelle.
        </div>
      </div>
    </div>
  );
}
