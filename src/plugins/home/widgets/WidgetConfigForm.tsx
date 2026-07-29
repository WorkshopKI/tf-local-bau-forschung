/**
 * Gemeinsame Detail-Config-Formulare je Widget-Typ — EINE Wahrheit für das
 * Stift-Popover (WidgetQuickEdit) UND die Einstellungs-Sektion
 * (WidgetsSettingsSection). `kontext` blendet nur ein/aus, dupliziert nie
 * Logik: das Popover zeigt die Schnellanpassung (Lanes/Spalten/Farbmodus bzw.
 * Schwellen), die Einstellungen zusätzlich Quelle + Datenbasis.
 */
import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { LaneListe } from '@/components/ui/LaneListe';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { getUserPresets } from '@/core/services/csv/filter/idb-filter';
import type { UserPreset } from '@/core/services/csv/filter/types';
import type { StatusCategory } from '@/core/utils/status-canonical';
import { getStatusCategoryLabel } from '@/plugins/antraege/groupAggregates';
// Direktimport statt Barrel (siehe `FeedbackKanbanWidget`): das Barrel zieht
// `FeedbackPanel` mit, das `@/plugins.config` laedt — und die Plugin-Config fuehrt
// ueber die Einstellungen zurueck hierher. `constants.ts` ist reines Datenmodul.
import { STATUS_LABELS, STATUS_LANE_ACCENT } from '@/components/feedback/constants';
import { KANBAN_LANE_ACCENT } from './kanbanLanes';
import { FEEDBACK_LANE_STATUS, wechsleKanbanQuelle } from './feedbackKanbanLanes';
import type {
  AmpelWidgetConfig,
  AntragKanbanWidgetConfig,
  FeedbackKanbanWidgetConfig,
  KanbanWidgetConfig,
  WidgetInstanz,
  WidgetSpezifischeConfig,
} from './types';

/** Alle Lane-Kandidaten in kanonischer Reihenfolge (StatusCategory-Union). */
const LANE_KATEGORIEN: StatusCategory[] = [
  'offen', 'in_pruefung', 'nachforderung', 'entscheidung',
  'bewilligt', 'begleitung', 'abgelehnt', 'abgeschlossen', 'sonstige',
];

export interface WidgetConfigFormProps {
  instanz: WidgetInstanz;
  kontext: 'popover' | 'settings';
  onUpdateConfig: (config: WidgetSpezifischeConfig) => Promise<void>;
}

// Prädikat „hat Detail-Formular?" lebt in ./types (hatWidgetDetailConfig) —
// dort pur + node-testbar, ohne die schweren UI-/Feedback-Imports dieses Moduls.
// Muss zu den Branches unten (kanban/ampel) passen.

export function WidgetConfigForm({ instanz, kontext, onUpdateConfig }: WidgetConfigFormProps): React.ReactElement {
  const cfg = instanz.config;
  if (cfg.art === 'kanban') {
    return <KanbanConfigForm cfg={cfg} kontext={kontext} onUpdate={onUpdateConfig} />;
  }
  if (cfg.art === 'ampel') {
    return <AmpelConfigForm cfg={cfg} onUpdate={onUpdateConfig} />;
  }
  return (
    <p className="text-[12px] text-[var(--tf-text-tertiary)]">
      Dieses Widget hat keine weiteren Einstellungen.
    </p>
  );
}

function FeldLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return <p className="text-[12px] text-[var(--tf-text-secondary)] mb-1.5">{children}</p>;
}

// ── Kanban ────────────────────────────────────────────────────────────────

