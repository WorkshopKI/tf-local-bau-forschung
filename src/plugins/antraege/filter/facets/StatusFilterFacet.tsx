import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { TfTree } from '@/components/tree';
import type { TfTreeNodeRenderProps } from '@/components/tree';
import { groupStatusValues, type GroupedPhase } from '../statusGroups';
import {
  baueStatusBaum, checkedAusFilter, filterAusChecked, filtereStatusPhasen,
  istGesetzt, phaseKnotenId, type StatusKnoten,
} from '../statusTreeAdapter';

interface Props {
  counts: Map<string, number>;
  selected: string[];
  onChange: (values: string[]) => void;
}

const fmt = (n: number): string => n.toLocaleString('de-DE');

/**
 * Status-Filter als Checkbox-Baum: ZAH-Phase als Ordner, Status als Blätter,
 * Tri-State an der Phase (alle / teilweise / keine).
 *
 * Seit v2.393 auf der gemeinsamen `TfTree`-Basis statt eines eigenen
 * Akkordeons — damit gibt es hier Pfeiltasten, Home/End und Typeahead, ohne
 * dass sie eigens gebaut werden müssten.
 *
 * **Der Store bleibt die Quelle der Wahrheit.** Der Baum ist controlled; die
 * Übersetzung Häkchen ↔ Filterwerte macht `statusTreeAdapter` (eine Zeile
 * filtert über alle Schreibweisen ihres Codes — Details dort).
 *
 * **Such-Aufklappen ist vorübergehend.** Beim ersten Zeichen wird der
 * bisherige Aufklapp-Zustand gemerkt und die Treffer-Phasen geöffnet; beim
 * Leeren kehrt der gemerkte Zustand zurück. Die Suche verändert also nicht,
 * womit die Nutzerin danach weiterarbeitet.
 */
