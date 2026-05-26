/**
 * MaRow (v2.6, in v2.10 memoized) — Zwei-Zeilen-Zeile pro MA in der konsolidierten Tabelle.
 *
 * Zeile 1 (Haupt): AnonymIdBadge · Kategorien · Antragstypen · Balken · Frei-Text · Aktionen
 * Zeile 2 (Sekundär, gedämpft): Technologien · Festgebucht-Zusammenfassung · Marker
 *
 * Klick auf Haupt-/Sekundär-Bereich (außerhalb Action-Buttons) toggelt
 * den Expand. Aufrufer (`MitarbeiterUndKapazitaet`) stellt sicher, dass
 * nur genau ein MA gleichzeitig expandiert (Akkordion).
 *
 * v2.10: `React.memo`-Wrap — bei stabilen Handler-Callbacks (per
 * useCallback im Parent) wird die Row nur neu gerendert wenn sich `ma`,
 * `kapView` oder `expanded` aendert. Eliminiert ~250ms bei 79 MAs auf
 * jedem Filter-Klick / Store-Update.
 */
import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { AnonymIdBadge } from '../components/AnonymIdBadge';
import { KategoriePill } from '../components/KategoriePill';
import { TechnologieTags } from '../components/TechnologieTags';
import { KapazitaetsBalken } from '../components/KapazitaetsBalken';
import { AntragstypOverrideCell } from './AntragstypOverrideCell';
import { MaInlineDetail } from './MaInlineDetail';
import type { AnonymerMitarbeiter, AntragstypBucket, UeberKategorie } from '../types';
import type { MaQuartalsAuslastung } from '../services/quartals-auslastung';
import type { MaAltlastBucket } from '../services/altlast';
import type { KapazitaetsView } from '../services/kapazitaet';

interface Props {
  ma: AnonymerMitarbeiter;
  auslastung: MaQuartalsAuslastung;
  kapView: KapazitaetsView;
  /** Optional: noch offene Antraege aus den letzten 2 Quartalen. Wenn vorhanden
   *  und `antraege > 0`, wird ein hellgrauer Sub-Track unter dem Hauptbalken
   *  + ein Sub-Label-Hinweis gerendert. Rein informativ, kein Ranking-Bezug. */
  altlast?: MaAltlastBucket;
  kategorien: UeberKategorie[];
  realName: string | null;
  quartal: string;
  expanded: boolean;
  /** Stabile Handler (per useCallback im Parent), nehmen anonId als
   *  ersten Arg — so kann der Parent EINEN Handler haben, der fuer alle
   *  MAs identisch ist. */
  onToggleExpand: (anonId: string) => void;
  onSetAktiv: (anonId: string, next: boolean) => void;
  onRemove: (anonId: string) => void;
  onUpsertAntragstyp: (anonId: string, next: AntragstypBucket[] | undefined) => Promise<void>;
}

/** "2025-Q4" → "Q4/25" — kompakter Format fuer das Altlast-Sub-Label. */
function formatQuartalShort(q: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(q);
  if (!m || !m[1] || !m[2]) return q;
  return `Q${m[2]}/${m[1].slice(2)}`;
}

