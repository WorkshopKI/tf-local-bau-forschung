/**
 * Auslastungs-Mini-Widget (Home, Seitenspalte — Phase 2 v1.1).
 *
 * Read-only: zeigt die Quartals-Belegung + Altanträge, entweder als Ich-Sicht
 * (ein MA) oder als Team-Aggregat (Summen über alle aktiven MAs — nie eine
 * MA-Rangliste). Rechnet den Einzel-MA selbst (Muster NeueAntraegeFuerDich,
 * NICHT den AuslastungIndexProvider auf die Home ziehen). EIN kombinierter
 * Balken (`StapelBalken`), links→rechts nach Alter: ältestes (Q-3..Q-7, dunkel)
 * → aktuelles Quartal (hell) rechts — NICHT die zweigeteilte Cockpit-
 * `GesamtauslastungBar`. Schwere Aggregation nur ausgeklappt (Lazy-Guard `aktiv`).
 */
import { useEffect, useMemo } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { refreshAntraegeCacheIfStale, useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useBestandGeneration } from '@/core/hooks/useBestandGeneration';
import { useKuerzelMap } from '@/plugins/auslastung/hooks/useKuerzelMap';
import { useMyAuslastungProfil } from '@/plugins/auslastung/hooks/useMyAuslastungProfil';
import {
  computeAltlasten,
  computeKapazitaet,
  computeQuartalsAuslastung,
  computeQuartalsStatistik,
} from '@/plugins/auslastung/services/kapazitaet';
import {
  altlastBandColor,
  altlastBandTextColor,
  ALTLAST_AKTUELL_COLOR,
  ALTLAST_AKTUELL_TEXT_COLOR,
} from '@/plugins/auslastung/views/uebersicht/altlast-colors';
import {
  ermittleSicht,
  ichBalkenModell,
  stapelSegmente,
  teamAggregat,
  type AuslastungBalkenModell,
  type StapelSegment,
} from './auslastungWidgetModel';
import { WidgetShell } from './WidgetShell';
import type { AuslastungWidgetConfig } from './types';
import type { WidgetProps } from './widgetProps';

const DEFAULT_CFG: AuslastungWidgetConfig = { art: 'auslastung', sicht: 'auto' };

interface WidgetView {
  sicht: 'ich' | 'team';
  kuerzelFehlt?: boolean;
  modell?: AuslastungBalkenModell;
  ueberMaCount?: number;
  aktivMaCount?: number;
}

export function AuslastungWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const storage = useStorage();
  const meinKuerzel = useMeinKuerzel();
  const { mode: bearbeiterMode } = useBearbeiterSicht();
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

  // Nach einem Import zieht der Antrags-Cache der Auslastung nach — sonst zeigte
  // die Karte bis zum Reload den Bestand von davor. Seine Selbst-Invalidierung
  // (`useAntraegeCacheSnapshotRefresh`) hängt nur in der Auslastungs-Ansicht;
  // hier genügt das Ereignis, kein Intervall. Billig, wenn nichts neu ist: ein
  // IDB-Get und ein Versionsvergleich. Generation 0 = in dieser Sitzung wurde
  // noch nichts ersetzt, der Cache ist so frisch wie sein Erst-Load.
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const generation = useBestandGeneration();
  useEffect(() => {
    if (!aktiv || !activeProgrammId || generation === 0) return;
    void refreshAntraegeCacheIfStale(storage, activeProgrammId);
  }, [aktiv, activeProgrammId, generation, storage]);

  const bereit = aktiv && loaded && kuerzelMapLoaded && !profilLoading;
  const sicht = ermittleSicht(cfg.sicht, myAnonId);
  const quartal = config.aktuellesQuartal;
  const stundenProTV = config.stundenProTV ?? 9;

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

  const view = useMemo((): WidgetView | null => {
    if (!bereit || !auslastungByAnon || !altlastByAnon) return null;
    if (sicht === 'ich') {
      if (!myAnonId || !myMa) return { sicht: 'ich', kuerzelFehlt: true };
      const kapView = computeKapazitaet(myMa, auslastungByAnon.get(myAnonId), config);
      const modell = ichBalkenModell(kapView, altlastByAnon.get(myAnonId), stundenProTV);
      return { sicht: 'ich', modell };
    }
    const stat = computeQuartalsStatistik(mitarbeiter, auslastungByAnon, config, quartal);
    const agg = teamAggregat(stat, altlastByAnon, mitarbeiter, stundenProTV);
    return { sicht: 'team', modell: agg, ueberMaCount: agg.ueberMaCount, aktivMaCount: agg.aktivMaCount };
  }, [bereit, auslastungByAnon, altlastByAnon, sicht, myAnonId, myMa, mitarbeiter, config, quartal, stundenProTV]);

  // **Die Schreibweise kommt aus der geteilten Fassade, nicht aus einem
  // `.toUpperCase()` hier** (v4.131). 81 der 112 Kürzel im Bestand sind gemischt
  // geschrieben, und die Bearbeitenden kennen ihres so; „Kürzel ATH" stand
  // damit neben dem „Kürzel ATh" der Nachbarkarte. Die Sicht-Achse dieses
  // Widgets (ich/team) bleibt seine eigene — nur die Schreibweise ist geteilt.
  const eigenesKuerzel =
    (bearbeiterMode.anzeigeTokens ?? bearbeiterMode.tokens).join('/') || (meinKuerzel ?? '');
  const scopeLabel = sicht === 'team' ? 'Alle Bearbeiter' : `Kürzel ${eigenesKuerzel || '—'}`;

  return (
    <WidgetShell
      titel="Auslastung"
      meta={`${quartal} · ${scopeLabel}`}
      variante="seite"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      /* Kein Zähler-Slot: die Belegung wird eingeklappt nicht berechnet
         (Lazy-Guard über ~13k Anträge), stünde also nur ausgeklappt — dort
         aber schon als „Belegt im Quartal … %"-Zeile im Body. Ein Zähler wäre
         eingeklappt tot und ausgeklappt doppelt (v2.239.3). */
    >
      {!view ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] py-1">Lade Auslastung …</p>
      ) : view.kuerzelFehlt ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] py-1">
          Kein Kürzel hinterlegt — lege es im Profil fest oder wähle in den Widget-Einstellungen die Team-Sicht.
        </p>
      ) : (
        <AuslastungInhalt view={view} />
      )}
    </WidgetShell>
  );
}

