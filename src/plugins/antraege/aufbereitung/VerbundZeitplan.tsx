/**
 * Verbund-Rendering des Zeitplan-Tabs: schlanke Verbund-Summenzeile + je TV eine
 * Sektion. Hat ein TV eine Anlage 5 → Gantt/Person + Kennzahlen + Kapazitäts-Hinweise;
 * fehlt sie → Platzhalter mit direkter Drop-Zone (Anlage 5 nachreichen). Präsentational
 * über die vom Run gelieferten `TvPlan[]` — keine eigene IO.
 */
import { useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { DokumentAufnahme } from '@/core/components/DokumentAufnahme';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { GanttZeitplan } from './GanttZeitplan';
import { PersonenZeitplan } from './PersonenZeitplan';
import { KennzahlenKarte, BefundZeile } from './zeitplanBausteine';
import { AUFBEREITUNG_TYP_OPTIONEN } from './QuellenPanel';
import { verbundZeitplanSummary, befundKey } from './store';
import type { AufbereitungRun, TvPlan } from './types';
import type { Befund } from './tabellen';

interface Props {
  run: AufbereitungRun;
  teilplaene: TvPlan[];
  toggle: UseAsyncActionResult<[string]>;
  ctx: { key: string; knownIds: string[] };
  onIngested: () => void;
}

export function VerbundZeitplan({ run, teilplaene, toggle, ctx, onIngested }: Props): React.ReactElement {
  const s = verbundZeitplanSummary(teilplaene);
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-xl px-4 py-3 text-[13px]"
        style={{ border: '0.5px solid var(--tf-border)' }}>
        <SummenWert label="Teilvorhaben" value={`${s.tvMitAnlage} / ${s.tvGesamt} mit Anlage 5`} />
        <SummenWert label="Gesamt-PM (Verbund)" value={s.summePm > 0 ? String(s.summePm) : '–'} />
        <SummenWert label="Eingesetzte MA" value={s.maAnzahl > 0 ? String(s.maAnzahl) : '–'} />
        <SummenWert label="Längster Horizont" value={s.horizont > 0 ? `M${s.horizont}` : '–'} />
      </div>

      {teilplaene.map(tp => (
        <TvZeitplanSektion
          key={tp.tvAz}
          tp={tp}
          befunde={run.befunde.filter(b => b.tvAz === tp.tvAz)}
          offenePunkte={run.offenePunkte}
          toggle={toggle}
          ctx={ctx}
          onIngested={onIngested}
        />
      ))}

      {run.anlagenOhneTv?.length ? (
        <div className="mt-4 text-[12px] text-[var(--tf-warning-text)]">
          ⚠ {run.anlagenOhneTv.length} Anlage-5-Dokument(e) ohne erkennbares TV-Förderkennzeichen im Dateinamen —
          keinem Teilvorhaben zugeordnet: {run.anlagenOhneTv.join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function SummenWert({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <div className="text-[11px] text-[var(--tf-text-tertiary)]">{label}</div>
      <div className="text-[13px] text-[var(--tf-text)]">{value}</div>
    </div>
  );
}

function TvZeitplanSektion({
  tp, befunde, offenePunkte, toggle, ctx, onIngested,
}: {
  tp: TvPlan;
  befunde: Befund[];
  offenePunkte: string[];
  toggle: UseAsyncActionResult<[string]>;
  ctx: { key: string; knownIds: string[] };
  onIngested: () => void;
}): React.ReactElement {
  const [ansicht, setAnsicht] = useState<'ap' | 'person'>('ap');
  const titel = `TV ${tp.nr} — ${tp.tvAkronym ?? tp.tvAz}${tp.tvAkronym ? ` · ${tp.tvAz}` : ''}`;

  return (
    <section className="mt-8 first:mt-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionHeader label={titel} />
        {tp.zeitplan ? (
          <ScopeTabs
            variant="pills"
            items={[
              { key: 'ap', label: 'Nach AP' },
              { key: 'person', label: 'Nach Person' },
            ]}
            activeKey={ansicht}
            onChange={(k) => setAnsicht(k === 'person' ? 'person' : 'ap')}
            aria-label="Zeitplan-Ansicht"
          />
        ) : null}
      </div>

      {tp.zeitplan ? (
        <>
          <div className="flex gap-6 items-start flex-wrap">
            <div className="flex-1 min-w-[420px]">
              {ansicht === 'person' ? (
                <PersonenZeitplan zeilen={tp.zeitplan.zeilen} achseMax={tp.zeitplan.achseMax} quelleLabel="Anlage 5" />
              ) : (
                <GanttZeitplan zeilen={tp.zeitplan.zeilen} achseMax={tp.zeitplan.achseMax}
                  abweichungsNummern={new Set()} quelleLabel="Anlage 5" />
              )}
            </div>
            <KennzahlenKarte zeilen={tp.zeitplan.zeilen} quelleName="Anlage 5" quelleHash={tp.anlage?.hash ?? null} />
          </div>
          {befunde.length ? (
            <div className="mt-4">
              {befunde.map((b, i) => (
                <BefundZeile key={i} befund={b} offen={offenePunkte.includes(befundKey(b))} toggle={toggle} />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-2 rounded-[10px] px-4 py-4" style={{ border: '0.5px dashed var(--tf-border)' }}>
          {tp.anlage ? (
            // Dokument IST hinterlegt, aber die Tabelle war nicht auslesbar (typisch für
            // PDF-Tabellen, die zu Flattext zerfallen) — NICHT als „fehlt" darstellen.
            <p className="text-[13px] text-[var(--tf-warning-text)] mb-2">
              ⚠ Anlage 5 „{tp.anlage.name}" ist hinterlegt, aber die Tabelle konnte nicht ausgelesen werden
              (häufig bei PDF-Tabellen, die als Flattext extrahiert werden). Bitte als <strong>DOCX</strong> neu
              hochladen oder in „Dokumente zum Vorhaben" die Konvertierung prüfen.
            </p>
          ) : (
            <p className="text-[13px] text-[var(--tf-warning-text)] mb-2">
              ⚠ Anlage 5 (Arbeitsplan) für dieses Teilvorhaben fehlt — ohne sie kein Zeitplan / keine Kapazitätsprüfung.
            </p>
          )}
          <p className="text-[12.5px] text-[var(--tf-text-secondary)] mb-2">
            Datei hier ablegen — das Förderkennzeichen wird aus dem Dateinamen erkannt.
          </p>
          <DokumentAufnahme
            relationTag={ctx.key}
            knownIds={ctx.knownIds}
            defaultTyp="arbeitsplan"
            typOptionen={AUFBEREITUNG_TYP_OPTIONEN}
            onIngested={onIngested}
          />
        </div>
      )}
    </section>
  );
}
