/**
 * Anträge-Kanban-Widget (Home, Hauptbereich — Phase 2). Die Feedback-Quelle
 * lebt in FeedbackKanbanWidget; der KanbanWidget-Dispatcher verzweigt nach
 * `config.quelle`, hier landet also stets ein Anträge-Kanban.
 *
 * Read-only + Navigation: Karten öffnen die Detailansicht, „+ N weitere →"
 * die gefilterte Liste — KEIN Karten-Drag (das Primitiv bekommt schlicht keine
 * `dnd`-Naht), kein Detail-Editing. Das ist hier keine Sparmaßnahme: der
 * Antrags-Status kommt aus dem Fachsystem C16, die App leitet keinen ab
 * (Pitfall #44) — eine Karte in eine andere Bahn zu ziehen hätte nichts, wohin
 * es geschrieben werden könnte. Datenbasis: Bearbeiter-gefilterte Grundmenge
 * (identische Semantik wie useEingangAmpelCounts) oder ein gespeicherter
 * Filter (UserPreset über die bestehende Filter-Engine). Lanes = konfigurierte
 * Status-KATEGORIEN (Pitfall #12). Die Meta-Zeile macht den Bearbeiter-Modus
 * sichtbar (bearbeiterScopeLabel: „Kürzel THU" vs. „Alle Bearbeiter").
 */
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  CheckCircle2,
  FileQuestion,
  Handshake,
  HelpCircle,
  Inbox,
  Scale,
  Search,
  XCircle,
} from 'lucide-react';
import { TfBoard } from '@/components/kanban/TfBoard';
import type { TfBoardBahn } from '@/components/kanban/tf-board-types';
import { LanePills, type LanePill } from '@/components/kanban/LanePills';
import { alterInTagen } from '@/core/utils/relativeZeit';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useProfile } from '@/core/hooks/useProfile';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { getUserPresets } from '@/core/services/csv/filter/idb-filter';
import { listFiltersByProgramm } from '@/core/services/csv/filter/idb-filter';
import { applyFilters } from '@/core/services/csv/filter/engine';
import type { FilterDefinition, UserPreset } from '@/core/services/csv/filter/types';
import type { StatusCategory } from '@/core/utils/status-canonical';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useBereich } from '@/core/hooks/useBereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import { bearbeiterScopeLabel, parseBearbeiterFilter } from '@/plugins/antraege/bearbeiterFilter';
import { getStatusCategoryLabel } from '@/core/utils/status-category-labels';
import { WIDGET_KATALOG } from './widgetCatalog';
import {
  buildAntragKanbanLanes,
  filtereKanbanGrundmenge,
  laneAccent,
  type KanbanKarte,
} from './kanbanLanes';
import type { AntragKanbanWidgetConfig } from './types';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

/** Lane-Kopf-Glyphen je Status-Kategorie (analog STATUS_COLUMN_ICONS im Feedback-Board). */
const KATEGORIE_ICON: Record<StatusCategory, LucideIcon> = {
  offen: Inbox,
  in_pruefung: Search,
  nachforderung: FileQuestion,
  entscheidung: Scale,
  bewilligt: CheckCircle2,
  begleitung: Handshake,
  abgelehnt: XCircle,
  abgeschlossen: Archive,
  sonstige: HelpCircle,
};

interface PresetZustand {
  preset: UserPreset | null;
  /** presetId gesetzt, aber Preset (inzwischen) gelöscht → Hinweiszeile + Fallback. */
  fehlt: boolean;
  definitions: FilterDefinition[];
}

const OHNE_PRESET: PresetZustand = { preset: null, fehlt: false, definitions: [] };

