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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { TfBoard } from '@/components/kanban/TfBoard';
import type { TfBoardBahn } from '@/components/kanban/tf-board-types';
import { LanePills, type LanePill } from '@/components/kanban/LanePills';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { getUserPresets } from '@/core/services/csv/filter/idb-filter';
import { listFiltersByProgramm } from '@/core/services/csv/filter/idb-filter';
import { applyFilters } from '@/core/services/csv/filter/engine';
import type { FilterDefinition, UserPreset } from '@/core/services/csv/filter/types';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useBereich } from '@/core/hooks/useBereich';
import { useZeilenAufgaben } from '@/core/hooks/useBestandsAufgaben';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { useInaktiveKuerzelSet } from '@/plugins/auslastung/hooks/useInaktiveKuerzelSet';
import { useShowInaktiveMasStore } from '@/plugins/antraege/useShowInaktiveMasStore';
import type { StatusCategory } from '@/core/utils/status-canonical';
import { getStatusCategoryLabel, istStatusCategory } from '@/core/utils/status-category-labels';
import { useHomeWidgets } from './useHomeWidgets';
import { WIDGET_KATALOG } from './widgetCatalog';
import {
  buildAntragKanbanLanes,
  filtereKanbanGrundmenge,
  kartenProKategorie,
  laneAccent,
  leseVollbildLanes,
  seedVollbildLanes,
  type KanbanKarte,
} from './kanbanLanes';
import { KATEGORIE_ICON } from './kanbanIcons';
import { KanbanKarteView } from './KanbanKarteView';
import { KanbanVollbild } from './KanbanVollbild';
import { useKanbanVollbild } from './useKanbanVollbild';
import type { AntragKanbanWidgetConfig } from './types';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const TITEL = 'Anträge — Kanban';

interface PresetZustand {
  preset: UserPreset | null;
  /** presetId gesetzt, aber Preset (inzwischen) gelöscht → Hinweiszeile + Fallback. */
  fehlt: boolean;
  definitions: FilterDefinition[];
}

const OHNE_PRESET: PresetZustand = { preset: null, fehlt: false, definitions: [] };