function KanbanConfigForm({
  cfg,
  kontext,
  onUpdate,
}: {
  cfg: KanbanWidgetConfig;
  kontext: 'popover' | 'settings';
  onUpdate: (config: WidgetSpezifischeConfig) => Promise<void>;
}): React.ReactElement {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const [presets, setPresets] = useState<UserPreset[]>([]);

  // Presets nur im Settings-Kontext + Anträge-Quelle laden (Datenbasis-Select).
  useEffect(() => {
    if (kontext !== 'settings' || cfg.quelle !== 'antraege' || !activeProgrammId) return;
    let cancelled = false;
    getUserPresets(storage.idb, activeProgrammId)
      .then(p => { if (!cancelled) setPresets(p); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [kontext, cfg.quelle, activeProgrammId, storage.idb]);

  // Quellenwechsel setzt die Lanes STILL auf den Quell-Default zurück (pure
  // wechsleKanbanQuelle) — no-op-Guard vermeidet unnötige Persist-Writes.
  const wechsle = (quelle: 'antraege' | 'feedback'): void => {
    const next = wechsleKanbanQuelle(cfg, quelle);
    if (next !== cfg) void onUpdate(next);
  };

  return (
    <div className="space-y-4">
      {kontext === 'settings' ? (
        <div>
          <FeldLabel>Quelle</FeldLabel>
          <div className="inline-flex rounded-[var(--tf-radius)] overflow-hidden" style={{ border: '0.5px solid var(--tf-border-hover)' }}>
            <QuelleOption aktiv={cfg.quelle === 'antraege'} label="Förderanträge" onClick={() => wechsle('antraege')} />
            <QuelleOption aktiv={cfg.quelle === 'feedback'} label="Feedback" trennlinie onClick={() => wechsle('feedback')} />
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
            Beim Wechsel werden die Lanes auf den Standard der Quelle gesetzt.
          </p>
        </div>
      ) : null}

      {kontext === 'settings' && cfg.quelle === 'antraege' ? (
        <div>
          <FeldLabel>Datenbasis</FeldLabel>
          <Select
            value={cfg.presetId ?? '__grundmenge__'}
            onValueChange={v => {
              void onUpdate({ ...cfg, presetId: v === '__grundmenge__' ? undefined : v });
            }}
          >
            <SelectTrigger className="w-full max-w-[320px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__grundmenge__">Meine Anträge (Standard)</SelectItem>
              {presets.map(p => (
                <SelectItem key={p.id} value={p.id}>Gespeicherter Filter: „{p.name}"</SelectItem>
              ))}
              {/* Gelöschtes Preset weiterhin anzeigen, damit der Wert sichtbar/abwählbar bleibt. */}
              {cfg.presetId && !presets.some(p => p.id === cfg.presetId) ? (
                <SelectItem value={cfg.presetId}>Gespeicherter Filter (nicht mehr vorhanden)</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {cfg.quelle === 'antraege'
        ? <AntragLaneChips cfg={cfg} onUpdate={onUpdate} />
        : <FeedbackLaneChips cfg={cfg} onUpdate={onUpdate} />}

      <div>
        <FeldLabel>Farben der Köpfe</FeldLabel>
        <div className="inline-flex rounded-[var(--tf-radius)] overflow-hidden" style={{ border: '0.5px solid var(--tf-border-hover)' }}>
          <FarbmodusOption
            aktiv={cfg.farbmodus === 'bunt'}
            dots={['var(--tf-kanban-offen)', 'var(--tf-kanban-nachforderung)', 'var(--tf-kanban-bewilligt)']}
            label="Bunt"
            onClick={() => { if (cfg.farbmodus !== 'bunt') void onUpdate({ ...cfg, farbmodus: 'bunt' }); }}
          />
          <FarbmodusOption
            aktiv={cfg.farbmodus === 'monochrom'}
            dots={['var(--tf-kanban-mono-1)', 'var(--tf-kanban-mono-2)', 'var(--tf-kanban-mono-3)']}
            label="Einfarbig"
            trennlinie
            onClick={() => { if (cfg.farbmodus !== 'monochrom') void onUpdate({ ...cfg, farbmodus: 'monochrom' }); }}
          />
        </div>
      </div>
    </div>
  );
}

/** Segment-Knopf der Quellen-Umschaltung (Text-only, analog FarbmodusOption). */
function QuelleOption({ aktiv, label, onClick, trennlinie }: {
  aktiv: boolean; label: string; onClick: () => void; trennlinie?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={aktiv}
      onClick={onClick}
      className={`px-3 py-1.5 text-[12px] cursor-pointer ${aktiv ? 'bg-[var(--tf-bg-secondary)] font-medium text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}`}
      style={trennlinie ? { borderLeft: '0.5px solid var(--tf-border)' } : undefined}
    >
      {label}
    </button>
  );
}

/** Lane-Auswahl für die Anträge-Quelle (Status-Kategorien). */
function AntragLaneChips({ cfg, onUpdate }: {
  cfg: AntragKanbanWidgetConfig;
  onUpdate: (config: WidgetSpezifischeConfig) => Promise<void>;
}): React.ReactElement {
  const spaltenProKey = new Map<string, 1 | 2>(cfg.lanes.map(l => [l.kategorie as string, l.spalten]));
  const toggleLane = (key: string): void => {
    const kategorie = key as StatusCategory;
    const lanes = spaltenProKey.has(key)
      ? cfg.lanes.filter(l => l.kategorie !== kategorie)
      : [...cfg.lanes, { kategorie, spalten: 1 as const }];
    void onUpdate({ ...cfg, lanes });
  };
  const setSpalten = (key: string, spalten: 1 | 2): void => {
    const lanes = cfg.lanes.map(l => (l.kategorie === key ? { ...l, spalten } : l));
    void onUpdate({ ...cfg, lanes });
  };
  return (
    <div>
      <FeldLabel>Lanes (aus Status-Kategorien)</FeldLabel>
      <LaneListe
        options={LANE_KATEGORIEN.map(k => ({
          key: k,
          label: getStatusCategoryLabel(k),
          akzent: KANBAN_LANE_ACCENT[k],
        }))}
        spaltenProKey={spaltenProKey}
        onToggle={toggleLane}
        onSpalten={setSpalten}
      />
    </div>
  );
}

/** Lane-Auswahl für die Feedback-Quelle (Feedback-Status, FEEDBACK_LANE_STATUS). */
function FeedbackLaneChips({ cfg, onUpdate }: {
  cfg: FeedbackKanbanWidgetConfig;
  onUpdate: (config: WidgetSpezifischeConfig) => Promise<void>;
}): React.ReactElement {
  const spaltenProKey = new Map<string, 1 | 2>(cfg.lanes.map(l => [l.status as string, l.spalten]));
  const toggleLane = (key: string): void => {
    const status = key as FeedbackKanbanWidgetConfig['lanes'][number]['status'];
    const lanes = spaltenProKey.has(key)
      ? cfg.lanes.filter(l => l.status !== status)
      : [...cfg.lanes, { status, spalten: 1 as const }];
    void onUpdate({ ...cfg, lanes });
  };
  const setSpalten = (key: string, spalten: 1 | 2): void => {
    const lanes = cfg.lanes.map(l => (l.status === key ? { ...l, spalten } : l));
    void onUpdate({ ...cfg, lanes });
  };
  return (
    <div>
      <FeldLabel>Lanes (aus Feedback-Status)</FeldLabel>
      <LaneListe
        options={FEEDBACK_LANE_STATUS.map(s => ({
          key: s,
          label: STATUS_LABELS[s],
          akzent: STATUS_LANE_ACCENT[s],
        }))}
        spaltenProKey={spaltenProKey}
        onToggle={toggleLane}
        onSpalten={setSpalten}
      />
    </div>
  );
}

function FarbmodusOption({
  aktiv,
  dots,
  label,
  onClick,
  trennlinie,
}: {
  aktiv: boolean;
  dots: string[];
  label: string;
  onClick: () => void;
  trennlinie?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={aktiv}
      onClick={onClick}
      className={`px-3 py-1.5 text-[12px] cursor-pointer inline-flex items-center gap-1.5 ${aktiv ? 'bg-[var(--tf-bg-secondary)] font-medium text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}`}
      style={trennlinie ? { borderLeft: '0.5px solid var(--tf-border)' } : undefined}
    >
      <span className="inline-flex gap-0.5" aria-hidden>
        {dots.map((d, i) => (
          <span key={i} className="w-2 h-2 rounded-full" style={{ background: d }} />
        ))}
      </span>
      {label}
    </button>
  );
}

// ── Ampel ─────────────────────────────────────────────────────────────────

function AmpelConfigForm({
  cfg,
  onUpdate,
}: {
  cfg: AmpelWidgetConfig;
  onUpdate: (config: WidgetSpezifischeConfig) => Promise<void>;
}): React.ReactElement {
  // Lokaler Puffer, Commit onBlur — kein Persist pro Tastendruck.
  const [warn, setWarn] = useState(String(cfg.warnschwelleTage));
  const [kritisch, setKritisch] = useState(String(cfg.kritischSchwelleTage));
  useEffect(() => { setWarn(String(cfg.warnschwelleTage)); }, [cfg.warnschwelleTage]);
  useEffect(() => { setKritisch(String(cfg.kritischSchwelleTage)); }, [cfg.kritischSchwelleTage]);

  const commit = (): void => {
    const w = Math.max(1, Math.round(Number(warn)) || cfg.warnschwelleTage);
    // Kritisch-Grenze muss oberhalb der Warn-Grenze liegen.
    const k = Math.max(w + 1, Math.round(Number(kritisch)) || cfg.kritischSchwelleTage);
    setWarn(String(w));
    setKritisch(String(k));
    if (w !== cfg.warnschwelleTage || k !== cfg.kritischSchwelleTage) {
      void onUpdate({ ...cfg, warnschwelleTage: w, kritischSchwelleTage: k });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-[12px] text-[var(--tf-text-secondary)] inline-flex items-center gap-2">
          Warnung ab
          <Input
            type="number"
            min={1}
            value={warn}
            onChange={e => setWarn(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-[72px] h-8 text-[12.5px]"
          />
          Tagen
        </label>
        <label className="text-[12px] text-[var(--tf-text-secondary)] inline-flex items-center gap-2">
          Kritisch ab
          <Input
            type="number"
            min={2}
            value={kritisch}
            onChange={e => setKritisch(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-[72px] h-8 text-[12.5px]"
          />
          Tagen
        </label>
      </div>
      <p className="text-[11px] text-[var(--tf-text-tertiary)]">
        Wirkt auf Widget-Zahlen und Kopfzeile. Die farbigen Punkte in den
        Listenzeilen behalten die festen Stufen (30/60/90 Tage).
      </p>
      <label className="flex items-center gap-2.5 text-[12.5px] text-[var(--tf-text)] cursor-pointer">
        <Switch
          checked={cfg.zeilenKlickbar}
          onCheckedChange={v => { void onUpdate({ ...cfg, zeilenKlickbar: v === true }); }}
        />
        Zeilen öffnen die gefilterte Antragsliste
      </label>
    </div>
  );
}