export function AntragKanbanWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
  const alleAntraege = useAntraegeStore(s => s.antraege);
  const bereichMenge = useBereich().menge;
  // Arbeitsvorrat-Widget ⇒ Betrachtungsbereich, wie die Liste (Pitfall #46).
  const antraege = useMemo(
    () => (bereichMenge === null
      ? alleAntraege
      : alleAntraege.filter(a => istImBereich(a.unterprogramm_id, bereichMenge))),
    [alleAntraege, bereichMenge],
  );
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);

  // Defensive: fremde/alte Config-Stände fallen auf die Katalog-Defaults zurück.
  // (Feedback-Quellen erreichen diese Komponente nicht — der Dispatcher trennt.)
  const cfg: AntragKanbanWidgetConfig =
    instanz.config.art === 'kanban' && instanz.config.quelle === 'antraege'
      ? instanz.config
      : (WIDGET_KATALOG.kanban.defaultConfig() as AntragKanbanWidgetConfig);

  const [presetZustand, setPresetZustand] = useState<PresetZustand>(OHNE_PRESET);
  useEffect(() => {
    let cancelled = false;
    if (!cfg.presetId || !activeProgrammId) {
      setPresetZustand(OHNE_PRESET);
      return;
    }
    void (async () => {
      try {
        const [presets, definitions] = await Promise.all([
          getUserPresets(storage.idb, activeProgrammId),
          listFiltersByProgramm(storage.idb, activeProgrammId),
        ]);
        if (cancelled) return;
        const preset = presets.find(p => p.id === cfg.presetId) ?? null;
        setPresetZustand({ preset, fehlt: !preset, definitions });
      } catch {
        if (!cancelled) setPresetZustand(OHNE_PRESET);
      }
    })();
    return () => { cancelled = true; };
  }, [cfg.presetId, activeProgrammId, storage.idb]);

  const bearbeiterMode = useMemo(
    () => parseBearbeiterFilter(meinKuerzel, profile?.bearbeiter_inkl_begleitung),
    [meinKuerzel, profile?.bearbeiter_inkl_begleitung],
  );

  const grundmenge = useMemo(
    () => filtereKanbanGrundmenge(antraege, bearbeiterMode),
    [antraege, bearbeiterMode],
  );

  const basis = useMemo(
    () => (presetZustand.preset
      ? applyFilters(grundmenge, presetZustand.preset.snapshot, presetZustand.definitions)
      : grundmenge),
    [grundmenge, presetZustand],
  );

  const { lanes, gesamt } = useMemo(
    () => buildAntragKanbanLanes(basis, cfg.lanes, cfg.maxKartenProLane),
    [basis, cfg.lanes, cfg.maxKartenProLane],
  );

  const pills = useMemo(
    (): LanePill[] => lanes.map((lane, i) => ({
      key: lane.kategorie,
      label: getStatusCategoryLabel(lane.kategorie),
      accent: laneAccent(cfg.farbmodus, lane.kategorie, i),
      gesamt: lane.gesamt,
    })),
    [lanes, cfg.farbmodus],
  );

  // „+ N weitere →" / „Alle" — bestehendes store-getriebenes Muster (kein
  // eigener Routen-Mechanismus). Ziel ist immer die Voll-Liste: die Lanes
  // binden an Status-Kategorien und dürfen eine `begleitung`-Lane führen,
  // während `filtereKanbanGrundmenge` gar nicht nach Status filtert. In der
  // Sicht „Antragsphase" fehlten genau diese Karten nach dem Klick.
  const openListe = (): void => {
    useAntraegeStore.getState().setActiveView('alle');
    navigate('antraege');
  };

  const meta = `${bearbeiterScopeLabel(bearbeiterMode)} · Quelle: Förderanträge${presetZustand.preset ? ` · Filter „${presetZustand.preset.name}"` : ''}`;

  return (
    <WidgetShell
      titel="Anträge — Kanban"
      meta={meta}
      variante="haupt"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        instanz.eingeklappt
          ? <LanePills pills={pills} />
          : (
            <span className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]">
              {gesamt.toLocaleString('de-DE')} {gesamt === 1 ? 'Vorgang' : 'Vorgänge'}
            </span>
          )
      }
    >
      {presetZustand.fehlt ? (
        <p className="text-[12px] text-[var(--tf-warning-text)] mb-2">
          Gespeicherter Filter nicht mehr vorhanden — es wird die ungefilterte
          Grundmenge angezeigt.
        </p>
      ) : null}
      <TfBoard
        label="Anträge nach Status-Kategorie"
        layout="geteilt"
        bahnen={lanes.map((lane, i): TfBoardBahn<KanbanKarte> => ({
          key: lane.kategorie,
          label: getStatusCategoryLabel(lane.kategorie),
          icon: KATEGORIE_ICON[lane.kategorie],
          accent: laneAccent(cfg.farbmodus, lane.kategorie, i),
          items: lane.karten,
          gesamt: lane.gesamt,
          spalten: lane.spalten,
          // Kein `nachladen`: hier wird nicht mehr DOM nachgeladen, sondern die
          // Ansicht gewechselt — die Kappung ist Datenlage (maxKartenProLane).
          fuss: lane.gesamt > lane.karten.length ? (
            <button type="button" onClick={openListe} className="tfb-fuss">
              + {lane.gesamt - lane.karten.length} weitere →
            </button>
          ) : undefined,
        }))}
        renderCard={k => (
          <KanbanKarteView key={k.aktenzeichen} karte={k} onOpen={() => navigate('antraege', { selectedId: k.aktenzeichen })} />
        )}
      />
    </WidgetShell>
  );
}

/** Kompakt-Karte: Akronym, nächster Schritt, Meta (TV-Zahl bzw. FKZ · Alter). */
function KanbanKarteView({ karte, onOpen }: { karte: KanbanKarte; onOpen: () => void }): React.ReactElement {
  const alter = alterInTagen(karte.alterTage);
  const herkunft = karte.tvCount > 1 ? `${karte.tvCount} TV` : karte.aktenzeichen;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left rounded-[10px] bg-[var(--tf-bg)] hover:bg-[var(--tf-bg-secondary)] transition-colors cursor-pointer px-3 py-2.5"
      style={{ border: '0.5px solid var(--tf-border)', borderLeft: '2.5px solid var(--tf-border-hover)' }}
    >
      <p className="text-[13px] font-medium text-[var(--tf-text)] truncate" title={karte.label}>
        {karte.label}
      </p>
      {karte.schrittText ? (
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--tf-text-secondary)] line-clamp-2">
          {karte.schrittText}
        </p>
      ) : null}
      <p className="mt-1.5 text-[11px] tabular-nums text-[var(--tf-text-tertiary)] truncate">
        {herkunft}{alter ? ` · ${alter}` : ''}
      </p>
    </button>
  );
}
