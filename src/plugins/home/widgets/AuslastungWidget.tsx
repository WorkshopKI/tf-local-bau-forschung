/**
 * Auslastungs-Mini-Widget (Home, Seitenspalte — Phase 2 v1.1).
 *
 * Read-only + Navigation: zeigt die Quartals-Belegung + Altanträge, entweder als
 * Ich-Sicht (ein MA) oder als Team-Aggregat (Summen über alle aktiven MAs — nie
 * eine MA-Rangliste). Rechnet den Einzel-MA selbst (Muster NeueAntraegeFuerDich,
 * NICHT den AuslastungIndexProvider auf die Home ziehen); die geteilte
 * `GesamtauslastungBar` rendert beide Balken. Schwere Aggregation nur ausgeklappt
 * (Lazy-Guard `aktiv`). Fußzeile → Auslastungs-Cockpit.
 */
import { useEffect, useMemo } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import { useKuerzelMap } from '@/plugins/auslastung/hooks/useKuerzelMap';
import { useMyAuslastungProfil } from '@/plugins/auslastung/hooks/useMyAuslastungProfil';
import {
  computeAltlasten,
  computeKapazitaet,
  computeQuartalsAuslastung,
  computeQuartalsStatistik,
} from '@/plugins/auslastung/services/kapazitaet';
import { GesamtauslastungBar } from '@/plugins/auslastung/views/uebersicht/GesamtauslastungBar';
import { ALTLAST_BAND_COLORS, ALTLAST_BAND_SHORT } from '@/plugins/auslastung/views/uebersicht/altlast-colors';
import {
  ermittleSicht,
  ichBalkenModell,
  teamAggregat,
  vorherigesQuartal,
  type AuslastungBalkenModell,
} from './auslastungWidgetModel';
import { WidgetShell } from './WidgetShell';
import type { AuslastungWidgetConfig } from './types';
import type { WidgetProps } from './widgetProps';

const DEFAULT_CFG: AuslastungWidgetConfig = { art: 'auslastung', sicht: 'auto', vergleichAnzeigen: true };

interface WidgetView {
  sicht: 'ich' | 'team';
  kuerzelFehlt?: boolean;
  modell?: AuslastungBalkenModell;
  ueberMaCount?: number;
  aktivMaCount?: number;
  vergleichDelta?: number | null;
}

