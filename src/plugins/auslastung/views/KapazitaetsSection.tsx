/**
 * KapazitaetsSection — Kapazitaets-Liste fuer den Uebersicht-Tab (1.17).
 *
 * Loest das frueher als eigener Tab existierende `KapazitaetsDashboard` ab.
 * Statt Stunden zeigt der Balken jetzt **Antraege** ("12 / 16"), der Hover-
 * Tooltip behaelt die Stunden-Sicht fuer PL-Detailbetrachtung.
 *
 * Klick auf MA → Flyout aus der MitarbeiterSection (Edit-Sicht). Hier
 * implementieren wir es als einfacheres Read-Flyout — die volle Edit-Sicht
 * bleibt in `MitarbeiterSection`.
 */
import { useMemo, useState } from 'react';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { AnonymIdBadge } from '../components/AnonymIdBadge';
import { KategoriePill } from '../components/KategoriePill';
import { KapazitaetsBalken } from '../components/KapazitaetsBalken';
import { computeKapazitaet } from '../services/kapazitaet';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  type AnonymerMitarbeiter,
} from '../types';

export function KapazitaetsSection(): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const cache = useAntraegeCache();

  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [zeigeInaktive, setZeigeInaktive] = useState(false);
  const [openMa, setOpenMa] = useState<string | null>(null);

  const list = useMemo(() => {
    const all = Object.values(mitarbeiter);
    const sichtbar = zeigeInaktive ? all : all.filter(m => m.aktiv);
    const filtered = kategorieFilter
      ? sichtbar.filter(m => (m.hauptKategorie === kategorieFilter)
          || (m.nebenKategorien?.includes(kategorieFilter) ?? false)
          // Fallback fuer noch nicht migrierte MAs
          || (m.ueberKategorien?.includes(kategorieFilter) ?? false))
      : sichtbar;
    return filtered.sort((a, b) => a.anonId.localeCompare(b.anonId));
  }, [mitarbeiter, kategorieFilter, zeigeInaktive]);

  const totalCount = Object.keys(mitarbeiter).length;
  const aktivCount = Object.values(mitarbeiter).filter(m => m.aktiv).length;
  const hasGaps = totalCount > aktivCount;

  const openMaObj = openMa ? mitarbeiter[openMa] : null;

  return (
    <div className="rounded-[12px] p-4 flex flex-col gap-3" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium">Kapazität</h2>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {aktivCount} aktiv / {totalCount} gesamt · {config.aktuellesQuartal}
        </span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Kategorie</span>
        <button
          type="button"
          onClick={() => setKategorieFilter('')}
          className={`text-[11.5px] px-2.5 py-1 rounded-full cursor-pointer ${kategorieFilter === '' ? '' : 'opacity-50'}`}
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Alle
        </button>
        {config.ueberKategorien.map(k => {
          const count = Object.values(mitarbeiter).filter(m =>
            m.aktiv && (m.hauptKategorie === k.id || m.nebenKategorien?.includes(k.id) || m.ueberKategorien?.includes(k.id))).length;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKategorieFilter(k.id === kategorieFilter ? '' : k.id)}
              className={`cursor-pointer flex items-center gap-1 ${kategorieFilter === k.id ? '' : 'opacity-50'}`}
            >
              <KategoriePill kategorie={k} />
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{count}</span>
            </button>
          );
        })}
        <label className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={zeigeInaktive}
            onChange={e => setZeigeInaktive(e.target.checked)}
          />
          <span>Inaktive anzeigen</span>
        </label>
      </div>

      {/* MA-Liste */}
      <div className="rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
        {list.map(ma => {
          const kap = computeKapazitaet(ma, zuweisungen, config, config.aktuellesQuartal);
          const abgemeldet = ma.abgemeldet.includes(config.aktuellesQuartal);
          const haupt = ma.hauptKategorie || ma.ueberKategorien?.[0] || '';
          const neben = ma.nebenKategorien ?? (ma.ueberKategorien ? ma.ueberKategorien.slice(1) : []);
          const hauptKat = config.ueberKategorien.find(k => k.id === haupt);
          const nebenKats = neben.map(id => config.ueberKategorien.find(k => k.id === id)).filter((k): k is NonNullable<typeof k> => k != null);

          return (
            <div
              key={ma.anonId}
              className={`px-4 py-3 cursor-pointer flex items-center gap-4 ${ma.aktiv ? '' : 'opacity-50'}`}
              style={{ borderBottom: '0.5px solid var(--tf-border)' }}
              onClick={() => setOpenMa(ma.anonId)}
            >
              <AnonymIdBadge anonId={ma.anonId} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {hauptKat && <KategoriePill kategorie={hauptKat} active />}
                  {nebenKats.map(k => <KategoriePill key={k.id} kategorie={k} active={false} />)}
                  {(ma.abschlagProzent ?? 0) > 0 && (
                    <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
                      ({ma.abschlagProzent}% Abschlag)
                    </span>
                  )}
                </div>
                <KapazitaetsBalken
                  freigegeben={kap.verbrauchteStunden}
                  selbst={0}
                  vorgeschlagen={0}
                  quartalsKapazitaet={kap.effektivStunden}
                  showLabels={false}
                />
                <div className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">
                  <span className="font-medium text-[var(--tf-text-secondary)]">
                    {kap.zugewiesenAnzahl}/{kap.maxAntraege} Anträge
                  </span>
                  {' · '}
                  <span title={`${Math.round(kap.verbrauchteStunden)}h von ${Math.round(kap.effektivStunden)}h`}>
                    {kap.restAntraege >= 0 ? `${kap.restAntraege} frei` : `${-kap.restAntraege} überbucht`}
                  </span>
                </div>
              </div>
              {abgemeldet && (
                <span className="text-[10.5px] text-amber-700">⏸ abgemeldet</span>
              )}
              {!ma.aktiv && (
                <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">inaktiv</span>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="px-3 py-8 text-center text-[var(--tf-text-tertiary)] text-[12.5px]">
            Keine MAs in dieser Kategorie.
          </div>
        )}
      </div>

      {hasGaps && !zeigeInaktive && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] leading-tight">
          {aktivCount} von {totalCount} Mitarbeitern aktiv. Inaktive MAs behalten ihre Nummer — Lücken sind normal.
        </p>
      )}

      {/* Read-Flyout */}
      {openMaObj && (
        <MaReadFlyout
          ma={openMaObj}
          quartal={config.aktuellesQuartal}
          kategorien={config.ueberKategorien}
          zuweisungen={zuweisungen.filter(z => z.anonId === openMaObj.anonId && z.quartal === config.aktuellesQuartal)}
          antraegeIndex={new Map(cache.antraege.map(a => [a.aktenzeichen, a]))}
          onClose={() => setOpenMa(null)}
        />
      )}
    </div>
  );
}

