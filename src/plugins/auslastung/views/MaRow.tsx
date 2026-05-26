/**
 * MaRow (v2.6) — Zwei-Zeilen-Zeile pro MA in der konsolidierten Tabelle.
 *
 * Zeile 1 (Haupt): AnonymIdBadge · Kategorien · Antragstypen · Balken · Frei-Text · Aktionen
 * Zeile 2 (Sekundär, gedämpft): Technologien · Festgebucht-Zusammenfassung · Marker
 *
 * Klick auf Haupt-/Sekundär-Bereich (außerhalb Action-Buttons) toggelt
 * den Expand. Aufrufer (`MitarbeiterUndKapazitaet`) stellt sicher, dass
 * nur genau ein MA gleichzeitig expandiert (Akkordion).
 */
import { ChevronRight } from 'lucide-react';
import { AnonymIdBadge } from '../components/AnonymIdBadge';
import { KategoriePill } from '../components/KategoriePill';
import { TechnologieTags } from '../components/TechnologieTags';
import { KapazitaetsBalken } from '../components/KapazitaetsBalken';
import { AntragstypOverrideCell } from './AntragstypOverrideCell';
import { MaInlineDetail } from './MaInlineDetail';
import type { AnonymerMitarbeiter, UeberKategorie } from '../types';
import type { MaQuartalsAuslastung } from '../services/quartals-auslastung';
import type { KapazitaetsView } from '../services/kapazitaet';

interface Props {
  ma: AnonymerMitarbeiter;
  auslastung: MaQuartalsAuslastung;
  kapView: KapazitaetsView;
  kategorien: UeberKategorie[];
  realName: string | null;
  quartal: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onSetAktiv: (next: boolean) => void;
  onRemove: () => void;
  onUpsertAntragstyp: (next: import('../types').AntragstypBucket[] | undefined) => Promise<void>;
}

export function MaRow({
  ma, auslastung, kapView, kategorien, realName, quartal,
  expanded, onToggleExpand, onSetAktiv, onRemove, onUpsertAntragstyp,
}: Props): React.ReactElement {
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
    onToggleExpand();
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
            <AntragstypOverrideCell ma={ma} onSave={onUpsertAntragstyp} />
          </div>
          <div className="shrink-0 w-[140px]">
            <KapazitaetsBalken
              freigegeben={kapView.fest.stunden}
              selbst={kapView.pending.stunden}
              vorgeschlagen={0}
              quartalsKapazitaet={kapView.effektivStunden}
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
                onSetAktiv(!ma.aktiv);
              }}
              className="text-[11px] cursor-pointer hover:underline px-1"
              title={ma.aktiv ? 'Deaktivieren' : 'Aktivieren'}
            >
              {ma.aktiv ? 'Aktiv' : 'Inaktiv'}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
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
          onSaved={onToggleExpand}
        />
      )}
    </div>
  );
}
