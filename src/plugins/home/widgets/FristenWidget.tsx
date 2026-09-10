/**
 * „Fristen" (Home-Widget) — **eine** Liste für beide Fristsysteme.
 *
 * Beantwortet die Frage, mit der der Arbeitstag beginnt: *was ist zu spät?* Bis
 * v4.86 standen dafür zwei Widgets nebeneinander („Hängt fest" aus den Zieltagen,
 * „Meilensteine diese Woche" aus dem Plan). Zwei Zahlen zur selben Frage, aus
 * zwei Pflegeorten mit zwei Freigabe-Begriffen — und keines sagte, aus welchem
 * System seine Warnung kam.
 *
 * **Zusammen gezeigt, nicht zusammen gerechnet**: die beiden Evaluatoren laufen
 * unverändert weiter (`pruefeStillstand`, die Meilenstein-Projektion); dieses
 * Widget bringt nur ihre Ergebnisse auf eine Zeile — Modell und Sortierung in
 * [fristAnlaesse.ts](./fristAnlaesse.ts). Jede Zeile trägt ihre Herkunft, sonst
 * wüsste niemand, wo er die Warnung abstellt.
 *
 * Beide Hälften hängen an eigenen Flags und werden einzeln zugeschaltet: ist nur
 * eine an, zeigt das Widget nur sie — und sagt es in der Fußzeile, statt eine
 * Vollständigkeit vorzutäuschen, die es nicht hat.
 *
 * Scope ist der bereits berechnete Dashboard-Aggregat (`ctx.data.meineAntraege`),
 * kein zweiter Bearbeiter-Filter. Geladen wird nur im ausgeklappten Zustand.
 */
import { useMemo, useRef } from 'react';
import { QuellSpaltenTooltip, type Erklaerer } from '@/components/quellspalten';
import { knotenQuellen } from '@/core/meilensteine';
import { feldQuellen } from '@/core/status/bedingung-quellen';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { isMeilensteinMonitoringEnabled, isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  bilanzText, buendleNachVerbund, sichtbareMischung, ueberTageText, type FristAnlass,
} from './fristAnlaesse';
import { useFristAnlaesse } from './useFristAnlaesse';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const MAX_ZEILEN = 8;
/** So viele Plätze bekommt jede vorhandene Quelle mindestens (s. sichtbareMischung). */
const MIN_JE_QUELLE = 2;

/** Die Farbe sagt „gerissen" gegen „steht bevor" — nicht, aus welchem System. */
function farbe(a: FristAnlass): string {
  return a.gerissen ? 'var(--tf-danger-text)' : 'var(--tf-warning-text)';
}

/**
 * Woraus der Grund einer Zeile gelesen wurde — der Meilenstein mit seiner
 * Bedingung, der Zieltag mit dem Verbund-Status oder den Feldern seines
 * Kürzel-Paars. `null`, wo die Zeile ihre Quellspalten nicht belegen kann
 * (Kürzel, das der Katalog nicht kennt); dann bleibt der blanke Text.
 */
function erklaererVon(z: FristAnlass): Erklaerer | null {
  if (z.knoten) {
    const k = z.knoten;
    return idx => knotenQuellen(k, idx);
  }
  if (z.quellFelder?.length) {
    const felder = z.quellFelder;
    return idx => feldQuellen(felder, idx, z.grund);
  }
  return null;
}

