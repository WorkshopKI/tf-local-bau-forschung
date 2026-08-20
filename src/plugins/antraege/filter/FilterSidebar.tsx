import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, BookmarkPlus } from 'lucide-react';
import { EinklappButton } from '@/components/ui/EinklappIcon';
import { useStorage } from '@/core/hooks/useStorage';
import { Input } from '@/components/ui/input';
import type { KopfHoehen } from '@/components/data-table';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { useFilteredAntraege } from '../useFilteredAntraege';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { useShowInaktiveMasStore } from '../useShowInaktiveMasStore';
import { useFilterState } from './useFilterState';
import { FilterSidebarItem } from './FilterSidebarItem';
import { SavePresetDialog } from './SavePresetDialog';
import { VerlaufMenue } from './VerlaufMenue';
import {
  getVerlauf,
  recordFilterApply,
  getEntryCount,
  isHintDismissed,
  dismissHint,
  signatureOf,
  PRESET_HINT_THRESHOLD,
  type FrequentEntryView,
} from './frequentFilters';
import { PresetSuggestionBanner } from './PresetSuggestionBanner';
import { usePinnedFilters } from './pinnedFilters';

interface Props {
  search: string;
  onSearchChange: (s: string) => void;
  /** Wenn true: Quicksearch-Input ausblenden (Drawer-Modus, wenn Search im Header schon vorhanden ist). */
  hideSearch?: boolean;
  /** Einklappen aus der Leiste heraus. Ohne die Prop zeigt der Kopf kein
   *  Einklapp-Icon — im Drawer schließt die Überlagerung selbst, ein zweiter
   *  Weg dorthin wäre eine Attrappe. */
  onCollapse?: () => void;
  /**
   * Gemessene Höhen des Tabellenkopfes daneben. Gesetzt heisst KOPFBAND: der
   * Kopf der Leiste wird zum ersten Abschnitt des Tabellenkopfes — dieselbe
   * Fläche, dieselben Zeilenhöhen, eine durchlaufende Haarlinie.
   *
   * `null` (Voreinstellung) heisst: es gibt keinen Tabellenkopf, an dem sich das
   * ausrichten liesse — Listen- und Karten-Ansicht, Leerzustände, der Drawer.
   * Dann trägt die Leiste ihren gewohnten Kopf.
   */
  band?: KopfHoehen | null;
}

function SectionHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-center px-1.5 pt-1 pb-1.5">
      <span
        className="text-[10.5px] font-medium uppercase text-[var(--tf-text-tertiary)]"
        style={{ letterSpacing: '0.08em' }}
      >
        {title}
      </span>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </div>
  );
}

function Hairline(): React.ReactElement {
  return <div className="my-2 h-px bg-[var(--tf-border)]" />;
}

