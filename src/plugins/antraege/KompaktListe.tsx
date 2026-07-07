import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { AMPEL_COLOR } from './eingangAmpel';
import {
  buildKompaktGroups,
  filterKompaktGroups,
  type KompaktGroupVM,
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
  /** Öffnet einen Verbund (Klick auf eine geclusterte Verbund-Zeile). */
  onOpenVerbund: (id: string) => void;
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
 * Bei geöffnetem Detail wird **nach Verbund gruppiert**: EIN Eintrag pro Verbund
 * (statt einer Zeile je TV) — die TVs eines Verbundes stehen ohnehin im Detail,
 * sobald man den Verbund öffnet. Solo-Anträge (ohne `verbund_id`) bleiben je eine
 * eigene Zeile.
 *
 * Zeile: Ampel-Punkt (aus `fristAnzeige` des Lead-TV) + Akronym (Ellipsis +
 * `title`) + TV-Zähler (nur bei Verbünden > 1) + relative Frist rechts (gefärbt
 * wie der Punkt; terminal/fristlos → leer). Aktive Zeile trägt **exakt** den
 * Sidebar-Nav-Aktiv-Stil (Links-Balken-Marker `--tf-primary` +
 * `--tf-primary-light`-Fläche + `--tf-text` + `font-medium`); der 2px-Balken ist
 * bei jeder Zeile als transparente Reserve angelegt, damit die Aktivierung keinen
 * Layout-Shift erzeugt.
 *
 * Der Kopf-Filter filtert NUR die sichtbaren Gruppen clientseitig (kein Eingriff
 * in Facetten/Suche/Sortierung — die Reihenfolge bleibt die der Vollansicht).
 * FKZ- und Formel-Spalte werden hier bewusst nicht gerendert.
 */
export function KompaktListe({
  filtered,
  selectedAktenzeichen,
  selectedVerbundId,
  viewLabel,
  onOpenAntrag,
  onOpenVerbund,
  onCollapse,
}: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(INITIAL_SHOWN);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const isActiveGroup = useCallback(
    (g: KompaktGroupVM): boolean =>
      selectedAktenzeichen != null
        ? g.memberAktenzeichen.includes(selectedAktenzeichen)
        : selectedVerbundId != null && g.verbundId === selectedVerbundId,
    [selectedAktenzeichen, selectedVerbundId],
  );

  // Nach Verbund geclusterte Zeilen (ein Eintrag pro Verbund).
  const groups = useMemo(() => buildKompaktGroups(filtered), [filtered]);
  // Clientseitiger Sicht-Filter — Reihenfolge bleibt die der Vollansicht.
  const visible = useMemo(() => filterKompaktGroups(groups, query), [groups, query]);
  // Trefferzahl bleibt auf TV-Ebene (deckungsgleich zum Tab-Zähler) — auch wenn
  // die Zeilen nach Verbund geclustert sind.
  const tvTotal = useMemo(() => visible.reduce((s, g) => s + g.tvCount, 0), [visible]);

  // Bei Query-/Datenwechsel das Fenster zurücksetzen (von oben zeigen).
  useEffect(() => { setShown(INITIAL_SHOWN); }, [query, filtered]);

  // Aktive Gruppe garantiert ins Fenster ziehen (auch wenn sie weit unten
  // liegt) — sonst hätte die Auto-Scroll-Markierung kein Ziel-Element.
  const activeIndex = useMemo(() => visible.findIndex(isActiveGroup), [visible, isActiveGroup]);
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

  const rows = useMemo(() => visible.slice(0, shown).map(g => ({
    g,
    active: isActiveGroup(g),
  })), [visible, shown, isActiveGroup]);

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
          <span className="tabular-nums">{tvTotal.toLocaleString('de-DE')}</span>
        </div>
      </div>

      {/* Zeilen — eigener Scroll-Container mit lokaler Pagination. */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1.5">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-[var(--tf-text-tertiary)]">
            {query.length > 0 ? 'Kein Treffer im Filter.' : 'Keine Anträge.'}
          </div>
        ) : (
          rows.map(({ g, active }) => (
            <button
              key={g.key}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => (g.verbundId ? onOpenVerbund(g.verbundId) : onOpenAntrag(g.leadAktenzeichen))}
              title={g.tvCount > 1 ? `${g.label} · ${g.tvCount} Teilvorhaben` : g.label}
              aria-current={active ? 'true' : undefined}
              className={`flex items-center gap-2 w-full text-left py-[7px] pl-2 pr-2 border-l-2 rounded-r-[6px] transition-colors cursor-pointer ${
                active
                  ? 'border-[var(--tf-primary)] bg-[var(--tf-primary-light)] text-[var(--tf-text)] font-medium'
                  : 'border-transparent text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
              }`}
            >
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ background: g.frist ? AMPEL_COLOR[g.frist.ampel] : 'var(--tf-border)' }}
                aria-hidden="true"
              />
              <span className="flex-1 min-w-0 truncate text-[13px]">{g.label}</span>
              {g.tvCount > 1 ? (
                <span
                  className="shrink-0 text-[10.5px] tabular-nums text-[var(--tf-text-tertiary)]"
                  aria-label={`${g.tvCount} Teilvorhaben`}
                >
                  {g.tvCount}
                </span>
              ) : null}
              {g.frist ? (
                <span
                  className="shrink-0 text-[11px] tabular-nums whitespace-nowrap"
                  style={{ color: AMPEL_COLOR[g.frist.ampel] }}
                >
                  {g.frist.text}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
