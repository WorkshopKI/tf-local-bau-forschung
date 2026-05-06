import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  AVAILABLE_FIELDS,
  DEFAULT_ECKDATEN_FIELDS,
  getFieldLabel,
} from './eckdatenConfig';

interface Props {
  open: boolean;
  initial: string[];
  onSave: (fields: string[]) => void;
  onClose: () => void;
}

export function EckdatenEditor({ open, initial, onSave, onClose }: Props): React.ReactElement {
  const [selected, setSelected] = useState<string[]>(initial);

  // Bei jedem Open auf den aktuellen Stand zuruecksetzen.
  useEffect(() => {
    if (open) setSelected(initial);
  }, [open, initial]);

  const available = AVAILABLE_FIELDS.filter(f => !selected.includes(f));

  const move = (idx: number, delta: number): void => {
    const next = [...selected];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target] as string, next[idx] as string];
    setSelected(next);
  };

  const remove = (field: string): void => {
    setSelected(selected.filter(f => f !== field));
  };

  const add = (field: string): void => {
    setSelected([...selected, field]);
  };

  const reset = (): void => {
    setSelected(DEFAULT_ECKDATEN_FIELDS);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Eckdaten anpassen"
      description="Bestimme, welche Felder in der Eckdaten-Karte angezeigt werden und in welcher Reihenfolge."
      className="max-w-[680px]"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw size={13} /> Zurücksetzen
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button size="sm" onClick={() => { onSave(selected); onClose(); }}>Speichern</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 pb-2">
        <div>
          <h4 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
            Ausgewählt ({selected.length})
          </h4>
          <div
            className="flex flex-col gap-1 min-h-[200px] max-h-[360px] overflow-y-auto rounded-[var(--tf-radius)] p-1"
            style={{ background: 'var(--tf-bg-secondary)' }}
          >
            {selected.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--tf-text-tertiary)] italic">
                Keine Felder. Wähle aus „Verfügbar" rechts.
              </div>
            ) : (
              selected.map((field, i) => (
                <div
                  key={field}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-[var(--tf-bg)]"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                >
                  <span className="flex-1 text-[12.5px] text-[var(--tf-text)] truncate">
                    {getFieldLabel(field)}
                  </span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Nach oben"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, +1)}
                    disabled={i === selected.length - 1}
                    className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Nach unten"
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(field)}
                    className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
                    aria-label="Entfernen"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h4 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
            Verfügbar ({available.length})
          </h4>
          <div
            className="flex flex-col gap-1 min-h-[200px] max-h-[360px] overflow-y-auto rounded-[var(--tf-radius)] p-1"
            style={{ background: 'var(--tf-bg-secondary)' }}
          >
            {available.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--tf-text-tertiary)] italic">
                Alle Felder ausgewählt.
              </div>
            ) : (
              available.map(field => (
                <button
                  key={field}
                  type="button"
                  onClick={() => add(field)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--tf-bg)] text-left hover:bg-[var(--tf-hover)] cursor-pointer"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                >
                  <Plus size={12} className="text-[var(--tf-text-tertiary)] shrink-0" />
                  <span className="flex-1 text-[12.5px] text-[var(--tf-text)] truncate">
                    {getFieldLabel(field)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
