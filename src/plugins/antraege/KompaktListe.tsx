import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { AMPEL_COLOR } from './eingangAmpel';
import {
  buildKompaktRow,
  filterKompaktItems,
  type KompaktItem,
} from './kompaktRows';
import { Filter, PanelLeftClose, X } from 'lucide-react';

interface Props {
  /** Bereits gefilterte + sortierte Liste der Vollansicht (Reihenfolge bleibt). */
  filtered: AntragListItem[];
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  /** View-Label der aktiven Sicht (z.B. „Offen") — wird uppercase gerendert. */
  viewLabel: string;
  onOpenAntrag: (az: string) => void;
  /** Ausklapp-Icon → Liste einklappen (schmale „Anträge einblenden"-Leiste). */
  onCollapse?: () => void;
}

/** Start-Fenster + Nachlade-Schritt der lokalen Pagination (Kompakt-Liste
 *  rendert nicht alle 13k Zeilen auf einmal). */
const INITIAL_SHOWN = 120;
const LOAD_STEP = 120;

/**
 * Kompakt-Listenmodus (Journey-Paket 2 Phase 8) — die schmale Antrags-Spalte
 * neben einem geöffneten Detail (Mockup `split-kompaktliste.png`).
 *
 * Zeile: Ampel-Punkt (aus `fristAnzeige`) + Akronym (Ellipsis + `title`) +
 * relative Frist rechts (gefärbt wie der Punkt; terminal/fristlos → leer).
 * Aktive Zeile trägt **exakt** den Sidebar-Nav-Aktiv-Stil (Links-Balken-Marker
 * `--tf-primary` + `--tf-primary-light`-Fläche + `--tf-text` + `font-medium`);
 * der 2px-Balken ist bei jeder Zeile als transparente Reserve angelegt, damit
 * die Aktivierung keinen Layout-Shift erzeugt.
 *
 * Der Kopf-Filter filtert NUR die sichtbare Liste clientseitig (kein Eingriff
 * in Facetten/Suche/Sortierung — die Reihenfolge bleibt die der Vollansicht).
 * FKZ- und Formel-Spalte werden hier bewusst nicht gerendert.
 */
export function KompaktListe({
  filtered,
  selectedAktenzeichen,
  selectedVerbundId,
  viewLabel,
  onOpenAntrag,
  onCollapse,
}: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(INITIAL_SHOWN);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const isActiveItem = useCallback(
    (item: KompaktItem): boolean =>
      selectedAktenzeichen != null
        ? item.aktenzeichen === selectedAktenzeichen
        : selectedVerbundId != null &&
          typeof item.verbund_id === 'string' &&
          item.verbund_id === selectedVerbundId,
    [selectedAktenzeichen, selectedVerbundId],
  );

  // Clientseitiger Sicht-Filter — Reihenfolge bleibt die der Vollansicht.
  const visible = useMemo(() => filterKompaktItems(filtered, query), [filtered, query]);

  // Bei Query-/Datenwechsel das Fenster zurücksetzen (von oben zeigen).
  useEffect(() => { setShown(INITIAL_SHOWN); }, [query, filtered]);

  // Aktiven Antrag garantiert ins Fenster ziehen (auch wenn er weit unten
  // liegt) — sonst hätte die Auto-Scroll-Markierung kein Ziel-Element.
  const activeIndex = useMemo(() => visible.findIndex(isActiveItem), [visible, isActiveItem]);
  useEffect(() => {
    if (activeIndex >= 0) setShown(s => Math.max(s, activeIndex + LOAD_STEP));
  }, [activeIndex]);

  // Aktive Zeile in den sichtbaren Bereich scrollen (beim Öffnen/Wechseln).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedAktenzeichen, selectedVerbundId, shown]);

  const onScroll = useCallback((): void => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) {
      setShown(s => (s < visible.length ? s + LOAD_STEP : s));
    }
  }, [visible.length]);

  const rows = useMemo(() => visible.slice(0, shown).map(item => ({
    item,
    vm: buildKompaktRow(item),
    active: isActiveItem(item),
  })), [visible, shown, isActiveItem]);

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
      {/* Kopf: schmales Client-Filter-Feld + Einklapp-Icon, darunter View-Label. */}
      <div className="shrink-0 px-2.5 pt-2.5 pb-2" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 rounded-[6px] bg-[var(--tf-bg-secondary)]">
            <Filter size={13} className="shrink-0 text-[var(--tf-text-tertiary)]" aria-hidden="true" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filtern …"
              aria-label="Liste filtern"
              className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-[var(--tf-text)] placeholder:text-[var(--tf-text-tertiary)]"
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Filter leeren"
                className="shrink-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Liste einklappen"
              title="Liste einklappen"
              className="shrink-0 p-1 rounded-[6px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)] transition-colors cursor-pointer"
            >
              <PanelLeftClose size={15} />
            </button>
          ) : null}
        </div>
        <div className="mt-2 px-0.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
          <span className="font-medium truncate">{viewLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{visible.length.toLocaleString('de-DE')}</span>
        </div>
      </div>

      {/* Zeilen — eigener Scroll-Container mit lokaler Pagination. */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1.5">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-[var(--tf-text-tertiary)]">
            {query.length > 0 ? 'Kein Treffer im Filter.' : 'Keine Anträge.'}
          </div>
        ) : (
          rows.map(({ item, vm, active }) => (
            <button
              key={vm.aktenzeichen}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onOpenAntrag(item.aktenzeichen)}
              title={vm.label}
              aria-current={active ? 'true' : undefined}
              className={`flex items-center gap-2 w-full text-left py-[7px] pl-2 pr-2 border-l-2 rounded-r-[6px] transition-colors cursor-pointer ${
                active
                  ? 'border-[var(--tf-primary)] bg-[var(--tf-primary-light)] text-[var(--tf-text)] font-medium'
                  : 'border-transparent text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
              }`}
            >
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ background: vm.frist ? AMPEL_COLOR[vm.frist.ampel] : 'var(--tf-border)' }}
                aria-hidden="true"
              />
              <span className="flex-1 min-w-0 truncate text-[13px]">{vm.label}</span>
              {vm.frist ? (
                <span
                  className="shrink-0 text-[11px] tabular-nums whitespace-nowrap"
                  style={{ color: AMPEL_COLOR[vm.frist.ampel] }}
                >
                  {vm.frist.text}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
