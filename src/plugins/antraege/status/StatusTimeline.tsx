/**
 * Horizontale Status-Timeline (Phase 5) — reine React/CSS-Darstellung (keine
 * Chart-Lib) über den Timeline-Helfern aus `@/core/status` (`baueLanes` filtert
 * `ignoriert`/`nebensaechlich`, `clustere` fasst dichte Punkte zusammen) und den
 * gerätelokalen Präferenzen (`useTimelinePrefs`). Eine Verbund-Lane + je TV eine
 * Lane (bei > 3 TV-Lanes per Default eingeklappt); Zeitfenster via Preset. Der
 * breite Zeitstrahl scrollt im eigenen Container — der Seiten-Body nie horizontal.
 */
import { ChevronDown, ChevronRight, Milestone } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { baueLanes, clustere, feldLabel, type Cluster, type TimelineEvent } from '@/core/status';
import type { MappingVersion, Prominenz, StatusEvent } from '@/core/status';
import { formatGermanDate } from '@/core/services/csv/dateParse';
import type { UseTimelinePrefs, ZeitraumPreset } from './timelinePrefs';

const MS_TAG = 86_400_000;
const LABEL_W = 132;
const LANE_H = 46;

const PRESETS: { key: ZeitraumPreset; label: string }[] = [
  { key: 'gesamt', label: 'Gesamt' },
  { key: '12m', label: '12 Monate' },
  { key: '90t', label: '90 Tage' },
];

interface Fenster {
  min: number;
  max: number;
}

/** Sichtfenster nach Preset über alle gezeigten Event-Zeitpunkte. */
function fensterFor(preset: ZeitraumPreset, allMs: number[]): Fenster {
  const max = Math.max(...allMs);
  const min = Math.min(...allMs);
  if (preset === '12m') return { min: max - 365 * MS_TAG, max };
  if (preset === '90t') return { min: max - 90 * MS_TAG, max };
  return { min, max };
}

