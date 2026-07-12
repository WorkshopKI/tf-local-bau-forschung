/**
 * Gemeinsame Detail-Config-Formulare je Widget-Typ — EINE Wahrheit für das
 * Stift-Popover (WidgetQuickEdit) UND die Einstellungs-Sektion
 * (WidgetsSettingsSection). `kontext` blendet nur ein/aus, dupliziert nie
 * Logik: das Popover zeigt die Schnellanpassung (Lanes/Spalten/Farbmodus bzw.
 * Schwellen), die Einstellungen zusätzlich Quelle + Datenbasis.
 */
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsChipToggle } from '@/plugins/einstellungen/_shared/settings-primitives';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { getUserPresets } from '@/core/services/csv/filter/idb-filter';
import type { UserPreset } from '@/core/services/csv/filter/types';
import type { StatusCategory } from '@/core/utils/status-canonical';
import { getStatusCategoryLabel } from '@/plugins/antraege/groupAggregates';
import type {
  AmpelWidgetConfig,
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

  // Presets nur im Settings-Kontext laden (Datenbasis-Select).
  useEffect(() => {
    if (kontext !== 'settings' || !activeProgrammId) return;
    let cancelled = false;
    getUserPresets(storage.idb, activeProgrammId)
      .then(p => { if (!cancelled) setPresets(p); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [kontext, activeProgrammId, storage.idb]);

  const selectedLanes = new Set(cfg.lanes.map(l => l.kategorie as string));

  const toggleLane = (key: string): void => {
    const kategorie = key as StatusCategory;
    const lanes = selectedLanes.has(key)
      ? cfg.lanes.filter(l => l.kategorie !== kategorie)
      : [...cfg.lanes, { kategorie, spalten: 1 as const }];
    void onUpdate({ ...cfg, lanes });
  };

  const toggleSpalten = (key: string): void => {
    const lanes = cfg.lanes.map(l =>
      l.kategorie === key ? { ...l, spalten: (l.spalten === 2 ? 1 : 2) as 1 | 2 } : l);
    void onUpdate({ ...cfg, lanes });
  };

  return (
    <div className="space-y-4">
      {kontext === 'settings' ? (
        <div>
          <FeldLabel>Quelle</FeldLabel>
          <div className="inline-flex rounded-[var(--tf-radius)] overflow-hidden" style={{ border: '0.5px solid var(--tf-border-hover)' }}>
            <button
              type="button"
              aria-pressed={cfg.quelle === 'antraege'}
              onClick={() => { if (cfg.quelle !== 'antraege') void onUpdate({ ...cfg, quelle: 'antraege' }); }}
              className={`px-3 py-1.5 text-[12px] cursor-pointer ${cfg.quelle === 'antraege' ? 'bg-[var(--tf-bg-secondary)] font-medium text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}`}
            >
              Förderanträge
            </button>
            {/* v1: Feedback-Quelle im Schema vorbereitet, UI gesperrt (Schloss). */}
            <button
              type="button"
              disabled
              title="Feedback-Quelle folgt ab v1.1"
              className="px-3 py-1.5 text-[12px] text-[var(--tf-text-tertiary)] cursor-not-allowed inline-flex items-center gap-1.5"
              style={{ borderLeft: '0.5px solid var(--tf-border)' }}
            >
              <Lock size={11} aria-hidden />
              Feedback
            </button>
          </div>
        </div>
      ) : null}

      {kontext === 'settings' ? (
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

      <div>
        <FeldLabel>Lanes (aus Status-Kategorien)</FeldLabel>
        <SettingsChipToggle
          options={LANE_KATEGORIEN.map(k => ({
            key: k,
            label: getStatusCategoryLabel(k),
            suffix: `· ${cfg.lanes.find(l => l.kategorie === k)?.spalten ?? 1} Sp.`,
          }))}
          selectedKeys={selectedLanes}
          onToggle={toggleLane}
          onSuffixClick={toggleSpalten}
        />
        <p className="mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
          Klick auf „· N Sp." schaltet die Kartenspalten (1/2) der Lane um.
        </p>
      </div>

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
