import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import {
  listAvailableFields,
  saveFilter,
  humanizeFieldKey,
} from '@/core/services/csv';
import type {
  AvailableField,
  FilterDefinition,
  FilterTyp,
  FilterConfig,
} from '@/core/services/csv';
import { humanizeFilterTyp } from '../utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  programmId: string;
  existing: FilterDefinition | null;
}

const TYPES: FilterTyp[] = [
  'single_select',
  'multi_select',
  'boolean_ja_nein',
  'date_range',
  'number_range',
  'text_contains',
];

function typeForField(field: AvailableField): FilterTyp {
  switch (field.type) {
    case 'boolean': return 'boolean_ja_nein';
    case 'date': return 'date_range';
    case 'number': return 'number_range';
    case 'string':
    default: return 'single_select';
  }
}

interface DraftState {
  step: 1 | 2 | 3 | 4;
  feld: string;
  typ: FilterTyp;
  name: string;
  description: string;
  anzeige_reihenfolge: number;
  // config
  werte_quelle: 'auto' | 'manual';
  manuelle_werte: string;
  ja_werte: string;
  nein_werte: string;
  leer_bucket: boolean;
}

function defaultDraft(existing: FilterDefinition | null): DraftState {
  if (!existing) {
    return {
      step: 1,
      feld: '',
      typ: 'single_select',
      name: '',
      description: '',
      anzeige_reihenfolge: 500,
      werte_quelle: 'auto',
      manuelle_werte: '',
      ja_werte: 'ja, true, 1, yes',
      nein_werte: 'nein, false, 0, no',
      leer_bucket: false,
    };
  }
  return {
    step: 1,
    feld: existing.feld,
    typ: existing.typ,
    name: existing.name,
    description: existing.description ?? '',
    anzeige_reihenfolge: existing.anzeige_reihenfolge,
    werte_quelle: existing.config.werte_quelle ?? 'auto',
    manuelle_werte: (existing.config.manuelle_werte ?? []).join(', '),
    ja_werte: (existing.config.ja_werte ?? ['ja', 'true', '1']).join(', '),
    nein_werte: (existing.config.nein_werte ?? ['nein', 'false', '0']).join(', '),
    leer_bucket: !!existing.config.leer_bucket,
  };
}

function parseCsList(s: string): string[] {
  return s.split(/[,;\n]/).map(v => v.trim()).filter(Boolean);
}