function MaRowImpl({
  ma, auslastung, kapView, altlast, kategorien, realName, quartal,
  expanded, onToggleExpand, onSetAktiv, onRemove, onUpsertAntragstyp,
}: Props): React.ReactElement {
  const hasAltlast = altlast != null && altlast.antraege > 0;
  const hauptId = ma.hauptKategorie || ma.ueberKategorien?.[0] || '';
  const nebenIds = ma.nebenKategorien ?? (ma.ueberKategorien ? ma.ueberKategorien.slice(1) : []);
  const hauptKat = kategorien.find(k => k.id === hauptId);
  const nebenKats = nebenIds.map(id => kategorien.find(k => k.id === id)).filter((k): k is UeberKategorie => k != null);
  const hasKats = hauptKat != null || nebenKats.length > 0;
  const abgemeldet = ma.abgemeldet.includes(quartal);

  const freiOderUeber = kapView.ueberbuchung > 0
    ? <span className="text-[var(--tf-warning-text)] font-medium">Überbucht {Math.ceil(kapView.ueberbuchung)}h</span>
    : <span><span className="font-medium">{kapView.restTVs}</span> TVs frei</span>;

  // Hilfs-Trigger: nicht bei Klick auf <button>/<input>/<textarea> toggeln.
  const triggerExpand = (e: React.MouseEvent): void => {
    const t = e.target as HTMLElement;
    if (t.closest('button, input, textarea, select, [data-no-expand]')) return;
    onToggleExpand(ma.anonId);
  };

  return (
    <div
      className={`${ma.aktiv ? '' : 'opacity-55'}`}
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      {/* Klickbarer Block (beide Zeilen). Aktionen haben data-no-expand. */}
      <div
        className="px-3 py-2 cursor-pointer hover:bg-[var(--tf-bg-hover,var(--tf-bg-secondary))]"
        onClick={triggerExpand}
      >
        {/* Zeile 1 — Haupt */}
        <div className="flex items-center gap-3">
          <ChevronRight
            size={14}
            className="text-[var(--tf-text-tertiary)] shrink-0 transition-transform"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}
          />
          <div className="shrink-0">
            <AnonymIdBadge anonId={ma.anonId} realName={realName} />
          </div>
          <div className="flex flex-wrap gap-1 shrink-0 min-w-[120px]">
            {hauptKat && <KategoriePill kategorie={hauptKat} mode="primaer" />}
            {nebenKats.map(k => <KategoriePill key={k.id} kategorie={k} mode="aspekt" />)}
            {!hasKats && <span className="text-[11px] text-[var(--tf-text-tertiary)]">—</span>}
          </div>
          <div className="flex-1 min-w-[100px] max-w-[200px]" data-no-expand>
            <AntragstypOverrideCell
              ma={ma}
              onSave={next => onUpsertAntragstyp(ma.anonId, next)}
            />
          </div>
          <div className="shrink-0 w-[140px]">
            <KapazitaetsBalken
              freigegeben={kapView.fest.stunden}
              selbst={kapView.pending.stunden}
              vorgeschlagen={0}
              quartalsKapazitaet={kapView.effektivStunden}
              altlast={hasAltlast ? { stunden: altlast.stunden } : undefined}
              showLabels={false}
            />
          </div>
          <div
            className="shrink-0 w-[110px] text-right text-[12px] text-[var(--tf-text-secondary)] tabular-nums"
            title={`${Math.round(kapView.verbrauchteStunden)} / ${Math.round(kapView.effektivStunden)} h`}
          >
            {freiOderUeber}
          </div>
          <div className="shrink-0 flex items-center gap-1.5" data-no-expand>
            {!ma.onboardingAbgeschlossen && (
              <span className="text-[10.5px] text-amber-700 mr-1" title="Onboarding ausstehend">⚙</span>
            )}
            {abgemeldet && (
              <span className="text-[10.5px] text-amber-700 mr-1" title={`Abgemeldet in ${quartal}`}>⏸</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (ma.aktiv) {
                  const ok = window.confirm(
                    `${ma.anonId} deaktivieren?\n\nWird aus Matching, Dashboard und Cockpit ausgeblendet.`,
                  );
                  if (!ok) return;
                }
                onSetAktiv(ma.anonId, !ma.aktiv);
              }}
              className="text-[11px] cursor-pointer hover:underline px-1"
              title={ma.aktiv ? 'Deaktivieren' : 'Aktivieren'}
            >
              {ma.aktiv ? 'Aktiv' : 'Inaktiv'}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(ma.anonId); }}
              className="text-[11px] text-[var(--tf-text-tertiary)] cursor-pointer hover:text-rose-700 px-1"
              title="Löschen"
            >
              Löschen
            </button>
          </div>
        </div>

        {/* Zeile 2 — Sekundär (gedämpft) */}
        <div className="mt-1 ml-7 flex items-baseline gap-3 text-[11px] text-[var(--tf-text-tertiary)] leading-snug">
          <div className="flex-1 min-w-0 truncate">
            {ma.manuelleTechnologien.length > 0
              ? <TechnologieTags tags={ma.manuelleTechnologien} max={5} />
              : <span className="opacity-60">keine Technologien gepflegt</span>}
          </div>
          <div className="shrink-0 tabular-nums">
            Festgebucht: <span className="text-[var(--tf-text-secondary)]">{kapView.fest.antraege}</span> Anträge ({kapView.fest.tvs} TVs)
            {kapView.pending.antraege > 0 && (
              <> · Pending: <span className="text-[var(--tf-text-secondary)]">{kapView.pending.antraege}</span> ({kapView.pending.tvs})</>
            )}
            {hasAltlast && (
              <> · <span
                className="text-[var(--tf-text-secondary)]"
                title="Noch offene Anträge aus den letzten 2 Quartalen (informativ, kein Ranking-Bezug)"
              >
                Altlast: {altlast.tvs} TVs aus {altlast.quartale.map(formatQuartalShort).join(' + ')}
              </span></>
            )}
            {` · ${ma.jahresKapazitaet}h/Jahr${(ma.abschlagProzent ?? 0) > 0 ? ` (−${ma.abschlagProzent}%)` : ''}`}
          </div>
        </div>
      </div>

      {/* Inline-Detail (Akkordion-Expand) */}
      {expanded && (
        <MaInlineDetail
          ma={ma}
          auslastung={auslastung}
          quartal={quartal}
          onSaved={() => onToggleExpand(ma.anonId)}
        />
      )}
    </div>
  );
}

/** v2.10: React.memo-Wrap. Bei stabilen Callback-Props (per useCallback im
 *  Parent) wird die Row nur neu gerendert wenn sich `ma`, `kapView`,
 *  `expanded`, `realName` oder `kategorien` aendert. */
export const MaRow = memo(MaRowImpl);
