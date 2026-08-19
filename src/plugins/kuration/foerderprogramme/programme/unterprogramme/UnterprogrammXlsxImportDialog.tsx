import { useMemo, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import {
  applyUnterprogrammLabelDiff,
  buildUnterprogrammLabelDiff,
  parseUnterprogrammLabelXlsx,
  zeileSchreibtEtwas,
  type UnterprogrammLabelDiff,
  type UnterprogrammLabelDiffRow,
  type UnterprogrammLabelFeldWahl,
} from '@/core/services/csv';

interface Props {
  open: boolean;
  programmId: string;
  onClose: () => void;
  onApplied: (summary: { written: number; nameWrites: number; zeitraumWrites: number }) => void;
}

type Phase = 'pick' | 'preview' | 'applying';

/** Was die aktuelle Feld-Achse schreibt — der Satz über den Knöpfen. */
const FELD_WORT: Record<UnterprogrammLabelFeldWahl, string> = {
  beide: 'Label + Jahr',
  name: 'nur Label',
  jahr: 'nur Jahr',
};

const KIND_LABELS: Record<UnterprogrammLabelDiffRow['kind'], { label: string; tone: string }> = {
  name_changed: { label: 'Label geändert', tone: 'text-amber-700' },
  zeitraum_changed: { label: 'Jahr geändert', tone: 'text-amber-700' },
  both_changed: { label: 'Label + Jahr geändert', tone: 'text-amber-700' },
  unchanged: { label: 'Unverändert', tone: 'text-[var(--tf-text-tertiary)]' },
  unknown_code: { label: 'Unbekannter Code', tone: 'text-red-600' },
};

export function UnterprogrammXlsxImportDialog({ open, programmId, onClose, onApplied }: Props): React.ReactElement | null {
  const storage = useStorage();
  const session = useKuratorSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [diff, setDiff] = useState<UnterprogrammLabelDiff | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /**
   * Welche Felder der Apply schreiben darf — die zweite Achse neben der
   * Zeilen-Auswahl. „Nur Labels" schränkte bis v4.119 allein die Zeilen ein
   * und schrieb bei kombinierten Zeilen trotzdem auch das Jahr.
   */
  const [felder, setFelder] = useState<UnterprogrammLabelFeldWahl>('beide');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const counts = useMemo(() => {
    if (!diff) return null;
    return {
      changeable: diff.rows.filter(r =>
        r.kind === 'name_changed' || r.kind === 'zeitraum_changed' || r.kind === 'both_changed',
      ).length,
      unknown: diff.summary.unknown,
      unchanged: diff.summary.unchanged,
      // Zählt nur, was unter der aktuellen Feld-Achse WIRKLICH geschrieben wird
      // — sonst verspräche die Knopfbeschriftung mehr Zeilen als der Lauf anfasst.
      selected: Array.from(selected).filter(code => {
        const row = diff.rows.find(r => r.code === code);
        return row != null && zeileSchreibtEtwas(row, felder);
      }).length,
    };
  }, [diff, selected, felder]);

  if (!open) return null;

  const reset = (): void => {
    setPhase('pick');
    setDiff(null);
    setSelected(new Set());
    setFelder('beide');
    setErrorMsg(null);
    setFileName(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const handleFile = async (file: File): Promise<void> => {
    setErrorMsg(null);
    setFileName(file.name);
    try {
      const entries = await parseUnterprogrammLabelXlsx(file);
      if (entries.length === 0) {
        setErrorMsg('Die Datei enthält keine verwertbaren Zeilen (id + label).');
        return;
      }
      const d = await buildUnterprogrammLabelDiff(storage.idb, programmId, entries);
      // Vorbelegung: alle änderbaren Zeilen sind angehakt.
      const pre = new Set<string>();
      for (const r of d.rows) {
        if (r.kind === 'name_changed' || r.kind === 'zeitraum_changed' || r.kind === 'both_changed') {
          pre.add(r.code);
        }
      }
      setDiff(d);
      setSelected(pre);
      setPhase('preview');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleRow = (code: string): void => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  /** Zeilen-Menge UND Feld-Achse in einem Zug — die Knöpfe meinen beides. */
  const setBulk = (kinds: UnterprogrammLabelDiffRow['kind'][], wahl: UnterprogrammLabelFeldWahl): void => {
    if (!diff) return;
    const next = new Set<string>();
    for (const r of diff.rows) {
      if (kinds.includes(r.kind)) next.add(r.code);
    }
    setSelected(next);
    setFelder(wahl);
  };

  const handleApply = async (): Promise<void> => {
    if (!diff) return;
    setPhase('applying');
    try {
      const result = await applyUnterprogrammLabelDiff(
        storage.idb,
        programmId,
        diff,
        selected,
        session.kuratorName ?? undefined,
        felder,
      );
      onApplied(result);
      handleClose();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase('preview');
    }
  };

  return (
    <Dialog
      open={true}
      onClose={handleClose}
      className="!max-w-3xl"
      title="Labels aus XLSX importieren"
      footer={
        phase === 'preview' && diff ? (
          <>
            <Button size="sm" variant="ghost" onClick={handleClose}>Abbrechen</Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => void handleApply()}
              disabled={(counts?.selected ?? 0) === 0}
            >
              {counts?.selected ?? 0} Zeile{(counts?.selected ?? 0) === 1 ? '' : 'n'} übernehmen
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={handleClose}>Schließen</Button>
        )
      }
    >
      <div className="text-[13px] text-[var(--tf-text)] space-y-3 max-h-[60vh] overflow-y-auto">
        {phase === 'pick' && (
          <>
            <p className="text-[var(--tf-text-secondary)]">
              Erwartete Spalten: <span className="font-mono">id</span>, <span className="font-mono">label</span>,
              <span className="font-mono"> jahr</span> (optional). Erste Zeile ist der Header.
            </p>
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">
              Es werden nur bestehende Unterprogramme aktualisiert (das System legt keine neuen Codes
              an — Unterprogramme entstehen ausschließlich aus dem Master-CSV-Import).
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.currentTarget.value = '';
              }}
            />
            <div>
              <Button size="sm" variant="default" onClick={() => fileInputRef.current?.click()}>
                Datei wählen …
              </Button>
              {fileName && (
                <span className="ml-3 text-[12px] text-[var(--tf-text-secondary)]">
                  {fileName}
                </span>
              )}
            </div>
            {errorMsg && (
              <p className="text-[12px] text-red-600">Fehler: {errorMsg}</p>
            )}
          </>
        )}

        {phase === 'preview' && diff && counts && (
          <>
            <div className="flex flex-wrap gap-3 text-[12px] text-[var(--tf-text-secondary)]">
              <span>{counts.changeable} änderbar</span>
              <span>{counts.unchanged} unverändert</span>
              <span className={counts.unknown > 0 ? 'text-red-600' : ''}>
                {counts.unknown} unbekannte Codes
              </span>
              <span className="text-[var(--tf-text)]">
                Schreibt: {FELD_WORT[felder]}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={felder === 'beide' ? 'default' : 'outline'}
                onClick={() => setBulk(['name_changed', 'zeitraum_changed', 'both_changed'], 'beide')}
              >
                Alle Änderungen
              </Button>
              <Button
                size="sm"
                variant={felder === 'name' ? 'default' : 'outline'}
                onClick={() => setBulk(['name_changed', 'both_changed'], 'name')}
              >
                Nur Labels
              </Button>
              <Button
                size="sm"
                variant={felder === 'jahr' ? 'default' : 'outline'}
                onClick={() => setBulk(['zeitraum_changed', 'both_changed'], 'jahr')}
              >
                Nur Jahr
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Auswahl löschen
              </Button>
            </div>
            <div className="overflow-x-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                    <th className="p-2 w-8"></th>
                    <th className="p-2">Code</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Label (alt → neu)</th>
                    <th className="p-2">Jahr (alt → neu)</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.rows.map((row, idx) => {
                    const lock = row.kind === 'unknown_code' || row.kind === 'unchanged';
                    const checked = selected.has(row.code);
                    const tone = KIND_LABELS[row.kind];
                    // Der Pfeil steht nur, wo dieser Lauf wirklich schreibt —
                    // sonst zeigte die Vorschau eine Änderung an, die die
                    // Feld-Achse gerade ausschließt.
                    const zeigtName = row.willChangeName && felder !== 'jahr';
                    const zeigtJahr = row.willChangeJahr && felder !== 'name';
                    return (
                      <tr key={`${row.code}-${idx}`} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            disabled={lock}
                            checked={!lock && checked}
                            onChange={() => toggleRow(row.code)}
                            className="accent-[var(--tf-primary)]"
                          />
                        </td>
                        <td className="p-2 font-mono">{row.code}</td>
                        <td className={`p-2 ${tone.tone}`}>{tone.label}</td>
                        <td className="p-2">
                          {zeigtName ? (
                            <span>
                              <span className="line-through text-[var(--tf-text-tertiary)]">
                                {row.existing?.name || '—'}
                              </span>
                              {' → '}
                              <span>{row.label || '—'}</span>
                            </span>
                          ) : (
                            <span className="text-[var(--tf-text-tertiary)]">{row.label || '—'}</span>
                          )}
                        </td>
                        <td className="p-2">
                          {zeigtJahr ? (
                            <span>
                              <span className="line-through text-[var(--tf-text-tertiary)]">
                                {row.existing?.geplanter_zeitraum || '—'}
                              </span>
                              {' → '}
                              <span>{row.jahr || '—'}</span>
                            </span>
                          ) : (
                            <span className="text-[var(--tf-text-tertiary)]">{row.jahr || '—'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {errorMsg && (
              <p className="text-[12px] text-red-600">Fehler: {errorMsg}</p>
            )}
          </>
        )}

        {phase === 'applying' && (
          <p className="text-[var(--tf-text-secondary)]">Speichere Änderungen …</p>
        )}
      </div>
    </Dialog>
  );
}