export function AntragKanbanWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const storage = useStorage();
  // Der Stichtag wird EINMAL gestempelt — alle Liegezeiten sind relativ zu ihm.
  const heuteRef = useRef<string>(new Date().toISOString());
  const widgets = useHomeWidgets();
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
  // Kürzel + Meine/Alle-Sicht — der Umschalter im Seitenkopf wirkt dadurch auch
  // auf dieses Widget (die Meta-Zeile unten nennt den geltenden Ausschnitt).
  const { mode: bearbeiterMode } = useBearbeiterSicht();
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

  // Inaktiv-Ausschluss wie im Dashboard und in der Zieltabelle (v4.131) — ohne
  // ihn zählte das Kanban im „alle"-Modus Anträge mit, die die Liste ausblendet.
  const inaktiveKuerzel = useInaktiveKuerzelSet();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);
  const grundmenge = useMemo(
    () => filtereKanbanGrundmenge(antraege, bearbeiterMode, {
      kuerzel: inaktiveKuerzel, zeigen: showInaktive,
    }),
    [antraege, bearbeiterMode, inaktiveKuerzel, showInaktive],
  );

  const basis = useMemo(
    () => (presetZustand.preset
      ? applyFilters(grundmenge, presetZustand.preset.snapshot, presetZustand.definitions)
      : grundmenge),
    [grundmenge, presetZustand],
  );

  // Die Karten sagen dieselbe Aufgabe wie die Zeile darüber und das Board —
  // aus der To-do-Kaskade, mit der alten Status-Formel als Rückfall (v4.132).
  const aufgaben = useZeilenAufgaben('leerlauf', heuteRef.current);

  const { lanes, gesamt, ausserhalb, ausserhalbNach } = useMemo(
    () => buildAntragKanbanLanes(basis, cfg.lanes, cfg.maxKartenProLane, Date.now(), aufgaben),
    [basis, cfg.lanes, cfg.maxKartenProLane, aufgaben],
  );

  // Was NICHT in den Bahnen steht, mit Namen (v4.134). „163 weitere" sagt, dass
  // etwas fehlt, nicht was — und wer die Zahl nicht einordnen kann, vermutet
  // einen Verlust. Aufgezählt sind es beendete Vorgänge.
  const ausserhalbTitel = useMemo(() => {
    if (ausserhalb === 0) return undefined;
    const teile = ausserhalbNach
      .map(a => `${a.anzahl.toLocaleString('de-DE')}× ${getStatusCategoryLabel(a.kategorie)}`)
      .join(' · ');
    return `${ausserhalb.toLocaleString('de-DE')} weitere Vorgänge liegen in Kategorien, die dieses`
      + ` Kanban nicht als Bahn führt: ${teile}. Die Bahnen wählen Sie in den`
      + ` Widget-Einstellungen.`;
  }, [ausserhalb, ausserhalbNach]);

  const pills = useMemo(
    (): LanePill[] => lanes.map((lane, i) => ({
      key: lane.kategorie,
      label: getStatusCategoryLabel(lane.kategorie),
      accent: laneAccent(cfg.farbmodus, lane.kategorie, i),
      gesamt: lane.gesamt,
    })),
    [lanes, cfg.farbmodus],
  );

  // „+ N weitere →" — **die Liste zeigt danach die Bahn, die den Klick trug**
  // (v4.131). Die Sicht bleibt „Alle": die Lanes binden an Status-Kategorien und
  // dürfen eine `begleitung`-Lane führen, während `filtereKanbanGrundmenge` gar
  // nicht nach Status filtert — in der Sicht „Antragsphase" fehlten genau diese
  // Karten nach dem Klick. Zusätzlich setzt der Klick jetzt den Status-Filter
  // auf die Kategorie der Bahn: „+ 2 weitere" führte bis dahin in die
  // ungefilterte Liste, in der die zwei gemeinten Vorgänge zwischen tausenden
  // standen. Der Filter erzeugt einen sichtbaren, entfernbaren Chip
  // (`chipActive` in AntraegeMain) — kein unsichtbar weiterfilternder Zustand.
  //
  // Der Ausschnitt liegt in einem transienten Store-Slot, NICHT in der
  // Filter-Engine: `useFilterState.init()` läuft beim Mount der Zielseite und
  // ersetzt `active` durch den persistierten Stand — ein vorher gesetzter
  // Engine-Filter war im Moment der Navigation wieder weg (gemessen: die
  // Status-Pille stand danach auf „Alle"). Dieselbe Bauart wie der
  // Ampel-Quickfilter des Antragseingang-Widgets, inklusive Chip.
  //
  // Reihenfolge: erst `setActiveView` (das räumt die Quickfilter ab), dann der
  // Ausschnitt — sonst nähme der Sicht-Wechsel ihn gleich wieder mit.
  const openLane = (kategorie: StatusCategory): void => {
    const store = useAntraegeStore.getState();
    store.setActiveView('alle');
    store.setKategorieQuickfilter(kategorie);
    navigate('antraege');
  };

  // **Die Meta-Zeile sagt, was eine Karte IST** (v4.134). Ohne das stand auf
  // einem Bildschirm dreimal dasselbe Wort für drei Mengen: „34 offene
  // Vorgänge" (Teilvorhaben), „21 Vorgänge" (Verbünde) und „37 Teilvorhaben".
  // Die Zahl ist nicht falsch — sie sagte nur nicht, was sie zählt.
  const meta = `${bearbeiterScopeLabel(bearbeiterMode)} · Verbünde als eine Karte`
    + ` · Quelle: Förderanträge${presetZustand.preset ? ` · Filter „${presetZustand.preset.name}"` : ''}`;

  // ── Vollbild-Fenster ────────────────────────────────────────────────────────
  // Das Widget liefert dem Fenster DATEN, keine fertigen Bahnen: welche Bahn dort
  // steht, entscheidet seit v4.26 seine eigene Einstellung (`vollbildLanes`) —
  // und die soll auch dann noch wirken, wenn die Startseite ausgehängt ist.
  // Beides steht absichtlich IM Rumpf von `zeichneVollbild` und nicht in einem
  // `useMemo`: der Hook ruft die Funktion nur bei offenem Fenster, und
  // `useCallback` bindet sie an dieselben Daten-Abhängigkeiten. Ohne offenes
  // Fenster wird die zweite Projektion damit nie gerechnet.
  //
  // Geschrieben wird auf den AKTUELLEN Stand (`mutiereConfig`) und nicht auf das
  // `cfg` aus diesem Rendervorgang: das Fenster lebt weiter, wenn die Startseite
  // längst ausgehängt ist — ein mitgeschlepptes `cfg` nähme fremde Änderungen
  // zurück.
  const aendereVollbild = useCallback(
    (patch: Partial<AntragKanbanWidgetConfig>): void => {
      void widgets.mutiereConfig(instanz.id, alt =>
        (alt.art === 'kanban' && alt.quelle === 'antraege' ? { ...alt, ...patch } : alt));
    },
    [widgets, instanz.id],
  );
  const merkeEingeklappt = useCallback((bahnen: string[]): void => {
    aendereVollbild({ vollbildEingeklappt: bahnen.filter(istStatusCategory) });
  }, [aendereVollbild]);

  const zeichneVollbild = useCallback((verwaist: boolean): React.ReactNode => {
    const karten = kartenProKategorie(basis, Date.now(), aufgaben);
    // Der Startvorschlag wird immer gerechnet, nicht nur beim ersten Öffnen: er
    // ist auch der Weg zurück („Anordnung zurücksetzen").
    const seed = seedVollbildLanes(karten, cfg.lanes);
    return (
      <KanbanVollbild
        titel={TITEL}
        meta={meta}
        karten={karten}
        lanesInitial={leseVollbildLanes(cfg.vollbildLanes, seed)}
        onLanes={vollbildLanes => aendereVollbild({ vollbildLanes })}
        seed={seed}
        farbmodus={cfg.farbmodus}
        onFarbmodus={farbmodus => aendereVollbild({ farbmodus })}
        verwaist={verwaist}
        eingeklappt={cfg.vollbildEingeklappt}
        onEinklapp={merkeEingeklappt}
        onOpenAntrag={az => {
          navigate('antraege', { selectedId: az });
          // Die App steht hinter dem Fenster — ohne das sähe der Klick aus, als
          // wäre nichts passiert.
          window.focus();
        }}
      />
    );
  }, [
    basis, cfg.lanes, cfg.farbmodus, cfg.vollbildLanes, cfg.vollbildEingeklappt,
    meta, navigate, aendereVollbild, merkeEingeklappt,
  ]);
  const vollbild = useKanbanVollbild(instanz.id, TITEL, zeichneVollbild);

  return (
    <WidgetShell
      titel={TITEL}
      meta={meta}
      variante="haupt"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      aktionRechts={
        <button
          type="button"
          // SYNCHRON, kein useAsyncAction: window.open überlebt nur innerhalb
          // der User-Geste (vgl. SeitenHilfeButton).
          onClick={vollbild.oeffne}
          aria-label="Kanban im eigenen Fenster öffnen"
          title="Alle Bahnen im eigenen Fenster öffnen"
          className="w-7 h-7 grid place-items-center rounded-[var(--tf-radius-sm)] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          <Maximize2 size={12} />
        </button>
      }
      zaehler={
        instanz.eingeklappt
          ? <LanePills pills={pills} />
          : (
            // Die Zahl summiert die GEZEIGTEN Bahnen. Liegt etwas außerhalb,
            // sagt der Zähler es — sonst liest sich ein Auszug als Gesamtzahl
            // („25 Vorgänge", während 7 weitere in nicht geführten Kategorien
            // liegen). Seit v4.134 nennt der Tooltip auch, WELCHE Kategorien das
            // sind. Die Bahnen wählt man in den Widget-Einstellungen.
            <span
              className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]"
              title={ausserhalbTitel}
            >
              {ausserhalb > 0
                ? `${gesamt.toLocaleString('de-DE')} von ${(gesamt + ausserhalb).toLocaleString('de-DE')} Vorgängen`
                : `${gesamt.toLocaleString('de-DE')} ${gesamt === 1 ? 'Vorgang' : 'Vorgänge'}`}
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
      {/* Die App hat kein Toast-System; ein blockiertes Fenster muss trotzdem
          gesagt werden — sonst sieht der Knopf aus, als täte er nichts. */}
      {vollbild.blockiert ? (
        <p className="text-[12px] text-[var(--tf-warning-text)] mb-2">
          Das eigene Fenster wurde vom Browser blockiert. Pop-ups für diese Seite
          erlauben, dann erneut auf das Vollbild-Zeichen klicken.
        </p>
      ) : null}
      <TfBoard
        label="Anträge nach Status-Kategorie"
        layout="geteilt"
        // Wie im Feedback-Board: der Bahnkopf ist der Einklapp-Schalter, und die
        // leere Schiene wird bedienbar. Ohne das Flag ist sie im Widget stumm —
        // 44 px, die aussehen wie ein Knopf und keiner sind. Der Zustand bleibt
        // flüchtig (Widget-Collapse hängt den Body ohnehin aus dem DOM).
        features={{ einklappbar: true }}
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
            <button
              type="button"
              onClick={() => openLane(lane.kategorie)}
              title={`Öffnet die Förderanträge-Liste, gefiltert auf „${getStatusCategoryLabel(lane.kategorie)}"`}
              className="tfb-fuss"
            >
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
