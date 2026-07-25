/**
 * Auswertung: wie lange dauert die Bearbeitung tatsächlich, und wo weicht sie
 * vom Soll ab — gesamt und getrennt nach Antragstyp.
 *
 * Zwei Datenquellen mit unterschiedlicher Grundgesamtheit, deshalb bewusst
 * getrennt beschriftet:
 * - **Abgeschlossene** Vorgänge tragen die Dauer-Statistik (erst am Ende steht
 *   fest, wie lange es gedauert hat).
 * - **Offene** Verbünde tragen die Prognose- und Meilenstein-Statistik.
 *
 * Ein Durchschnitt über null Fälle wird als „—" gezeigt, nie als 0 — eine 0 läse
 * sich als „sehr schnell".
 */
import { useMemo } from 'react';
import { DistributionBar } from '@/components/ui/DistributionBar';
import {
  DAUER_BUCKETS, werteDauernAus, werteKnotenAus, zaehlePrognosen,
  type AbschlussFall, type DauerAuswertung, type DauerBucket, type MeilensteinPlan,
} from '@/core/meilensteine';
import { PROGNOSE_FARBE, PROGNOSE_LABEL, PROGNOSE_REIHENFOLGE, TYP_LABEL, feldStil } from './labels';
import type { VerbundZeile } from './useMeilensteinStand';

const BUCKET_LABEL: Record<DauerBucket, string> = {
  bis60: 'bis 60 Tage',
  bis90: '61–90 Tage',
  bis120: '91–120 Tage',
  ueber120: 'über 120 Tage',
};

/** Aufsteigende Dringlichkeit; Füllung gedämpft, Text im Vollton. */
const BUCKET_TON: Record<DauerBucket, string> = {
  bis60: 'var(--tf-success-text)',
  bis90: 'var(--tf-text-secondary)',
  bis120: 'var(--tf-warning-text)',
  ueber120: 'var(--tf-danger-text)',
};

function Kachel({ titel, wert, zusatz }: {
  titel: string; wert: string; zusatz?: string;
}): React.ReactElement {
  return (
    <div className="rounded px-3 py-2 min-w-[132px]" style={feldStil}>
      <p className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">{titel}</p>
      <p className="text-[19px] font-medium tabular-nums text-[var(--tf-text)] leading-tight">{wert}</p>
      {zusatz && <p className="text-[11px] text-[var(--tf-text-secondary)]">{zusatz}</p>}
    </div>
  );
}

function DauerBalken({ a }: { a: DauerAuswertung }): React.ReactElement {
  const segmente = DAUER_BUCKETS
    .filter(b => a.buckets[b] > 0)
    .map(b => ({
      key: b,
      count: a.buckets[b],
      color: `color-mix(in srgb, ${BUCKET_TON[b]} 22%, var(--tf-bg))`,
      textColor: BUCKET_TON[b],
      legendLabel: BUCKET_LABEL[b],
      tooltip: `${BUCKET_LABEL[b]}: ${a.buckets[b]} von ${a.anzahl}`,
    }));

  if (segmente.length === 0) {
    return <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">Keine abgeschlossenen Vorgänge.</p>;
  }
  return <DistributionBar segments={segmente} height={16} />;
}

function TypZeile({ a, gesamtfristTage }: {
  a: DauerAuswertung; gesamtfristTage: number;
}): React.ReactElement {
  const abw = a.abweichungTage;
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="shrink-0 w-[42px] text-[12.5px] font-medium text-[var(--tf-text)]">
        {a.typ ? TYP_LABEL[a.typ] : 'Alle'}
      </span>
      <span className="shrink-0 w-[52px] text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)]">
        n={a.anzahl}
      </span>
      <span className="shrink-0 w-[96px] text-[12px] tabular-nums text-[var(--tf-text)]">
        {a.durchschnittTage === null ? '—' : `Ø ${a.durchschnittTage} T`}
      </span>
      <span className="shrink-0 w-[92px] text-[12px] tabular-nums text-[var(--tf-text-secondary)]">
        {a.medianTage === null ? '—' : `Median ${a.medianTage}`}
      </span>
      <span
        className="shrink-0 w-[104px] text-[12px] tabular-nums"
        style={{ color: abw === null ? 'var(--tf-text-tertiary)' : abw > 0 ? 'var(--tf-danger-text)' : 'var(--tf-success-text)' }}
        title={`Abweichung vom Soll (${gesamtfristTage} Tage)`}
      >
        {abw === null ? '—' : `${abw > 0 ? '+' : ''}${abw} T zum Soll`}
      </span>
      <span className="flex-1 min-w-[180px]">
        <DauerBalken a={a} />
      </span>
    </div>
  );
}