export function AuslastungWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
  const meinKuerzel = useMeinKuerzel();
  const config = useAuslastungData(s => s.data.config);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const loaded = useAuslastungData(s => s.loaded);
  const load = useAuslastungData(s => s.load);
  const cache = useAntraegeCache();
  const kuerzelMapLoaded = useKuerzelMap(s => s.loaded);
  const { myAnonId, effectiveMa: myMa, loading: profilLoading } = useMyAuslastungProfil();

  const cfg = instanz.config.art === 'auslastung' ? instanz.config : DEFAULT_CFG;
  const aktiv = !instanz.eingeklappt; // Lazy: eingeklappt nichts rechnen (13k Anträge)

  useEffect(() => {
    if (aktiv && !loaded) void load(storage);
  }, [aktiv, loaded, load, storage]);

  const bereit = aktiv && loaded && kuerzelMapLoaded && !profilLoading;
  const sicht = ermittleSicht(cfg.sicht, myAnonId);
  const quartal = config.aktuellesQuartal;
  const stundenProTV = config.stundenProTV ?? 9;
  const vorQuartal = vorherigesQuartal(quartal);

  const auslastungByAnon = useMemo(
    () => (bereit
      ? computeQuartalsAuslastung(cache.antraege, zuweisungen, cache.anonymMap.toAnon, quartal, stundenProTV, config.stundenProTVProTyp)
      : null),
    [bereit, cache.antraege, cache.anonymMap, zuweisungen, quartal, stundenProTV, config.stundenProTVProTyp],
  );
  const altlastByAnon = useMemo(
    () => (bereit ? computeAltlasten(cache.antraege, cache.anonymMap.toAnon, quartal, stundenProTV) : null),
    [bereit, cache.antraege, cache.anonymMap, quartal, stundenProTV],
  );
  const vorAuslastungByAnon = useMemo(
    () => (bereit && cfg.vergleichAnzeigen && vorQuartal
      ? computeQuartalsAuslastung(cache.antraege, zuweisungen, cache.anonymMap.toAnon, vorQuartal, stundenProTV, config.stundenProTVProTyp)
      : null),
    [bereit, cfg.vergleichAnzeigen, vorQuartal, cache.antraege, cache.anonymMap, zuweisungen, stundenProTV, config.stundenProTVProTyp],
  );

  const view = useMemo((): WidgetView | null => {
    if (!bereit || !auslastungByAnon || !altlastByAnon) return null;
    if (sicht === 'ich') {
      if (!myAnonId || !myMa) return { sicht: 'ich', kuerzelFehlt: true };
      const kapView = computeKapazitaet(myMa, auslastungByAnon.get(myAnonId), config);
      const modell = ichBalkenModell(kapView, altlastByAnon.get(myAnonId), stundenProTV);
      let vergleichDelta: number | null = null;
      if (vorAuslastungByAnon) {
        const vor = computeKapazitaet(myMa, vorAuslastungByAnon.get(myAnonId), config);
        if (vor.effektivStunden > 0) {
          vergleichDelta = modell.belegtPct - Math.round((vor.verbrauchteStunden / vor.effektivStunden) * 100);
        }
      }
      return { sicht: 'ich', modell, vergleichDelta };
    }
    const stat = computeQuartalsStatistik(mitarbeiter, auslastungByAnon, config, quartal);
    const agg = teamAggregat(stat, altlastByAnon, mitarbeiter, stundenProTV);
    let vergleichDelta: number | null = null;
    if (vorAuslastungByAnon && vorQuartal) {
      vergleichDelta = agg.belegtPct - computeQuartalsStatistik(mitarbeiter, vorAuslastungByAnon, config, vorQuartal).kapazitaet.prozent;
    }
    return { sicht: 'team', modell: agg, ueberMaCount: agg.ueberMaCount, aktivMaCount: agg.aktivMaCount, vergleichDelta };
  }, [bereit, auslastungByAnon, altlastByAnon, vorAuslastungByAnon, sicht, myAnonId, myMa, mitarbeiter, config, quartal, stundenProTV, vorQuartal]);

  const scopeLabel = sicht === 'team' ? 'Alle Bearbeiter' : `Kürzel ${(meinKuerzel ?? '').toUpperCase() || '—'}`;

  return (
    <WidgetShell
      titel="Auslastung"
      meta={`${quartal} · ${scopeLabel}`}
      variante="seite"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        view?.modell ? (
          <span className="text-[12px] tabular-nums font-medium text-[var(--tf-text)]">{view.modell.belegtPct} %</span>
        ) : undefined
      }
    >
      {!view ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] py-1">Lade Auslastung …</p>
      ) : view.kuerzelFehlt ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] py-1">
          Kein Kürzel hinterlegt — lege es im Profil fest oder wähle in den Widget-Einstellungen die Team-Sicht.
        </p>
      ) : (
        <AuslastungInhalt view={view} quartal={quartal} vorQuartal={vorQuartal} onCockpit={() => navigate('auslastung')} />
      )}
    </WidgetShell>
  );
}

function AuslastungInhalt({ view, quartal, vorQuartal, onCockpit }: {
  view: WidgetView; quartal: string; vorQuartal: string | null; onCockpit: () => void;
}): React.ReactElement {
  const m = view.modell!;
  const vorLabel = vorQuartal ? vorQuartal.split('-')[1] : '';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-[var(--tf-text-secondary)]">Belegt im Quartal</span>
        <span className="text-[15px] font-semibold tabular-nums text-[var(--tf-text)]">{m.belegtPct} %</span>
      </div>
      <GesamtauslastungBar
        belegtPct={m.belegtPct}
        altlastBandPct={m.altlastBandPct}
        freiTVs={m.freiTVs}
        altlastTvs={m.altlastTvs}
        altlastBandTvs={m.altlastBandTvs}
        quartal={quartal}
        height={13}
        altlastZahlen
      />
      <p className="text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)]">
        {m.belegteTVs} von {m.gesamtTVs} TVs · {m.freiTVs} frei
        {view.sicht === 'team' && view.ueberMaCount !== undefined && view.aktivMaCount !== undefined
          ? ` · ${view.ueberMaCount} von ${view.aktivMaCount} MAs über 100 %`
          : ''}
      </p>
      {m.altlastTvs > 0 ? (
        // Die TVs je Band stehen jetzt IM Balken (altlastZahlen) — hier nur noch
        // die Farb-Legende + Gesamtsumme, keine doppelten Zahlen.
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
          <span className="text-[var(--tf-text-secondary)]">Altanträge: {m.altlastTvs} TVs</span>
          {ALTLAST_BAND_SHORT.map((label, i) => (
            <span key={label} className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-[2px]" style={{ background: ALTLAST_BAND_COLORS[i] }} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between pt-1.5 mt-0.5" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {view.vergleichDelta !== null && view.vergleichDelta !== undefined
            ? `ggü. ${vorLabel}: Belegung ${view.vergleichDelta >= 0 ? '+' : '−'}${Math.abs(view.vergleichDelta)} %`
            : ''}
        </span>
        <button
          type="button"
          onClick={onCockpit}
          className="text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer"
        >
          Zum Cockpit →
        </button>
      </div>
    </div>
  );
}