export function FilterEditDialog({ open, onClose, onSaved, programmId, existing }: Props): React.ReactElement | null {
  const storage = useStorage();
  const session = useKuratorSession();
  const [draft, setDraft] = useState<DraftState>(() => defaultDraft(existing));
  const [fields, setFields] = useState<AvailableField[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(defaultDraft(existing));
    setErr(null);
    void listAvailableFields(storage.idb, programmId).then(setFields);
  }, [open, existing, programmId, storage.idb]);

  const selectedField = useMemo(
    () => fields.find(f => f.key === draft.feld) ?? null,
    [fields, draft.feld],
  );

  const patch = useCallback(<K extends keyof DraftState>(k: K, v: DraftState[K]) => {
    setDraft(d => ({ ...d, [k]: v }));
  }, []);

  const selectField = (field: AvailableField): void => {
    setDraft(d => ({
      ...d,
      feld: field.key,
      typ: typeForField(field),
      name: d.name || field.label,
    }));
  };

  const next = (): void => {
    setErr(null);
    setDraft(d => ({ ...d, step: Math.min(4, d.step + 1) as DraftState['step'] }));
  };
  const back = (): void => {
    setErr(null);
    setDraft(d => ({ ...d, step: Math.max(1, d.step - 1) as DraftState['step'] }));
  };

  const handleSave = async (): Promise<void> => {
    if (!draft.name.trim()) {
      setErr('Anzeigename darf nicht leer sein.');
      return;
    }
    if (!draft.feld) {
      setErr('Kein Feld ausgewählt.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const now = new Date().toISOString();
      const config: FilterConfig = {};
      if (draft.typ === 'single_select' || draft.typ === 'multi_select') {
        config.werte_quelle = draft.werte_quelle;
        if (draft.werte_quelle === 'manual') {
          config.manuelle_werte = parseCsList(draft.manuelle_werte);
        }
        if (draft.leer_bucket) config.leer_bucket = true;
      } else if (draft.typ === 'boolean_ja_nein') {
        config.ja_werte = parseCsList(draft.ja_werte);
        config.nein_werte = parseCsList(draft.nein_werte);
      }

      const def: FilterDefinition = {
        id: existing?.id ?? `admin-${draft.feld}-${Date.now()}`,
        programm_id: programmId,
        scope: 'admin',
        created_by: existing?.created_by ?? session.kuratorName ?? 'kurator',
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        feld: draft.feld,
        typ: draft.typ,
        config,
        anzeige_reihenfolge: Math.max(0, draft.anzeige_reihenfolge),
        versteckt: existing?.versteckt ?? false,
        erstellt_am: existing?.erstellt_am ?? now,
        aktualisiert_am: now,
      };

      await saveFilter(storage.idb, def, session.kuratorName ?? undefined);
      await onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? `Filter bearbeiten — Schritt ${draft.step}/4` : `Neuer Filter — Schritt ${draft.step}/4`}
      className="max-w-[640px]"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(s => (
              <span
                key={s}
                className={
                  s <= draft.step
                    ? 'h-2 w-2 rounded-full bg-[var(--tf-text)]'
                    : 'h-2 w-2 rounded-full bg-[var(--tf-text-tertiary)] opacity-40'
                }
              />
            ))}
          </div>
          <div className="flex gap-2">
            {draft.step > 1 ? (
              <Button size="sm" variant="ghost" onClick={back} disabled={saving}>Zurück</Button>
            ) : null}
            {draft.step < 4 ? (
              <Button size="sm" variant="default" onClick={next} disabled={draft.step === 1 && !draft.feld}>
                Weiter
              </Button>
            ) : (
              <Button size="sm" variant="default" onClick={() => void handleSave()} disabled={saving}>
                {existing ? 'Speichern' : 'Anlegen'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {draft.step === 1 ? (
        <StepField fields={fields} selected={draft.feld} onSelect={selectField} />
      ) : draft.step === 2 ? (
        <StepType draft={draft} patch={patch} />
      ) : draft.step === 3 ? (
        <StepConfig draft={draft} patch={patch} />
      ) : (
        <StepMeta draft={draft} patch={patch} />
      )}

      {err ? <div className="mt-3 text-[12px] text-red-700">{err}</div> : null}
      {selectedField ? (
        <div className="mt-3 text-[11px] text-[var(--tf-text-tertiary)]">
          Aktives Feld: <span className="font-mono">{selectedField.key}</span> · Typ: {selectedField.type} · Herkunft: {selectedField.origin === 'canonical' ? 'kanonisch' : 'custom'}
        </div>
      ) : null}
    </Dialog>
  );
}

interface StepProps {
  draft: DraftState;
  patch: <K extends keyof DraftState>(k: K, v: DraftState[K]) => void;
}

function StepField({ fields, selected, onSelect }: { fields: AvailableField[]; selected: string; onSelect: (f: AvailableField) => void }): React.ReactElement {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return fields;
    return fields.filter(f => f.key.toLowerCase().includes(q) || f.label.toLowerCase().includes(q));
  }, [fields, query]);
  return (
    <div>
      <div className="text-[12px] text-[var(--tf-text-secondary)] mb-3">
        Wähle das Feld aus, auf das der Filter angewandt werden soll. Zeigt alle kanonischen Felder
        und alle Custom-Felder aus registrierten CSV-Schemas.
      </div>
      <Input
        placeholder="Feld suchen…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="mb-2"
      />
      <div className="max-h-[320px] overflow-y-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
        {filtered.map((f, i) => {
          const active = f.key === selected;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onSelect(f)}
              className="w-full text-left p-2.5 text-[13px] hover:bg-[var(--tf-bg-secondary)]"
              style={{
                borderTop: i === 0 ? undefined : '0.5px solid var(--tf-border)',
                background: active ? 'var(--tf-bg-secondary)' : 'transparent',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[var(--tf-text)]">{humanizeFieldKey(f.key)}</div>
                  <div className="text-[11px] text-[var(--tf-text-tertiary)]">
                    <span className="font-mono">{f.key}</span> · {f.type}
                    {f.origin === 'custom' ? ' · custom' : ''}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 ? (
          <div className="p-4 text-[12px] text-[var(--tf-text-tertiary)] text-center">Keine Treffer</div>
        ) : null}
      </div>
    </div>
  );
}

function StepType({ draft, patch }: StepProps): React.ReactElement {
  return (
    <div>
      <div className="text-[12px] text-[var(--tf-text-secondary)] mb-3">
        Filter-Typ bestimmt die UI-Darstellung und Match-Logik.
      </div>
      <div className="flex flex-col gap-1.5">
        {TYPES.map(t => (
          <label key={t} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-[var(--tf-bg-secondary)]">
            <input
              type="radio"
              name="filter-typ"
              checked={draft.typ === t}
              onChange={() => patch('typ', t)}
              className="accent-[var(--tf-primary)]"
            />
            <div>
              <div className="text-[13px] text-[var(--tf-text)]">{humanizeFilterTyp(t)}</div>
              <div className="text-[11px] text-[var(--tf-text-tertiary)]">{describeType(t)}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function describeType(t: FilterTyp): string {
  switch (t) {
    case 'single_select': return 'Ein Wert aus Liste (Radio)';
    case 'multi_select': return 'Mehrere Werte aus Liste (Checkboxes)';
    case 'boolean_ja_nein': return 'Ja / Nein / Beide (für Deskriptoren)';
    case 'date_range': return 'Von/Bis-Datum';
    case 'number_range': return 'Von/Bis-Zahl';
    case 'text_contains': return 'Volltextsuche im Feld';
    default: return '';
  }
}

function StepConfig({ draft, patch }: StepProps): React.ReactElement {
  if (draft.typ === 'single_select' || draft.typ === 'multi_select') {
    return (
      <div>
        <div className="text-[12px] text-[var(--tf-text-secondary)] mb-3">
          Werte-Quelle und optionale Leer-Option.
        </div>
        <div className="flex flex-col gap-2 mb-4">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              name="werte-quelle"
              checked={draft.werte_quelle === 'auto'}
              onChange={() => patch('werte_quelle', 'auto')}
              className="accent-[var(--tf-primary)]"
            />
            Werte automatisch aus Daten lesen
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              name="werte-quelle"
              checked={draft.werte_quelle === 'manual'}
              onChange={() => patch('werte_quelle', 'manual')}
              className="accent-[var(--tf-primary)]"
            />
            Werte manuell festlegen
          </label>
        </div>
        {draft.werte_quelle === 'manual' ? (
          <div className="mb-4">
            <label className="block text-[12px] text-[var(--tf-text-secondary)] mb-1">
              Werte (Komma- oder Zeilen-getrennt)
            </label>
            <textarea
              value={draft.manuelle_werte}
              onChange={e => patch('manuelle_werte', e.target.value)}
              rows={4}
              className="w-full rounded-md border-[0.5px] border-[var(--tf-border)] bg-transparent p-2 text-[13px]"
              placeholder="bewilligt, abgelehnt, in_pruefung"
            />
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={draft.leer_bucket}
            onChange={e => patch('leer_bucket', e.target.checked)}
            className="accent-[var(--tf-primary)]"
          />
          Zusätzliche Option "(leer)" anzeigen
        </label>
      </div>
    );
  }

  if (draft.typ === 'boolean_ja_nein') {
    return (
      <div>
        <div className="text-[12px] text-[var(--tf-text-secondary)] mb-3">
          Welche Werte des Feldes gelten als "Ja" bzw. "Nein"? Hinweis: Ein leeres Feld zählt als
          "Nein", wenn "Ja"-Muster nicht matchen.
        </div>
        <div className="mb-3">
          <label className="block text-[12px] text-[var(--tf-text-secondary)] mb-1">Ja-Werte</label>
          <Input
            value={draft.ja_werte}
            onChange={e => patch('ja_werte', e.target.value)}
            placeholder="ja, true, 1, yes"
          />
          <div className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">
            Spezialwert <code>*nonempty*</code> = jedes nicht-leere Feld zählt als "Ja".
          </div>
        </div>
        <div>
          <label className="block text-[12px] text-[var(--tf-text-secondary)] mb-1">Nein-Werte (optional)</label>
          <Input
            value={draft.nein_werte}
            onChange={e => patch('nein_werte', e.target.value)}
            placeholder="nein, false, 0, no"
          />
          <div className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">
            Leer lassen, um alles nicht-Ja als "Nein" zu zählen.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-[13px] text-[var(--tf-text-secondary)]">
      Für <strong>{humanizeFilterTyp(draft.typ)}</strong> ist keine Konfiguration nötig — Min/Max
      werden automatisch aus den Daten abgeleitet.
    </div>
  );
}

function StepMeta({ draft, patch }: StepProps): React.ReactElement {
  return (
    <div>
      <div className="text-[12px] text-[var(--tf-text-secondary)] mb-3">
        Anzeigename und Sortier-Reihenfolge in der Sidebar.
      </div>
      <div className="mb-3">
        <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">Anzeigename</label>
        <Input
          value={draft.name}
          onChange={e => patch('name', e.target.value)}
          placeholder="z.B. Themenfeld Urban"
        />
      </div>
      <div className="mb-3">
        <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">Beschreibung (optional)</label>
        <Input
          value={draft.description}
          onChange={e => patch('description', e.target.value)}
          placeholder="Kurze Erklärung für andere Kuratoren"
        />
      </div>
      <div>
        <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">Anzeige-Reihenfolge</label>
        <Input
          type="number"
          value={String(draft.anzeige_reihenfolge)}
          onChange={e => patch('anzeige_reihenfolge', Math.max(0, parseInt(e.target.value || '0', 10)))}
        />
        <div className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">
          Kleinere Werte stehen weiter oben. System-Filter haben 10-100, Kurator-Filter typisch 500+.
        </div>
      </div>
    </div>
  );
}
