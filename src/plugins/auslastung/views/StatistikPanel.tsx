/**
 * StatistikPanel (v2.6) — Quartals-Gesamtsicht fuer PL.
 *
 * Collapsible Section ueber der Mitarbeiter-Tabelle, Default eingeklappt.
 * Zeigt Quartal-Fortschritt, MA-Counts, Stunden-Bilanz, Antraege-Bilanz,
 * Warnungen (ueberbucht/leer/Deskriptoren) und Verteilung pro Kategorie
 * als Mini-Bars.
 */
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CollapsibleSection } from '@/ui/CollapsibleSection';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useDeAnonResolver } from '../components/AnonymIdBadge';
import { computeQuartalsStatistik } from '../services/statistik';
import { computeQuartalsAuslastung } from '../services/quartals-auslastung';
import { KategoriePill } from '../components/KategoriePill';

/** Format-Helfer fuer Stunden (Tausender-Trenner, ohne Nachkommastellen). */
function fmtH(n: number): string {
  return Math.round(n).toLocaleString('de-DE');
}

export function StatistikPanel(): React.ReactElement {
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const config = useAuslastungData(s => s.data.config);
  const cache = useAntraegeCache();
  const resolveName = useDeAnonResolver();

  // Quartals-Auslastung pro MA (gleicher Index wie in der MA-Tabelle).
  const auslastungByAnon = useMemo(
    () => computeQuartalsAuslastung(
      cache.antraege,
      zuweisungen,
      cache.anonymMap.toAnon,
      config.aktuellesQuartal,
      config.stundenProTV ?? 9,
    ),
    [cache.antraege, cache.anonymMap, zuweisungen, config.aktuellesQuartal, config.stundenProTV],
  );

  // Deskriptoren ohne Zuordnung: alle Werte, die in KEINER Kategorie deskriptorenMapping liegen.
  const deskriptorenOhneZuordnung = useMemo(() => {
    const zugeordnet = new Set<string>();
    for (const k of config.ueberKategorien) {
      for (const d of k.deskriptorenMapping) zugeordnet.add(d.toLowerCase().trim());
    }
    let n = 0;
    for (const d of cache.allDeskriptoren) {
      if (!zugeordnet.has(d.wert.toLowerCase().trim())) n++;
    }
    return n;
  }, [config.ueberKategorien, cache.allDeskriptoren]);

  const stats = useMemo(
    () => computeQuartalsStatistik(mitarbeiter, auslastungByAnon, config, config.aktuellesQuartal, deskriptorenOhneZuordnung),
    [mitarbeiter, auslastungByAnon, config, deskriptorenOhneZuordnung],
  );

  // Max-Count fuer Bar-Skalierung in der Kategorien-Verteilung.
  const maxKategorieCount = Math.max(1, ...stats.kategorienVerteilung.map(k => k.aktiveCount));

  // Subtitle (eingeklappt sichtbar): kompakte Kennzahlen-Zusammenfassung.
  const subtitle = `${stats.ma.aktiv} aktiv · ${stats.kapazitaet.prozent}% gebucht · ${stats.antraege.freieTVs} TVs frei${
    stats.warnungen.ueberbuchteMAs.length > 0 ? ` · ⚠ ${stats.warnungen.ueberbuchteMAs.length} überbucht` : ''
  }`;

  return (
    <CollapsibleSection
      label={`Statistik-Übersicht — ${config.aktuellesQuartal}`}
      subtitle={subtitle}
      defaultOpen={false}
    >
      <div className="flex flex-col gap-4 px-1">
        {/* Quartal-Fortschritt */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
              Quartal-Fortschritt
            </span>
            <span className="text-[11.5px] text-[var(--tf-text-secondary)] tabular-nums">
              {stats.quartal.fortschrittProzent} % · Tag {stats.quartal.tagAktuell} / {stats.quartal.tageGesamt}
            </span>
          </div>
          <div className="h-2 rounded overflow-hidden" style={{ background: 'var(--tf-bg-secondary)' }}>
            <div
              className="h-full"
              style={{
                width: `${stats.quartal.fortschrittProzent}%`,
                background: 'var(--tf-primary)',
                transition: 'width 200ms ease-out',
              }}
            />
          </div>
        </div>

        {/* Kennzahlen-Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatBlock
            label="Mitarbeiter"
            primary={`${stats.ma.aktiv} aktiv / ${stats.ma.gesamt} gesamt`}
            secondary={
              `${stats.ma.abgemeldet} abgemeldet${stats.ma.ohneBuchungen > 0
                ? ` · ${stats.ma.ohneBuchungen} ohne Buchungen`
                : ''}`
            }
          />
          <StatBlock
            label="Kapazität"
            primary={`${fmtH(stats.kapazitaet.verbrauchteStunden)} / ${fmtH(stats.kapazitaet.effektivStunden)} h gebucht`}
            secondary={`${stats.kapazitaet.prozent} % belegt · ${fmtH(stats.kapazitaet.freiStunden)} h frei`}
          />
          <StatBlock
            label="Anträge im Quartal"
            primary={`${stats.antraege.fest} fest (${stats.antraege.festTvs} TVs)`}
            secondary={
              `${stats.antraege.pending} pending (${stats.antraege.pendingTvs} TVs) · ${stats.antraege.freieTVs} TVs frei`
            }
          />
        </div>

        {/* Warnungen */}
        {(stats.warnungen.ueberbuchteMAs.length > 0
          || stats.warnungen.leereMAs.length > 0
          || stats.warnungen.deskriptorenOhneZuordnung > 0) && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
              Warnungen
            </span>
            <ul className="space-y-1 text-[12px]">
              {stats.warnungen.ueberbuchteMAs.length > 0 && (
                <li className="flex items-baseline gap-2 text-rose-700">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>
                    {stats.warnungen.ueberbuchteMAs.length} {stats.warnungen.ueberbuchteMAs.length === 1 ? 'MA überbucht' : 'MAs überbucht'}:{' '}
                    <span className="font-mono">
                      {stats.warnungen.ueberbuchteMAs
                        .slice(0, 5)
                        .map(id => {
                          const real = resolveName(id);
                          return real ? `${id} (${real})` : id;
                        })
                        .join(', ')}
                      {stats.warnungen.ueberbuchteMAs.length > 5 && ` +${stats.warnungen.ueberbuchteMAs.length - 5}`}
                    </span>
                  </span>
                </li>
              )}
              {stats.warnungen.leereMAs.length > 0 && (
                <li className="flex items-baseline gap-2 text-amber-700">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>
                    {stats.warnungen.leereMAs.length} aktive {stats.warnungen.leereMAs.length === 1 ? 'MA' : 'MAs'} ohne Buchungen im Quartal
                  </span>
                </li>
              )}
              {stats.warnungen.deskriptorenOhneZuordnung > 0 && (
                <li className="flex items-baseline gap-2 text-amber-700">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>{stats.warnungen.deskriptorenOhneZuordnung} Deskriptoren ohne Kategorie-Zuordnung</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Kategorien-Verteilung */}
        {stats.kategorienVerteilung.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
              Verteilung aktiver MAs pro Kategorie
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {stats.kategorienVerteilung.map(k => {
                const widthPct = (k.aktiveCount / maxKategorieCount) * 100;
                return (
                  <div key={k.id} className="flex items-center gap-2 text-[11.5px]">
                    <div className="shrink-0 w-12">
                      <KategoriePill kategorie={{ id: k.id, name: k.name, farbe: k.farbe }} mode="primaer" />
                    </div>
                    <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: 'var(--tf-bg-secondary)' }}>
                      <div
                        className="h-full"
                        style={{
                          width: `${widthPct}%`,
                          background: 'var(--tf-primary)',
                          opacity: 0.6,
                          transition: 'width 200ms ease-out',
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-[var(--tf-text-secondary)] tabular-nums w-16 text-right">
                      {k.aktiveCount} · {k.prozent}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function StatBlock({
  label, primary, secondary,
}: {
  label: string;
  primary: string;
  secondary: string;
}): React.ReactElement {
  return (
    <div className="rounded-[8px] p-2.5" style={{ border: '0.5px solid var(--tf-border)' }}>
      <p className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
        {label}
      </p>
      <p className="text-[13px] font-medium text-[var(--tf-text)] mt-0.5">{primary}</p>
      <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5 leading-snug">{secondary}</p>
    </div>
  );
}