export function FilterSidebar({
  search,
  onSearchChange,
  hideSearch = false,
  onCollapse,
  band = null,
}: Props): React.ReactElement {
  const storage = useStorage();
  /**
   * **Die Basis der Facetten-Zahlen ist DIESELBE Menge wie die Liste darunter**
   * — Betrachtungsbereich, Sicht, Irrläufer-Vorfilter, Kürzel-Zuschnitt und
   * Inaktiv-Ausschluss inklusive (Pitfall #46).
   *
   * Bis v4.121 bekam die Leiste die rohe Store-Liste hereingereicht (14 225
   * Anträge). Die Zahlen daneben waren damit eine Zusage, die die Liste nicht
   * einlöste: im Reiter „Antragsphase" bot die Richtlinien-Facette „36 (1 373)"
   * an — und der Klick darauf lieferte null Zeilen. 11 von 16 Werten liefen so
   * ins Leere. Jede andere zählende Oberfläche (Pin-Leiste, Quickfilter-Pillen)
   * nimmt seit jeher `countBase`; die Leiste war der einzige Ausreisser.
   */
  const { countBase } = useFilteredAntraege();
  const {
    definitions,
    active,
    presets,
    activePresetId,
    valueLabels,
    setActiveValue,
    clearAll,
    savePreset,
    loadPreset,
    deletePreset,
  } = useFilterState();
  // „Anträge inaktiver Bearbeiter" ist ein Mengen-Schalter wie jeder andere hier
  // und stand bis v4.64 als Häkchen „inaktive MAs" in der Suchzeile — neben dem
  // Suchfeld, wo er nichts zu suchen hatte. Der Zustand selbst bleibt geteilt
  // (`useShowInaktiveMasStore`, zweite Oberfläche in den Einstellungen).
  const { mode: bearbeiterMode } = useBearbeiterSicht();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);
  const setShowInaktive = useShowInaktiveMasStore(s => s.setShowInaktive);
  // Mit aktivem Kürzel-Filter wirkt er nicht (die Sicht ist dann ohnehin auf
  // eine Person geschnitten) — ein Häkchen ohne Wirkung wäre irreführend.
  const zeigeInaktivSchalter = isAuslastungFreigeschaltet() && !bearbeiterMode.active;
  const umschaltenPin = usePinnedFilters(s => s.umschalten);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [verlauf, setVerlauf] = useState<FrequentEntryView[]>(() => getVerlauf(5, [], {}));
  /** Tick zum Re-Render nach dismissHint (localStorage-Lookup happens in render). */
  const [hintTick, setHintTick] = useState(0);

  const visibleDefs = useMemo(
    () => definitions.filter(d => !d.versteckt).sort((a, b) => a.anzeige_reihenfolge - b.anzeige_reihenfolge),
    [definitions],
  );

  // Status-Definition heraussplitten — der Rest wird unten als One-Liner gerendert.
  const { statusDef, otherDefs } = useMemo(() => {
    let st: typeof visibleDefs[number] | undefined;
    const others: typeof visibleDefs = [];
    for (const d of visibleDefs) {
      if (d.feld === 'status' && !st) st = d;
      else others.push(d);
    }
    return { statusDef: st, otherDefs: others };
  }, [visibleDefs]);

  const statusActiveCount = useMemo(() => {
    if (!statusDef) return 0;
    const af = active.find(a => a.filterId === statusDef.id);
    if (!af) return 0;
    if (Array.isArray(af.value)) return af.value.length;
    return af.value ? 1 : 0;
  }, [statusDef, active]);

  // Verlaufs-Aufzeichnung: bei jedem aktiven Set mit Debounce in localStorage
  // schreiben und die jüngsten fünf frisch laden. Leeres Set wird nicht
  // aufgezeichnet (siehe recordFilterApply).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (active.length > 0) recordFilterApply(active, definitions);
      setVerlauf(getVerlauf(5, definitions, valueLabels));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [active, definitions, valueLabels]);

  const applyVerlauf = (entry: FrequentEntryView): void => {
    // Wiederherstellen heißt: GENAU dieser Stand. Der Eintrag ist der ganze
    // Filterstand von damals, nicht ein einzelner Wert — deshalb erst leeren,
    // dann setzen. Wer dazulegen will, pinnt den Satz an.
    clearAll();
    for (const af of entry.appliedFilters) {
      setActiveValue(af.filterId, af.value);
    }
  };

  const hasActive = active.length > 0;
  const activePreset = presets.find(p => p.id === activePresetId) ?? null;

  // Auto-Preset-Vorschlag: aktuelle Kombi wurde >= PRESET_HINT_THRESHOLD-mal
  // angewendet, ist noch nicht als Preset aktiv, und wurde noch nicht
  // weggeklickt. `hintTick` triggert nach Dismiss-Klick einen Re-Render.
  const presetHint = useMemo(() => {
    if (!hasActive || activePreset) return null;
    const sig = signatureOf(active);
    const count = getEntryCount(active);
    if (count < PRESET_HINT_THRESHOLD) return null;
    if (isHintDismissed(sig)) return null;
    return { signature: sig, count };
    // hintTick als Dep, damit Dismiss-Klick einen Re-Render auslöst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasActive, activePreset, hintTick]);

  return (
    <div
      // FLÄCHE STATT STRICH (v4.64): die Leiste steht auf derselben leichten
      // Grundfläche wie der Tabellenkopf — zusammen legen die beiden ein graues L
      // um die weiße Datenfläche. Das trennt schon von sich aus, und die
      // Trennlinie an der rechten Kante ist deshalb entfallen. Das L beginnt
      // unter der Trennlinie des Seitenkopfes: der Kopf selbst ist weiß, wie in
      // der Vorlage (v4.70 — die Ausweitung des Graus nach oben verschluckte die
      // Oberkante der Tabelle).
      // Achtung bei Ergänzungen hier drin: `--tf-bg-secondary` ist DECKEND und
      // damit auf dieser Fläche unsichtbar. Hover/aktiv gehen über das
      // durchscheinende `--tf-hover`, abgesetzte Pillen über `--tf-bg`.
      className="flex flex-col h-full bg-[var(--tf-bg-secondary)]"
    >
      {/* KOPFBAND (v4.76): zwei Zeilen in der GEMESSENEN Höhe des Tabellenkopfes
          daneben — Zeile 1 ist seine Rubrikzeile, Zeile 2 seine Spaltenzeile.
          Die senkrechte Kante rechts ist die Fortsetzung der Rubriktrenner und
          gilt NUR im Band; darunter trennt weiter der Farbwechsel.
          Der 13,5-px-Titel „Filter" entfällt hier: die Rubrikzeile trägt ihn,
          und zwei Kopf-Sorten auf einer Höhe sagten sich gegenseitig nichts. */}
      {band ? (
        // Die Geometrie ist die des Tabellenkastens daneben, Stück für Stück:
        // sein 0,5-px-Rahmen liegt AUSSERHALB des Kopfes (deshalb `borderTop`
        // hier aussen), seine Unterkante liegt INNERHALB (Schatten statt
        // Rahmen, gleiche Begründung wie `STICKY_KOPF_UNTERKANTE`). Ohne diese
        // Unterscheidung sitzen die beiden Haarlinien 1 px versetzt.
        <div
          className="shrink-0"
          style={{
            borderTop: '0.5px solid var(--tf-border)',
            borderRight: '0.5px solid var(--tf-border)',
          }}
        >
          <div
            className="flex flex-col items-stretch"
            style={{ height: band.gesamt, boxShadow: 'inset 0 -0.5px 0 var(--tf-border)' }}
          >
            {/* Zeile 1 = Rubrikzeile: unten ausgerichtet wie die `align-bottom`-
                Zellen daneben, gleiche 2 px Grundabstand. */}
            <div
              className="flex shrink-0 items-end truncate text-[10px] uppercase text-[var(--tf-text-tertiary)]"
              style={{
                height: band.rubrik,
                padding: '0 16px 2px',
                letterSpacing: '0.08em',
              }}
            >
              Filter
            </div>
            {/* Zeile 2 = Spaltenzeile: mittig wie die `align-middle`-Zellen. */}
            <div
              className="flex min-h-0 flex-1 items-center gap-2"
              style={{ padding: '0 12px 0 16px' }}
            >
              <VerlaufMenue eintraege={verlauf} onAnwenden={applyVerlauf} />
              {/* „0 AKTIV" im Akzent behauptete einen Zustand, der keiner ist —
                  die Zahl erscheint erst, wenn etwas filtert. */}
              {active.length > 0 ? (
                <span
                  className="ml-auto text-[10.5px] font-medium uppercase"
                  style={{ color: 'var(--tf-primary)', letterSpacing: '0.06em' }}
                >
                  {active.length} aktiv
                </span>
              ) : null}
              {onCollapse ? (
                <EinklappButton
                  offen
                  onClick={onCollapse}
                  label="Filterleiste einklappen"
                  className={active.length > 0 ? undefined : 'ml-auto'}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="shrink-0 flex items-center justify-between gap-2"
          style={{ padding: '10px 12px 8px 16px', borderBottom: '0.5px solid var(--tf-border)' }}
        >
          {/* Der Verlauf steht DIREKT beim Titel, nicht bei den Zustands-Anzeigen
              rechts: er ist ein täglich benutzter Einstieg, kein Statuswert. Die
              Zahl „N aktiv" berichtet nur und rückt dafür nach rechts zum
              Einklapp-Knopf. */}
          <div className="flex min-w-0 items-center gap-1">
            <span className="text-[13.5px] font-medium text-[var(--tf-text)]">Filter</span>
            <VerlaufMenue eintraege={verlauf} onAnwenden={applyVerlauf} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              {active.length} aktiv
            </span>
            {onCollapse ? (
              <EinklappButton offen onClick={onCollapse} label="Filterleiste einklappen" />
            ) : null}
          </div>
        </div>
      )}

      {/* Optional Quicksearch (Antraege-Volltext) — nur im non-Drawer-Modus. */}
      {!hideSearch && (
        <div className="shrink-0 p-3" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
          <Input
            placeholder="Anträge suchen …"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      )}

      {/* Preset-Indicator */}
      {activePreset ? (
        <div className="mx-3 mt-3 flex items-center gap-2 text-[11.5px] text-[var(--tf-text-secondary)]">
          <span className="px-2 py-0.5 rounded-full bg-[var(--tf-bg)] truncate">
            Preset: {activePreset.name}
          </span>
        </div>
      ) : null}

      {/* Auto-Preset-Vorschlag */}
      {presetHint ? (
        <PresetSuggestionBanner
          count={presetHint.count}
          onPin={() => {
            dismissHint(presetHint.signature);
            setHintTick(t => t + 1);
            // Derselbe Pin, den die Nadel im Verlauf setzt — eine Mechanik, zwei
            // Einstiege. `umschalten` legt an oder nimmt weg; hier ist er neu.
            umschaltenPin({
              art: 'kombination',
              signatur: presetHint.signature,
              gesetzt: active.map(af => ({ ...af })),
            });
          }}
          onSave={() => {
            dismissHint(presetHint.signature);
            setHintTick(t => t + 1);
            setPresetDialogOpen(true);
          }}
          onDismiss={() => {
            dismissHint(presetHint.signature);
            setHintTick(t => t + 1);
          }}
        />
      ) : null}

      {/* Scrollbarer Body.
          Die „Schnellauswahl" stand hier bis v4.65 als erster Abschnitt — fünf
          Chips, die wörtlich die Sicht-Reiter zwei Zeilen weiter oben spiegelten
          (gleicher `activeView`, gleiche Zähler, gleiche Beschriftung). Dasselbe
          Wort stand dadurch dreimal auf einem Bildschirm. Der Verlauf sitzt jetzt
          im Kopf der Leiste, nicht mehr in ihrem Rumpf. */}
      <div
        className="flex-1 overflow-y-auto"
        // Im Band-Zustand rückt der Rumpf nach oben, damit die Abschnittszeile
        // „STATUS" auf der Grundlinie des ersten Tabellenbands sitzt — am
        // gerenderten Bild gemessen, nicht gerechnet: mit den bisherigen 6 px
        // lag sie 2,5 px zu tief.
        style={{ padding: band ? '3.5px 12px 8px' : '6px 12px 8px' }}
      >
        {visibleDefs.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[var(--tf-text-tertiary)]">
            Keine Filter vorhanden.
          </div>
        ) : (
          <>
            {/* Status (Phasen-Akkordeon) — ohne führende `Hairline`: der Kopf der
                Leiste zieht seine eigene Unterkante, und beide zusammen ergaben
                zwei Striche im Abstand von 18 px mit nichts dazwischen (v4.70).
                Ein Trenner steht nur ZWISCHEN Blöcken. */}
            {statusDef ? (
              <>
                <SectionHeader
                  title="Status"
                  trailing={
                    statusActiveCount > 0 ? (
                      <span
                        className="text-[10.5px] font-medium normal-case"
                        style={{ color: 'var(--tf-primary)', letterSpacing: 0 }}
                      >
                        {statusActiveCount} aktiv
                      </span>
                    ) : null
                  }
                />
                <FilterSidebarItem
                  def={statusDef}
                  antraege={countBase}
                  activeFilters={active}
                  definitions={definitions}
                  valueLabels={valueLabels[statusDef.feld]}
                  onChange={v => setActiveValue(statusDef.id, v)}
                  hideHeader
                />
              </>
            ) : null}

            {/* Restliche Filter-Gruppen (One-Liner) */}
            {otherDefs.length > 0 ? (
              <>
                {statusDef ? <Hairline /> : null}
                {otherDefs.map(def => (
                  <FilterSidebarItem
                    key={def.id}
                    def={def}
                    antraege={countBase}
                    activeFilters={active}
                    definitions={definitions}
                    valueLabels={valueLabels[def.feld]}
                    onChange={v => setActiveValue(def.id, v)}
                  />
                ))}
              </>
            ) : null}
          </>
        )}

        {zeigeInaktivSchalter ? (
          <>
            {visibleDefs.length > 0 ? <Hairline /> : null}
            <SectionHeader title="Bestand" />
            <label className="flex cursor-pointer select-none items-center gap-2 px-1.5 py-1 text-[12px] text-[var(--tf-text-secondary)]">
              <input
                type="checkbox"
                checked={showInaktive}
                onChange={e => setShowInaktive(e.target.checked)}
                className="accent-[var(--tf-primary)] cursor-pointer"
              />
              Anträge inaktiver Bearbeiter einblenden
            </label>
          </>
        ) : null}
      </div>

      {/* Footer */}
      <div
        className="shrink-0 flex flex-col gap-1.5"
        style={{ padding: '10px 16px', borderTop: '0.5px solid var(--tf-border)' }}
      >
        <button
          type="button"
          onClick={clearAll}
          disabled={!hasActive}
          className="flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={12} />
          Alle Filter zurücksetzen
        </button>
        <button
          type="button"
          onClick={() => setPresetDialogOpen(true)}
          disabled={!hasActive}
          className="flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <BookmarkPlus size={12} />
          Als Preset speichern
        </button>

        {presets.length > 0 ? (
          <div className="mt-1">
            <label className="block text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Preset laden</label>
            <div className="flex gap-1">
              <select
                value={activePresetId ?? ''}
                onChange={e => {
                  const val = e.target.value;
                  if (!val) {
                    clearAll();
                  } else {
                    loadPreset(val);
                  }
                }}
                className="flex-1 min-w-0 h-7 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 text-[12px]"
              >
                <option value="">– keines –</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {activePresetId ? (
                <button
                  type="button"
                  title="Preset löschen"
                  onClick={() => void deletePreset(storage.idb, activePresetId)}
                  className="px-2 h-7 rounded border-[0.5px] border-[var(--tf-border)] text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <SavePresetDialog
        open={presetDialogOpen}
        onClose={() => setPresetDialogOpen(false)}
        onSave={async (name, desc) => {
          await savePreset(storage.idb, name, desc);
        }}
      />
    </div>
  );
}
