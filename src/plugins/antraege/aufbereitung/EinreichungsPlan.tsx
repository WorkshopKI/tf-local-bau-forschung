/**
 * Projektplan aus einer Einreichungs-JSON (MAP-Einreichung, derselben
 * Vorhabensbeschreibung zugeordnet). Die ehrliche Gegen-Quelle zur pausierten
 * PDF-Ernte: die Arbeitspakete stammen aus deklarierten Feldern, nicht aus einer
 * bei der Extraktion zerfallenen Tabelle.
 *
 * Bewusst schmaler als `ZeitplanInhalt`:
 *  - **keine** Plausibilitäts-Befunde — die stammen alle aus der PDF-Ernte und
 *    schweigen, solange die pausiert ist (`sichtbareZeitplanBefunde`).
 *  - **keine** Rohtabellen — es gibt keine geernteten Tabellen zu vergleichen.
 *  - **keine** „Nach Person"-Ansicht — die Einsatzplanung führt je Arbeitspaket
 *    mehrere Personen, die Zeilen tragen darum keine `maNr` (`map-verknuepfung.ts`).
 */
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GanttZeitplan } from './GanttZeitplan';
import { KennzahlenKarte } from './zeitplanBausteine';
import type { EinreichungsBezug } from './map-verknuepfung';

/** `YYYY-MM-DD` → `TT.MM.JJJJ`; unlesbare Werte bleiben, wie sie sind. */
function kurzDatum(iso: string | null): string | null {
  if (!iso) return null;
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return t ? `${t[3]}.${t[2]}.${t[1]}` : iso;
}

export function EinreichungsPlan({ bezug }: { bezug: EinreichungsBezug }): React.ReactElement | null {
  const plan = bezug.zeitplan;
  if (!plan) return null;
  const von = kurzDatum(plan.laufzeit.start);
  const bis = kurzDatum(plan.laufzeit.ende);
  const laufzeit = von && bis
    ? `${von} – ${bis}${plan.laufzeit.monate ? ` (${plan.laufzeit.monate} Monate)` : ''}`
    : null;

  return (
    <>
      <SectionHeader label="PROJEKTPLAN — EINREICHUNGS-JSON" />
      <p className="mt-1 mb-3 text-[12px] text-[var(--tf-text-tertiary)] leading-snug">
        Arbeitspakete aus der strukturierten Einreichung <strong>{bezug.dateiname}</strong> — nicht aus der
        PDF-Ernte, die pausiert ist. {laufzeit ? `Laufzeit laut Einreichung: ${laufzeit}.` : null}
      </p>
      <div className="flex gap-6 items-start flex-wrap">
        <div className="flex-1 min-w-[420px]">
          <GanttZeitplan
            zeilen={plan.zeilen}
            achseMax={plan.achseMax}
            abweichungsNummern={new Set<string>()}
            quelleLabel="Einreichungs-JSON"
          />
        </div>
        <KennzahlenKarte zeilen={plan.zeilen} quelleName="Einreichungs-JSON" quelleHash={null} />
      </div>
    </>
  );
}
