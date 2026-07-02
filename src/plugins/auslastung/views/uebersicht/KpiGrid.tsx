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
import { computeQuartalsStatistik, type QuartalsStatistik } from '../../services/kapazitaet';
import { KpiCard } from './KpiCard';

function fmtH(n: number): string {
  return Math.round(n).toLocaleString('de-DE');
}

/** Kurz-Prefix aus dem Quartals-Label: "2026-Q1" → "Q1". */
function qShort(label: string): string {
  return label.replace(/^\d{4}-/, '');
}

/** Signierte Stunden-Differenz, z.B. "+186 h" / "−186 h" / "±0 h". */
function hDelta(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '±0 h';
  return r > 0 ? `+${fmtH(r)} h` : `−${fmtH(-r)} h`;
}

interface Props {
  /** Optionales Vergleichsquartal (Delta-Overlay). `null` → kein Vergleich. */
  vergleich?: QuartalsStatistik | null;
}

export function KpiGrid({ vergleich }: Props): React.ReactElement {
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

  // Delta-Overlay: dezente Vergleichs-Zeile je Karte (Prefix = "Q1").
  const q = vergleich ? qShort(vergleich.quartal.label) : '';
  const mitarbeiterCompare = vergleich ? `${q}: ${vergleich.ma.aktiv} aktiv` : undefined;
  const kapCompare = vergleich
    ? `${q}: ${fmtH(vergleich.kapazitaet.verbrauchteStunden)} h · ${hDelta(stats.kapazitaet.verbrauchteStunden - vergleich.kapazitaet.verbrauchteStunden)}`
    : undefined;
  const antraegeCompare = vergleich ? `${q}: ${vergleich.antraege.fest} aktuell` : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <KpiCard
        label="Mitarbeiter"
        primary={String(stats.ma.aktiv)}
        ofText={`/ ${stats.ma.gesamt} aktiv`}
        progressPct={mitarbeiterProgress}
        meta={mitarbeiterMeta}
        compareNote={mitarbeiterCompare}
      />
      <KpiCard
        label="Kapazität"
        primary={`${fmtH(stats.kapazitaet.verbrauchteStunden)} h`}
        ofText={`/ ${fmtH(stats.kapazitaet.effektivStunden)} h`}
        progressPct={stats.kapazitaet.prozent}
        meta={kapMeta}
        compareNote={kapCompare}
      />
      <KpiCard
        label="Anträge im Quartal"
        primary={`${stats.antraege.fest} aktuell`}
        ofText={`· ${stats.antraege.pendingTvs} pending TVs`}
        progressPct={tvsProgress}
        progressColor={antraegeColor}
        meta={antraegeMeta}
        compareNote={antraegeCompare}
      />
    </div>
  );
}
