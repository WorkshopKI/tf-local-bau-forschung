/**
 * MaTileGrid — Karten-Heatmap-View des Mitarbeiter-Bereichs.
 *
 * Layout:
 *  - Grid-Head: Sort-Hinweis links + inline-Legende rechts
 *  - Grid: `grid auto-fill, minmax(150px, 1fr); gap: 8px`
 *  - Grid-Foot: 4-Item-Legende + Hinweis "Klick auf Tile öffnet Detail"
 *  - Detail unterhalb des Grids (Etappe-1-Pattern, ggf. später als Drawer)
 *
 * Sortier-Reihenfolge:
 *  1. Aktive MAs (fest > 0 ODER pending > 0): nach Belegt-% absteigend
 *  2. "Empty"-Tiles (nur Altlast, keine Buchung): nach Altlast-TVs absteigend
 *  3. Inaktive MAs (nur wenn showInactive): alphabetisch
 *
 * Sort-State wird vom Parent durchgereicht und im Grid-Head als Hinweis
 * angezeigt — Sortier-Klick passiert nur in der Tabelle.
 */
import { useMemo } from 'react';
import type { AnonymerMitarbeiter, UeberKategorie } from '../../types';
import type { MaAltlastBucket } from '../../services/kapazitaet';
import type { KapazitaetsView } from '../../services/kapazitaet';
import type { KapazitaetProTypView } from '../../services/kapazitaet';
import { MaTile } from './MaTile';
import type { SortState } from './MaTable';

interface Props {
  list: AnonymerMitarbeiter[];
  altlastByAnon: Map<string, MaAltlastBucket>;
  kapByAnon: Map<string, KapazitaetsView>;
  kapTypByAnon: Map<string, KapazitaetProTypView>;
  kategorien: UeberKategorie[];
  quartal: string;
  stundenProTV: number;
  resolveName: (anonId: string) => string | null;
  expandedMa: string | null;
  onToggleExpand: (anonId: string) => void;
  sort: SortState;
  renderInlineDetail: (ma: AnonymerMitarbeiter) => React.ReactNode;
}

function sortLabel(sort: SortState): string {
  const colLabel = {
    ma: 'MA',
    kategorie: 'Kategorie',
    auslastung: 'Auslastung',
    belegt: 'Belegt',
    frei: 'Frei',
    fest: 'Aktuell',
    altlast: 'Altanträge',
    status: 'Status',
  }[sort.col];
  return `Sortierung: ${colLabel} ${sort.dir === 'asc' ? '↑' : '↓'}`;
}

export function MaTileGrid({
  list, altlastByAnon, kapByAnon, kapTypByAnon, kategorien, quartal, stundenProTV, resolveName,
  expandedMa, onToggleExpand, sort, renderInlineDetail,
}: Props): React.ReactElement {
  // Gruppierung: active / empty / inactive.
  const grouped = useMemo(() => {
    const active: AnonymerMitarbeiter[] = [];
    const empty: AnonymerMitarbeiter[] = [];
    const inactive: AnonymerMitarbeiter[] = [];
    for (const ma of list) {
      if (!ma.aktiv) {
        inactive.push(ma);
        continue;
      }
      const kv = kapByAnon.get(ma.anonId);
      const hasFest = (kv?.verbrauchteStunden ?? 0) > 0;
      const altlastTvs = altlastByAnon.get(ma.anonId)?.tvs ?? 0;
      if (!hasFest && altlastTvs > 0) {
        empty.push(ma);
      } else {
        active.push(ma);
      }
    }
    // Active behält die Sort-Order vom Parent (kommt sortiert rein).
    // Empty sortieren wir nach Altlast-TVs desc (am meisten Last zuerst).
    empty.sort((a, b) =>
      (altlastByAnon.get(b.anonId)?.tvs ?? 0) - (altlastByAnon.get(a.anonId)?.tvs ?? 0),
    );
    // Inactive alphabetisch.
    inactive.sort((a, b) => a.anonId.localeCompare(b.anonId));
    return { active, empty, inactive };
  }, [list, kapByAnon, altlastByAnon]);

  const total = list.length;
  const expandedMaObj = expandedMa ? list.find(m => m.anonId === expandedMa) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Grid-Head */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-[11.5px] text-[var(--tf-text-tertiary)]">
        <span className="font-mono">
          {total} MAs · {sortLabel(sort)}
        </span>
        <div className="flex items-center gap-3">
          <LegendItem
            label="Aktuell"
            color="var(--tf-primary)"
          />
          <LegendItem
            label="Altanträge"
            color="hsl(var(--tf-primary-h), calc(var(--tf-primary-s) * 0.4), 70%)"
          />
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 8,
        }}
      >
        {[...grouped.active, ...grouped.empty, ...grouped.inactive].map(ma => {
          const kv = kapByAnon.get(ma.anonId);
          if (!kv) return null;
          return (
            <MaTile
              key={ma.anonId}
              ma={ma}
              kapView={kv}
              kapTyp={kapTypByAnon.get(ma.anonId)}
              altlast={altlastByAnon.get(ma.anonId)}
              kategorien={kategorien}
              quartal={quartal}
              stundenProTV={stundenProTV}
              realName={resolveName(ma.anonId)}
              onClick={onToggleExpand}
            />
          );
        })}
      </div>

      {/* Inline-Detail unterhalb des Grids */}
      {expandedMaObj && (
        <div
          className="rounded-[10px] overflow-hidden mt-2"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          {renderInlineDetail(expandedMaObj)}
        </div>
      )}

      {/* Grid-Foot */}
      <div
        className="flex items-center justify-between gap-3 flex-wrap pt-3 text-[12px] text-[var(--tf-text-secondary)]"
        style={{ borderTop: '0.5px solid var(--tf-border)' }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <LegendItem label="Aktuell" color="var(--tf-primary)" swatchShape="bar" />
          <LegendItem label="Altanträge" color="hsl(var(--tf-primary-h), calc(var(--tf-primary-s) * 0.4), 70%)" swatchShape="bar" />
          <LegendItem label="Keine Buchung" color="var(--tf-bg-secondary)" swatchShape="hatched" />
          <LegendItem label="Inaktiv" color="var(--tf-bg-secondary)" swatchShape="hatched" dim />
        </div>
        <span className="font-mono text-[11.5px] text-[var(--tf-text-tertiary)]">
          Klick auf Tile öffnet Detail
        </span>
      </div>
    </div>
  );
}

function LegendItem({
  label, color, swatchShape = 'bar', dim,
}: {
  label: string;
  color: string;
  swatchShape?: 'bar' | 'hatched';
  dim?: boolean;
}): React.ReactElement {
  const hatched =
    'repeating-linear-gradient(135deg, var(--tf-bg-secondary), var(--tf-bg-secondary) 3px, var(--tf-bg) 3px, var(--tf-bg) 6px)';
  return (
    <span className="inline-flex items-center gap-1.5" style={{ opacity: dim ? 0.55 : 1 }}>
      <span
        aria-hidden
        style={{
          width: 14,
          height: 10,
          borderRadius: 2,
          background: swatchShape === 'hatched' ? hatched : color,
          border: '0.5px solid var(--tf-border)',
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}