export function StatusTimeline({
  events,
  version,
  grenze,
  prefsApi,
}: {
  events: StatusEvent[];
  version: MappingVersion;
  grenze: string | null;
  /** Von der Detailsektion hereingereicht — Chronik und Lanes teilen sich eine
   *  Präferenz-Instanz, sonst liefe der Nebensächliches-Schalter auseinander. */
  prefsApi: UseTimelinePrefs;
}): React.ReactElement {
  const { prefs, setNebensaechlich, setPreset, toggleLane } = prefsApi;

  const lanes = baueLanes(events, version, { zeigeNebensaechlich: prefs.zeigeNebensaechlich });
  const allMs = [...lanes.verbund, ...lanes.tvLanes.flatMap(l => l.events)].map(te => te.ms);

  if (allMs.length === 0) {
    return (
      <div className="py-6 text-[12px] text-[var(--tf-text-tertiary)]">Noch keine Statushistorie</div>
    );
  }

  const fenster = fensterFor(prefs.preset, allMs);
  const range = fenster.max - fenster.min;
  const inWindow = (te: TimelineEvent): boolean => te.ms >= fenster.min && te.ms <= fenster.max;

  const verbundEv = lanes.verbund.filter(inWindow);
  // Bei > 3 TV-Lanes Default eingeklappt; `eingeklappt` ist dann die Menge der
  // vom Nutzer AUFGEklappten (XOR — ein Toggle kippt den Zustand in beiden Modi).
  const autoCollapse = lanes.tvLanes.length > 3;
  const tvRows = lanes.tvLanes.map(l => ({
    id: l.tvId,
    events: l.events.filter(inWindow),
    collapsed: prefs.eingeklappt.includes(l.tvId) !== autoCollapse,
  }));

  const eventCount = verbundEv.length + tvRows.reduce((n, r) => n + r.events.length, 0);
  const innerW = Math.max(720, eventCount * 36);
  const laneCount = 1 + tvRows.length;
  const totalH = laneCount * LANE_H;
  const schwelleMs = range > 0 ? range * 0.02 : 0;

  const xOf = (ms: number): number => (range <= 0 ? innerW / 2 : ((ms - fenster.min) / range) * innerW);

  const grenzeMs = grenze ? new Date(grenze).getTime() : NaN;
  const zeigeGrenze = !Number.isNaN(grenzeMs) && grenzeMs >= fenster.min && grenzeMs <= fenster.max;
  const grenzeX = zeigeGrenze ? xOf(grenzeMs) : 0;

  return (
    <div>
      {/* Steuerzeile: Nebensächliches-Toggle + Zeitraum-Presets */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <ToggleChip
          label="Nebensächliches"
          selected={prefs.zeigeNebensaechlich}
          onToggle={() => setNebensaechlich(!prefs.zeigeNebensaechlich)}
        />
        <span className="flex-1" />
        <div className="inline-flex items-center gap-1">
          {PRESETS.map(p => (
            <ToggleChip
              key={p.key}
              label={p.label}
              selected={prefs.preset === p.key}
              onToggle={() => setPreset(p.key)}
            />
          ))}
        </div>
      </div>

      {/* Zeitstrahl — scrollt in seinem eigenen Container (Body nie horizontal) */}
      <div className="overflow-x-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 'var(--tf-radius)' }}>
        <div className="relative" style={{ width: LABEL_W + innerW, height: totalH }}>
          {/* Aufzeichnungsgrenze — dezente vertikale Linie über alle Lanes */}
          {zeigeGrenze ? (
            <Tooltip text="ab hier lückenlose Aufzeichnung" wrapperClassName="absolute z-[2]" wrapperStyle={{ left: LABEL_W + grenzeX - 4, top: 0, height: totalH }}>
              <span className="block relative" style={{ width: 8, height: totalH }}>
                <span className="absolute top-0 bottom-0 left-1/2" style={{ borderLeft: '1px dashed var(--tf-border)' }} />
              </span>
            </Tooltip>
          ) : null}

          {/* Verbund-Lane (nie einklappbar) */}
          <LaneRow
            label="Verbund"
            collapsible={false}
            collapsed={false}
            clusters={clustere(verbundEv, schwelleMs)}
            count={verbundEv.length}
            xOf={xOf}
            version={version}
            top={0}
          />

          {/* TV-Lanes */}
          {tvRows.map((r, i) => (
            <LaneRow
              key={r.id}
              label={r.id}
              collapsible
              collapsed={r.collapsed}
              onToggle={() => toggleLane(r.id)}
              clusters={r.collapsed ? [] : clustere(r.events, schwelleMs)}
              count={r.events.length}
              xOf={xOf}
              version={version}
              top={(i + 1) * LANE_H}
            />
          ))}

          {eventCount === 0 ? (
            <div
              className="absolute text-[11px] text-[var(--tf-text-tertiary)]"
              style={{ left: LABEL_W + 12, top: LANE_H / 2 - 8 }}
            >
              Keine Ereignisse im gewählten Zeitraum
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LaneRow({
  label,
  collapsible,
  collapsed,
  onToggle,
  clusters,
  count,
  xOf,
  version,
  top,
}: {
  label: string;
  collapsible: boolean;
  collapsed: boolean;
  onToggle?: () => void;
  clusters: Cluster[];
  count: number;
  xOf: (ms: number) => number;
  version: MappingVersion;
  top: number;
}): React.ReactElement {
  return (
    <div className="absolute left-0 right-0" style={{ top, height: LANE_H }}>
      {/* Achslinie */}
      <div
        className="absolute"
        style={{ left: LABEL_W, right: 0, top: LANE_H / 2, borderTop: '0.5px solid var(--tf-border)' }}
      />
      {/* Lane-Beschriftung + Einklapp-Chevron */}
      <div className="absolute left-0 flex items-center gap-1 h-full pr-2" style={{ width: LABEL_W }}>
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="shrink-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="shrink-0 w-[14px]" />
        )}
        <span className="truncate text-[11.5px] text-[var(--tf-text-secondary)]" title={label}>
          {label}
        </span>
      </div>
      {/* Track */}
      <div className="absolute h-full" style={{ left: LABEL_W, right: 0 }}>
        {collapsed ? (
          <div
            className="absolute text-[10.5px] text-[var(--tf-text-tertiary)]"
            style={{ left: 8, top: LANE_H / 2 - 8 }}
          >
            {count} {count === 1 ? 'Ereignis' : 'Ereignisse'}
          </div>
        ) : (
          clusters.map((c, i) => (
            <ClusterMarker key={`${c.ms}:${i}`} cluster={c} x={xOf(c.ms)} version={version} />
          ))
        )}
      </div>
    </div>
  );
}

function ClusterMarker({
  cluster,
  x,
  version,
}: {
  cluster: Cluster;
  x: number;
  version: MappingVersion;
}): React.ReactElement {
  const hasMilestone = cluster.events.some(e => e.prominenz === 'meilenstein');

  if (cluster.events.length > 1) {
    return (
      <div className="absolute" style={{ left: x, top: LANE_H / 2, transform: 'translate(-50%, -50%)' }}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full cursor-pointer"
              style={{
                width: 16,
                height: 16,
                background: hasMilestone ? 'var(--tf-primary)' : 'var(--tf-text-secondary)',
                color: 'var(--tf-on-primary)',
              }}
              title={`${cluster.events.length} Ereignisse`}
            >
              <span className="text-[9px] font-medium leading-none">{cluster.events.length}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[300px] p-3">
            <div className="text-[11px] font-medium text-[var(--tf-text-secondary)] mb-1.5">
              {cluster.events.length} Ereignisse
            </div>
            <ul className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto">
              {cluster.events.map((te, i) => (
                <li key={`${te.event.id}:${i}`}>
                  <EventZeile te={te} version={version} />
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  const te = cluster.events[0]!;
  return (
    <div className="absolute" style={{ left: x, top: LANE_H / 2, transform: 'translate(-50%, -50%)' }}>
      <Tooltip content={<EventTooltip te={te} version={version} />} maxWidth={280}>
        <span className="inline-flex items-center justify-center cursor-help">{markerDot(te.prominenz)}</span>
      </Tooltip>
      {te.prominenz === 'meilenstein' ? (
        <div className="absolute left-1/2 -translate-x-1/2 top-[12px] max-w-[120px] truncate whitespace-nowrap text-[9.5px] text-[var(--tf-text-secondary)] pointer-events-none">{feldLabel(version, te.event.feldId)}: {te.event.wert}</div>
      ) : null}
    </div>
  );
}

/** Marker-Punkt nach Prominenz. Meilenstein = Icon-Kreis (`--tf-primary`). */
function markerDot(p: Prominenz): React.ReactElement {
  if (p === 'meilenstein') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 18, height: 18, background: 'var(--tf-primary)', color: 'var(--tf-on-primary)' }}
      >
        <Milestone size={11} aria-hidden="true" />
      </span>
    );
  }
  if (p === 'nebensaechlich') {
    return <span className="inline-block rounded-full" style={{ width: 7, height: 7, border: '1px solid var(--tf-text-tertiary)', background: 'var(--tf-bg)' }} />;
  }
  return <span className="inline-block rounded-full" style={{ width: 9, height: 9, background: 'var(--tf-text-tertiary)' }} />;
}

/** Voller Event-Tooltip (Feld, Wert-Übergang, Datum + Ehrlichkeits-Zeile, Quelle). */
function EventTooltip({ te, version }: { te: TimelineEvent; version: MappingVersion }): React.ReactElement {
  const e = te.event;
  const fachlich = e.datumFachlich ? formatGermanDate(e.datumFachlich) : null;
  const erfasst = formatGermanDate(e.erfasstAm);
  const primaer = fachlich ?? erfasst;
  const zeigeErfasst = fachlich !== null && fachlich !== erfasst;
  return (
    <div className="text-[11.5px] leading-[1.5]">
      <div className="font-medium text-[var(--tf-text)]">{feldLabel(version, e.feldId)}</div>
      <div className="text-[var(--tf-text-secondary)]">
        {e.wertVorher ? <>{e.wertVorher} → </> : null}
        {e.wert}
      </div>
      <div className="text-[var(--tf-text-tertiary)] mt-0.5">{primaer}</div>
      {zeigeErfasst ? <div className="text-[var(--tf-text-tertiary)]">erfasst: {erfasst}</div> : null}
      <div className="text-[var(--tf-text-tertiary)]">{e.quelle === 'initial' ? 'Ersterfassung' : 'Import'}</div>
    </div>
  );
}

/** Kompakte Event-Zeile für die Cluster-Popover-Liste. */
function EventZeile({ te, version }: { te: TimelineEvent; version: MappingVersion }): React.ReactElement {
  const e = te.event;
  const datum = e.datumFachlich ? formatGermanDate(e.datumFachlich) : formatGermanDate(e.erfasstAm);
  return (
    <div className="flex items-baseline gap-1.5 text-[11.5px]">
      <span className="font-mono text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0">{datum}</span>
      <span className="text-[var(--tf-text-secondary)] shrink-0">{feldLabel(version, e.feldId)}</span>
      <span className="text-[var(--tf-text)] truncate">{e.wert}</span>
    </div>
  );
}
