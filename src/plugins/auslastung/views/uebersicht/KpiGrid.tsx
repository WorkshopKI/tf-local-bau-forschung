/**
 * KpiGrid — 3-Spalten-Grid der Quartals-KPIs.
 *
 * Spalten:
 *  1. Mitarbeiter (aktiv / gesamt, Progress = aktiv/gesamt, Meta: ohne-Buchungen/abgemeldet)
 *  2. Kapazität   (verbraucht / effektiv, Progress = prozent belegt)
 *  3. Anträge im Quartal (fest · TVs, Progress = freieTVs/maxTVs Annäherung, grün bei 100%)
 *
 * Werte kommen aus `computeQuartalsStatistik()`.
 */
import { useMemo } from 'react';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { useAuslastungIndex } from '../../hooks/useAuslastungIndex';
import { computeQuartalsStatistik } from '../../services/statistik';
import { KpiCard } from './KpiCard';

function fmtH(n: number): string {
  return Math.round(n).toLocaleString('de-DE');
}

export function KpiGrid(): React.ReactElement {
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const config = useAuslastungData(s => s.data.config);
  const { auslastungByAnon } = useAuslastungIndex();

  const stats = useMemo(
    () => computeQuartalsStatistik(mitarbeiter, auslastungByAnon, config, config.aktuellesQuartal),
    [mitarbeiter, auslastungByAnon, config],
  );

  // Mitarbeiter: aktive Quote im Gesamt-Pool.
  const mitarbeiterProgress = stats.ma.gesamt > 0
    ? (stats.ma.aktiv / stats.ma.gesamt) * 100
    : 0;
  const mitarbeiterMeta = `${stats.ma.ohneBuchungen} ohne Buchungen · ${stats.ma.abgemeldet} abgemeldet`;

  // Kapazität: prozent belegt.
  const kapMeta = `${fmtH(stats.kapazitaet.freiStunden)} h frei · ${stats.kapazitaet.prozent} % belegt`;

  // Anträge: fest + pending TVs gemessen an max. moeglichen TVs (fest+pending+frei).
  const tvsGesamt = stats.antraege.festTvs + stats.antraege.pendingTvs + stats.antraege.freieTVs;
  const tvsProgress = tvsGesamt > 0
    ? ((stats.antraege.festTvs + stats.antraege.pendingTvs) / tvsGesamt) * 100
    : 0;
  const antraegeColor = tvsProgress >= 100 ? 'hsl(145, 50%, 50%)' : undefined;
  const antraegeMeta = `${stats.antraege.pending} pending · ${stats.antraege.freieTVs} TVs frei verfügbar`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <KpiCard
        label="Mitarbeiter"
        primary={String(stats.ma.aktiv)}
        ofText={`/ ${stats.ma.gesamt} aktiv`}
        progressPct={mitarbeiterProgress}
        meta={mitarbeiterMeta}
      />
      <KpiCard
        label="Kapazität"
        primary={`${fmtH(stats.kapazitaet.verbrauchteStunden)} h`}
        ofText={`/ ${fmtH(stats.kapazitaet.effektivStunden)} h`}
        progressPct={stats.kapazitaet.prozent}
        meta={kapMeta}
      />
      <KpiCard
        label="Anträge im Quartal"
        primary={`${stats.antraege.fest} fest`}
        ofText={`· ${stats.antraege.pendingTvs} pending TVs`}
        progressPct={tvsProgress}
        progressColor={antraegeColor}
        meta={antraegeMeta}
      />
    </div>
  );
}