function MaReadFlyout({
  ma, quartal, kategorien, zuweisungen, antraegeIndex, onClose,
}: {
  ma: AnonymerMitarbeiter;
  quartal: string;
  kategorien: import('../types').UeberKategorie[];
  zuweisungen: import('../types').Zuweisung[];
  antraegeIndex: Map<string, import('@/core/services/csv/types').Antrag>;
  onClose: () => void;
}): React.ReactElement {
  const haupt = ma.hauptKategorie || ma.ueberKategorien?.[0] || '';
  const neben = ma.nebenKategorien ?? (ma.ueberKategorien ? ma.ueberKategorien.slice(1) : []);
  const hauptKat = kategorien.find(k => k.id === haupt);
  const nebenKats = neben.map(id => kategorien.find(k => k.id === id)).filter((k): k is NonNullable<typeof k> => k != null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end p-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        className="w-[480px] max-h-full rounded-[12px] p-5 overflow-y-auto flex flex-col gap-4"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AnonymIdBadge anonId={ma.anonId} size="lg" />
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                {hauptKat && <KategoriePill kategorie={hauptKat} active />}
                {nebenKats.map(k => <KategoriePill key={k.id} kategorie={k} active={false} />)}
              </div>
              <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                {ma.jahresKapazitaet}h/Jahr
                {(ma.abschlagProzent ?? 0) > 0 && ` · ${ma.abschlagProzent}% Abschlag`}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-[var(--tf-text-tertiary)]">×</button>
        </div>

        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Zuweisungen in {quartal} ({zuweisungen.length})
          </div>
          <ul className="space-y-1">
            {zuweisungen.map(z => {
              const a = antraegeIndex.get(z.antragId);
              const titel = (a?.[CANONICAL_VERBUND_TITEL] as string | undefined)
                ?? (a?.[CANONICAL_TITEL] as string | undefined)
                ?? '—';
              return (
                <li key={`${z.antragId}-${z.anonId}`} className="flex items-center gap-2 text-[11.5px]">
                  <span className="font-mono text-[var(--tf-text-secondary)]">{z.antragId}</span>
                  <span className="flex-1 truncate">{titel}</span>
                  <span className="text-[10px] text-[var(--tf-text-tertiary)]">{z.status}</span>
                </li>
              );
            })}
            {zuweisungen.length === 0 && (
              <li className="text-[11.5px] text-[var(--tf-text-tertiary)]">Keine Zuweisungen in diesem Quartal.</li>
            )}
          </ul>
        </div>

        <p className="text-[11px] text-[var(--tf-text-tertiary)] leading-snug">
          Zur vollen Bearbeitung des MA-Profils → Abschnitt „Mitarbeiter" weiter unten.
        </p>
      </div>
    </div>
  );
}