export function AuswertungTab({ zeilen, abschluesse, plan }: {
  zeilen: VerbundZeile[];
  abschluesse: AbschlussFall[];
  plan: MeilensteinPlan;
}): React.ReactElement {
  const dauern = useMemo(
    () => werteDauernAus(abschluesse, plan.gesamtfristTage),
    [abschluesse, plan.gesamtfristTage],
  );
  const knoten = useMemo(() => werteKnotenAus(plan, zeilen), [plan, zeilen]);
  const prognosen = useMemo(() => zaehlePrognosen(zeilen), [zeilen]);

  const g = dauern.gesamt;

  return (
    <div className="flex flex-col gap-6 pt-4 pb-2">
      <section className="flex flex-col gap-2">
        <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)]">
          Bearbeitungsdauer abgeschlossener Vorgänge
        </h3>
        <div className="flex items-stretch gap-2 flex-wrap">
          <Kachel
            titel="Ø Dauer"
            wert={g.durchschnittTage === null ? '—' : `${g.durchschnittTage} T`}
            zusatz={`Soll ${plan.gesamtfristTage} Tage`}
          />
          <Kachel titel="Median" wert={g.medianTage === null ? '—' : `${g.medianTage} T`} />
          <Kachel
            titel="Im Soll"
            wert={g.anteilImSollProzent === null ? '—' : `${g.anteilImSollProzent} %`}
            zusatz={`von ${g.anzahl} Vorgängen`}
          />
          <Kachel
            titel="Abweichung"
            wert={g.abweichungTage === null ? '—' : `${g.abweichungTage > 0 ? '+' : ''}${g.abweichungTage} T`}
            zusatz={g.abweichungTage === null ? undefined : g.abweichungTage > 0 ? 'über dem Soll' : 'unter dem Soll'}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)]">Nach Antragstyp</h3>
        <div className="flex flex-col gap-2.5">
          <TypZeile a={g} gesamtfristTage={plan.gesamtfristTage} />
          {dauern.jeTyp.map(a => (
            <TypZeile key={a.typ ?? 'alle'} a={a} gesamtfristTage={plan.gesamtfristTage} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)]">
          Offene Verbünde nach Prognose
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {PROGNOSE_REIHENFOLGE.map(p => (
            <div key={p} className="flex items-baseline gap-1.5 rounded px-2 py-1" style={feldStil}>
              <span className="text-[11px]" style={{ color: PROGNOSE_FARBE[p] }}>{PROGNOSE_LABEL[p]}</span>
              <span className="text-[12.5px] font-mono text-[var(--tf-text)]">{prognosen[p]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)]">
          Meilensteine — Soll gegen Ist (offene Verbünde)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-[12px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                <th className="text-left font-normal py-1 pr-2">Meilenstein</th>
                <th className="text-right font-normal py-1 px-2">Soll</th>
                <th className="text-right font-normal py-1 px-2">Ø Ist</th>
                <th className="text-right font-normal py-1 px-2">Δ</th>
                <th className="text-right font-normal py-1 px-2">Erreicht</th>
                <th className="text-right font-normal py-1 px-2">Gerissen</th>
                <th className="text-right font-normal py-1 pl-2">Reißquote</th>
              </tr>
            </thead>
            <tbody>
              {knoten.map(k => (
                <tr key={k.knotenId} className="border-t border-[var(--tf-border)]">
                  <td className="py-1 pr-2 text-[var(--tf-text)]">
                    <span className="font-mono text-[10.5px] text-[var(--tf-text-tertiary)] mr-1.5">{k.nummer}</span>
                    {k.label}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums text-[var(--tf-text-secondary)]">W{k.sollWoche}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-[var(--tf-text)]">
                    {k.durchschnittIstWoche === null ? '—' : `W${k.durchschnittIstWoche}`}
                  </td>
                  <td
                    className="py-1 px-2 text-right tabular-nums"
                    style={{
                      color: k.abweichungWochen === null
                        ? 'var(--tf-text-tertiary)'
                        : k.abweichungWochen > 0 ? 'var(--tf-danger-text)' : 'var(--tf-success-text)',
                    }}
                  >
                    {k.abweichungWochen === null
                      ? '—'
                      : `${k.abweichungWochen > 0 ? '+' : ''}${k.abweichungWochen} W`}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums text-[var(--tf-text-secondary)]">{k.erreicht}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-[var(--tf-text-secondary)]">{k.gerissen}</td>
                  <td
                    className="py-1 pl-2 text-right tabular-nums"
                    style={{ color: (k.reissquoteProzent ?? 0) > 25 ? 'var(--tf-danger-text)' : 'var(--tf-text-secondary)' }}
                  >
                    {k.reissquoteProzent === null ? '—' : `${k.reissquoteProzent} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[var(--tf-text-tertiary)]">
          Ø Ist und Δ beziehen sich nur auf Meilensteine, deren Erfüllungstermin aus den Daten
          ableitbar war.
        </p>
      </section>
    </div>
  );
}