export function StatusFilterFacet({ counts, selected, onChange }: Props): React.ReactElement {
  const [query, setQuery] = useState('');

  const phases = useMemo(() => groupStatusValues(counts), [counts]);
  const filteredPhases = useMemo<GroupedPhase[]>(
    () => filtereStatusPhasen(phases, query), [phases, query],
  );

  const { items, rootId } = useMemo(() => baueStatusBaum(filteredPhases), [filteredPhases]);
  const gesetzt = useMemo(() => new Set(selected), [selected]);
  const checked = useMemo(
    () => checkedAusFilter(filteredPhases, selected), [filteredPhases, selected],
  );

  const initialOpen = useMemo<string[]>(() => {
    const beimMount = new Set(selected);
    return phases
      .filter(p => p.items.some(it => istGesetzt(it, beimMount)))
      .map(p => phaseKnotenId(p.id));
    // Initial-Berechnung läuft nur einmal beim Mount — danach übernimmt der
    // User die Steuerung. Bewusst keine Dep-Liste, damit ein Außen-Reset nicht
    // Phasen aufpoppen lässt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [offen, setOffen] = useState<string[]>(initialOpen);
  /** Aufklapp-Zustand vor der Suche — `null`, solange nicht gesucht wird. */
  const vorSuche = useRef<string[] | null>(null);

  useEffect(() => {
    const sucht = query.trim() !== '';
    if (sucht) {
      if (vorSuche.current === null) vorSuche.current = offen;
      setOffen(prev => {
        const next = new Set(prev);
        for (const p of filteredPhases) next.add(phaseKnotenId(p.id));
        return next.size === prev.length ? prev : [...next];
      });
      return;
    }
    if (vorSuche.current !== null) {
      setOffen(vorSuche.current);
      vorSuche.current = null;
    }
    // `offen` ist bewusst keine Dependency: der Effekt SETZT ihn, eine
    // Rückkopplung wäre eine Schleife.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filteredPhases]);

  /**
   * Shift-Klick auf eine Phase togglet alle ihre Stati — dasselbe, was die
   * Ordner-Checkbox tut. Bleibt als Alias erhalten, weil es der bisher EINZIGE
   * Weg dafür war und in der Fußzeile jahrelang so beschrieben stand.
   */
  const shiftAufPhase = (id: string, data: StatusKnoten, e: React.MouseEvent): void => {
    if (!e.shiftKey || data.art !== 'phase') return;
    e.stopPropagation();
    const alle = new Set(data.phase.items.flatMap(it => it.schreibweisen));
    const allesAn = data.phase.items.length > 0 && data.phase.items.every(it => istGesetzt(it, gesetzt));
    onChange(allesAn
      ? selected.filter(v => !alle.has(v))
      : [...selected, ...[...alle].filter(v => !gesetzt.has(v))]);
    setOffen(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const isEmpty = filteredPhases.length === 0;

  return (
    <div className="flex flex-col">
      {/* Status-Suche */}
      <div className="relative mb-2">
        <Search
          size={11}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Status suchen…"
          aria-label="Status suchen"
          className="w-full pl-7 pr-2 py-1.5 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12px] text-[var(--tf-text)] placeholder:text-[var(--tf-text-tertiary)] focus:outline-none focus:border-[var(--tf-text-secondary)]"
        />
      </div>

      <div className="max-h-[70vh] overflow-y-auto -mx-1 px-1">
        {isEmpty ? (
          <div
            role="status"
            aria-live="polite"
            className="py-3 text-center text-[11.5px] text-[var(--tf-text-tertiary)]"
          >
            Kein Status gefunden
          </div>
        ) : (
          <TfTree<StatusKnoten>
            items={items}
            rootId={rootId}
            label="Status filtern"
            features={{ checkboxes: true }}
            expandedItems={offen}
            onExpandedChange={setOffen}
            checkedItems={checked}
            onCheckedChange={ids => onChange(filterAusChecked(filteredPhases, ids, selected))}
            onZeilenKlick={shiftAufPhase}
            slots={{
              label: p => <Beschriftung p={p} gesetzt={gesetzt} />,
              trailing: p => <Zahl p={p} gesetzt={gesetzt} />,
              zeilenStil: p => (p.data.art === 'phase' && hatAktive(p.data.phase, gesetzt)
                ? { borderLeft: '2px solid var(--tf-primary)', paddingLeft: 4 }
                : { borderLeft: '2px solid transparent' }),
            }}
          />
        )}
      </div>

      <div className="mt-2 px-0.5 text-[11px] text-[var(--tf-text-tertiary)] leading-snug">
        Checkbox an der Phase wählt alle Stati der Phase.
      </div>
    </div>
  );
}

/** Hat die Phase mindestens einen gesetzten Status? */
function hatAktive(phase: GroupedPhase, gesetzt: ReadonlySet<string>): boolean {
  return phase.items.some(it => istGesetzt(it, gesetzt));
}

/** Phasen-Label in Versalien, Status-Label normal. */
function Beschriftung({ p, gesetzt }: {
  p: TfTreeNodeRenderProps<StatusKnoten>; gesetzt: ReadonlySet<string>;
}): React.ReactElement {
  const aktiv = p.checked !== 'unchecked';
  if (p.data.art === 'phase') {
    const an = p.data.phase.items.reduce((n, it) => (istGesetzt(it, gesetzt) ? n + 1 : n), 0);
    return (
      <>
        <span
          className={`text-[11px] font-medium uppercase ${
            an > 0 ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'
          }`}
          style={{ letterSpacing: '0.08em' }}
        >
          {p.name}
        </span>
        {an > 0 && (
          <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--tf-primary)' }}>
            {an}/{p.data.phase.items.length}
          </span>
        )}
        <span className="flex-1" />
      </>
    );
  }
  const weitere = p.data.art === 'status' ? p.data.item.schreibweisen.length - 1 : 0;
  return (
    <span
      title={weitere > 0 && p.data.art === 'status'
        ? `Auch: ${p.data.item.schreibweisen.slice(1).join(', ')}`
        : undefined}
      className={`flex-1 min-w-0 truncate text-[12.5px] ${
        aktiv ? 'text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)]'
      }`}
    >
      {p.name}
    </span>
  );
}

/** Rechtsbündige Anzahl — bei der Phase die Summe ihrer Blätter. */
function Zahl({ p, gesetzt }: {
  p: TfTreeNodeRenderProps<StatusKnoten>; gesetzt: ReadonlySet<string>;
}): React.ReactElement | null {
  if (p.data.art === 'wurzel') return null;
  const [wert, aktiv] = p.data.art === 'phase'
    ? [p.data.phase.items.reduce((n, it) => n + it.count, 0), hatAktive(p.data.phase, gesetzt)]
    : [p.data.item.count, istGesetzt(p.data.item, gesetzt)];
  return (
    <span
      className={`shrink-0 text-[11px] tabular-nums ${
        aktiv ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'
      }`}
    >
      {fmt(wert)}
    </span>
  );
}