// Farbe/Text je Segment-Schlüssel: die Altanträge-Rampe (altlast-colors) plus die
// hellste „aktuell"-Stufe. Ein Balken, links (ältestes/dunkel) → rechts
// (aktuelles Quartal/hell).
const SEG_FARBE: Record<StapelSegment['key'], string> = {
  q3: altlastBandColor(3),
  q2: altlastBandColor(2),
  q1: altlastBandColor(1),
  akt: ALTLAST_AKTUELL_COLOR,
};
const SEG_TEXTFARBE: Record<StapelSegment['key'], string> = {
  q3: altlastBandTextColor(3),
  q2: altlastBandTextColor(2),
  q1: altlastBandTextColor(1),
  akt: ALTLAST_AKTUELL_TEXT_COLOR,
};
// Legende neuestes-zuerst (aktuelles Quartal → Q-3–7), passend zur Nutzer-Sicht.
const LEGENDE: readonly { key: StapelSegment['key']; label: string }[] = [
  { key: 'akt', label: 'Aktuell' },
  { key: 'q1', label: 'Q-1' },
  { key: 'q2', label: 'Q-2' },
  { key: 'q3', label: 'Q-3–7' },
];

function AuslastungInhalt({ view }: { view: WidgetView }): React.ReactElement {
  const m = view.modell!;
  const ueberbucht = m.belegtPct > 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-[var(--tf-text-secondary)]">Belegt im Quartal</span>
        <span className="text-[15px] font-semibold tabular-nums text-[var(--tf-text)]">{m.belegtPct} %</span>
      </div>
      <StapelBalken segmente={stapelSegmente(m)} />
      <p className="text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)]">
        {m.belegteTVs} von {m.gesamtTVs} TVs · {ueberbucht ? 'überbucht' : `${m.freiTVs} frei`}
        {m.altlastTvs > 0 ? ` · ${m.altlastTvs} TVs Altanträge` : ''}
        {view.sicht === 'team' && view.ueberMaCount !== undefined && view.aktivMaCount !== undefined
          ? ` · ${view.ueberMaCount} von ${view.aktivMaCount} MAs über 100 %`
          : ''}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--tf-text-tertiary)]">
        {LEGENDE.map(({ key, label }) => (
          <span key={key} className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: SEG_FARBE[key] }} aria-hidden />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Kombinierter Auslastungs-Balken (nur Home-Widget): EIN pill-geclippter Track,
 * Segmente links→rechts nach Alter — ältestes (Q-3..Q-7, dunkel) links, aktuelles
 * Quartal (hell) rechts; der ungefüllte Rest rechts = frei. Zahl je Segment nur,
 * wenn es breit genug ist. file://-kompatibler `title`-Tooltip je Segment.
 */
function StapelBalken({ segmente }: { segmente: StapelSegment[] }): React.ReactElement {
  let offset = 0;
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 13, background: 'var(--tf-bg-secondary)', borderRadius: 'var(--tf-radius-pill)' }}
    >
      {segmente.map(s => {
        if (s.pct <= 0) return null;
        const left = offset;
        offset += s.pct;
        const zeigeZahl = s.tvs > 0 && s.pct >= 9;
        return (
          <div
            key={s.key}
            className="absolute top-0 bottom-0 flex items-center justify-center overflow-hidden"
            style={{ left: `${left}%`, width: `${s.pct}%`, background: SEG_FARBE[s.key] }}
            title={`${s.label}: ${s.tvs} ${s.tvs === 1 ? 'TV' : 'TVs'}`}
          >
            {zeigeZahl && (
              <span
                className="font-mono"
                style={{ fontSize: 9.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: SEG_TEXTFARBE[s.key] }}
              >
                {s.tvs}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