export function FristenWidget({
  instanz, ctx, onToggleEingeklappt,
}: WidgetProps): React.ReactElement | null {
  const { navigate } = useNavigation();
  // Vor jedem Flag-Return (React-Hook-Regel); trägt die Schreibweise der Kürzel.
  const { mode: bearbeiterMode } = useBearbeiterSicht();
  const aktiv = !instanz.eingeklappt;
  // EIN Stichtag je Mount, in die reinen Bausteine injiziert.
  const heuteRef = useRef<string>(new Date().toISOString());

  /** verbund_id → Akronym, aus dem bereits berechneten Dashboard-Aggregat. */
  const meineVerbuende = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of ctx.data.meineAntraege) {
      if (!a.verbund_id || m.has(a.verbund_id)) continue;
      m.set(a.verbund_id, a.acronym ?? a.verbund_titel ?? a.title ?? a.verbund_id);
    }
    return m;
  }, [ctx.data.meineAntraege]);

  // Geteilt mit dem Tagesbrief (v6.45) — eine Herleitung, zwei Leser.
  const { anlaesse, unbewertet, ohneBedingung, laden } =
    useFristAnlaesse(aktiv, meineVerbuende, heuteRef.current);

  const zieltageAn = isVorgangssystemEnabled();
  const meilensteineAn = isMeilensteinMonitoringEnabled();
  if (!zieltageAn && !meilensteineAn) return null;

  // Eine Zeile je Vorgang, wie im Modul „Fristen & Meilensteine". Die Kopfzahl
  // zählt weiter die ANLÄSSE — sie beantwortet „wie viel steht offen", die Liste
  // „wo steht es".
  const zeilen = buendleNachVerbund(anlaesse);
  const sichtbar = sichtbareMischung(zeilen, MAX_ZEILEN, MIN_JE_QUELLE);
  const rest = zeilen.length - sichtbar.length;
  const scope = bearbeiterScopeLabel(bearbeiterMode);
  // Ein Widget, das nur eine Hälfte zeigt, sagt es — sonst liest man eine
  // unvollständige Liste als vollständige.
  const nurEine = zieltageAn !== meilensteineAn
    ? (zieltageAn ? 'Nur Zieltage — der Meilenstein-Plan ist hier nicht aktiv.'
      : 'Nur Meilensteine — der Stillstands-Wächter ist hier nicht aktiv.')
    : null;

  return (
    <WidgetShell
      titel="Fristen"
      meta={scope}
      variante={instanz.bereich === 'seite' ? 'seite' : 'haupt'}
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        // Beide Zahlen, nicht nur die Summe: die Sortierung nach Abstand laesst
        // sonst eine der beiden Quellen aus den sichtbaren Zeilen verschwinden.
        //
        // **Eingeklappt wird nicht gerechnet** (Lazy-Guard `aktiv`) — dann steht
        // hier ein „—", kein „0" (v4.131). Die Null war eine Aussage, die das
        // Widget in diesem Zustand gar nicht treffen kann: sie las sich als
        // „nichts ist überfällig", während schlicht nichts bewertet wurde.
        <span
          className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]"
          title={!aktiv ? 'Zum Zählen aufklappen — eingeklappt wird nicht bewertet.' : undefined}
        >
          {!aktiv ? '—' : laden ? '…' : anlaesse.length > 0 ? bilanzText(anlaesse) : '0'}
        </span>
      }
    >
      {laden ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">Bewertet …</p>
      ) : anlaesse.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">
          Nichts über der Frist und nichts diese Woche fällig.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sichtbar.map(z => {
            const erklaere = erklaererVon(z);
            return (
            <button
              key={z.id}
              type="button"
              // Mit Quellspalten-Tooltip kein `title` daneben — der native Kasten
              // legte sich über den erklärenden.
              title={erklaere ? undefined : z.grund}
              onClick={() => navigate('antraege', { selectedId: z.verbundId })}
              className="flex w-full items-center gap-2 min-w-0 rounded-[10px] bg-[var(--tf-bg)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--tf-bg-secondary)] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              <span
                aria-hidden
                className="shrink-0 inline-block rounded-full"
                style={{ width: 7, height: 7, background: farbe(z) }}
              />
              <span className="shrink-0 max-w-[34%] truncate text-[13px] font-medium text-[var(--tf-text)]">
                {z.akronym}
              </span>
              {/* Die Herkunft — ohne sie ist die Warnung nicht abstellbar. */}
              <span className="shrink-0 text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">
                {z.marke}
              </span>
              {erklaere ? (
                <QuellSpaltenTooltip erklaere={erklaere} wrapperClassName="flex-1 min-w-0 truncate">
                  <span className="text-[12px] text-[var(--tf-text-secondary)] cursor-help">{z.grund}</span>
                </QuellSpaltenTooltip>
              ) : (
                <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]">
                  {z.grund}
                </span>
              )}
              {(z.weitere ?? 0) > 0 && (
                <span
                  className="shrink-0 text-[11px] tabular-nums text-[var(--tf-text-tertiary)]"
                  title={`${(z.weitere ?? 0) + 1} offene Anlässe in diesem Vorgang — gezeigt ist der dringendste`}
                >
                  {(z.weitere ?? 0) + 1} offen
                </span>
              )}
              <span className="shrink-0 text-[11px] tabular-nums" style={{ color: farbe(z) }}>
                {ueberTageText(z.ueberTage)}
              </span>
            </button>
            );
          })}
          {rest > 0 && (
            <p className="pt-0.5 text-[11px] text-[var(--tf-text-tertiary)]">
              +{rest} weitere {rest === 1 ? 'Vorgang' : 'Vorgänge'}
            </p>
          )}
        </div>
      )}
      {(unbewertet > 0 || ohneBedingung > 0 || nurEine) && (
        <p className="pt-1 text-[11px] text-[var(--tf-text-tertiary)]">
          {unbewertet > 0
            && `${unbewertet} nicht bewertbar — für ihren Status sind keine Zieltage gepflegt. `}
          {ohneBedingung > 0
            && `${ohneBedingung} ${ohneBedingung === 1 ? 'Meilenstein trägt' : 'Meilensteine tragen'}`
              + ` keine Bedingung und ${ohneBedingung === 1 ? 'wird' : 'werden'} nicht bewertet`
              + ` (Modul „Fristen & Meilensteine"). `}
          {nurEine}
        </p>
      )}
    </WidgetShell>
  );
}
