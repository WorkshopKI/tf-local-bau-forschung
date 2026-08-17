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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { isMeilensteinMonitoringEnabled, isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  getVerbund, listAntraegeByVerbund, listProgramme, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import {
  getAktiveVersion, ladeAktiveVersion, baueFeldAufloesung, sammleVorkommen,
  findeStatusCode, pruefeStillstand,
} from '@/core/status';
import { freigegebeneFassung, holeProjektion, ladePlan } from '@/core/meilensteine';
import {
  bilanzText, meilensteinAnlaesse, sortiereAnlaesse, ueberTageText, zieltagAnlass,
  type FristAnlass,
} from './fristAnlaesse';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const MAX_ZEILEN = 8;

/** Die Farbe sagt „gerissen" gegen „steht bevor" — nicht, aus welchem System. */
function farbe(a: FristAnlass): string {
  return a.gerissen ? 'var(--tf-danger-text)' : 'var(--tf-warning-text)';
}

export function FristenWidget({
  instanz, ctx, onToggleEingeklappt,
}: WidgetProps): React.ReactElement | null {
  const idb = useStorage().idb;
  const { navigate } = useNavigation();
  // Vor jedem Flag-Return (React-Hook-Regel); trägt die Schreibweise der Kürzel.
  const { mode: bearbeiterMode } = useBearbeiterSicht();
  const aktiv = !instanz.eingeklappt;
  // EIN Stichtag je Mount, in die reinen Bausteine injiziert.
  const heuteRef = useRef<string>(new Date().toISOString());

  const [laden, setLaden] = useState(false);
  const [anlaesse, setAnlaesse] = useState<FristAnlass[]>([]);
  const [unbewertet, setUnbewertet] = useState(0);

  /** verbund_id → Akronym, aus dem bereits berechneten Dashboard-Aggregat. */
  const meineVerbuende = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of ctx.data.meineAntraege) {
      if (!a.verbund_id || m.has(a.verbund_id)) continue;
      m.set(a.verbund_id, a.acronym ?? a.verbund_titel ?? a.title ?? a.verbund_id);
    }
    return m;
  }, [ctx.data.meineAntraege]);

  useEffect(() => {
    const zieltage = isVorgangssystemEnabled();
    const meilensteine = isMeilensteinMonitoringEnabled();
    if (!aktiv || (!zieltage && !meilensteine) || meineVerbuende.size === 0) {
      setAnlaesse([]);
      setUnbewertet(0);
      return;
    }
    let abgebrochen = false;
    setLaden(true);
    void (async () => {
      const gesammelt: FristAnlass[] = [];
      let ohneZiel = 0;

      // --- Stillstand (Zieltage je Status) ---
      if (zieltage) {
        try {
          const version = getAktiveVersion() ?? await ladeAktiveVersion(idb);
          const schemaCache = new Map<string, Awaited<ReturnType<typeof listSchemasByProgramm>>>();
          for (const [verbundId, akronym] of meineVerbuende) {
            const [verbund, antraege] = await Promise.all([
              getVerbund(idb, verbundId), listAntraegeByVerbund(idb, verbundId),
            ]);
            if (abgebrochen) return;
            const programmId = verbund?.programm_id ?? antraege[0]?.programm_id ?? null;
            if (!programmId) continue;
            let schemas = schemaCache.get(programmId);
            if (!schemas) {
              schemas = await listSchemasByProgramm(idb, programmId);
              schemaCache.set(programmId, schemas);
            }
            if (abgebrochen) return;
            const aufloesung = baueFeldAufloesung(schemas, version.felder);
            const vbRecord = (verbund ?? {}) as unknown as Record<string, unknown>;
            const statusRoh = typeof verbund?.status === 'string' ? verbund.status : '';
            const waechter = pruefeStillstand({
              version,
              vorkommen: sammleVorkommen(version.felder, vbRecord, antraege.map(a => ({
                aktenzeichen: a.aktenzeichen, record: a as unknown as Record<string, unknown>,
              })), aufloesung),
              statusCode: findeStatusCode(statusRoh)?.eintrag.code ?? null,
              stichtag: heuteRef.current,
            });
            if (waechter.urteil === 'unbewertet') { ohneZiel += 1; continue; }
            if (waechter.urteil !== 'haengt') continue;
            gesammelt.push(zieltagAnlass(verbundId, akronym, statusRoh, waechter));
          }
        } catch {
          // Eine Hälfte, die nicht lädt, darf die andere nicht mitnehmen.
        }
      }

      // --- Meilensteine (Sollwoche ab Eingang) ---
      if (meilensteine) {
        try {
          const geladen = await ladePlan(idb);
          const plan = freigegebeneFassung(geladen.plan);
          if (plan) {
            const programme = await listProgramme(idb);
            for (const p of programme) {
              const schemas = await listSchemasByProgramm(idb, p.id);
              const projektion = await holeProjektion(idb, p.id, plan, schemas, heuteRef.current);
              if (abgebrochen) return;
              gesammelt.push(...meilensteinAnlaesse(
                projektion.verbuende.filter(b => meineVerbuende.has(b.verbundId)),
                plan.knoten,
                id => meineVerbuende.get(id) ?? id,
                new Date(heuteRef.current).getTime(),
              ));
            }
          }
        } catch {
          // s.o.
        }
      }

      if (abgebrochen) return;
      setAnlaesse(sortiereAnlaesse(gesammelt));
      setUnbewertet(ohneZiel);
      setLaden(false);
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktiv, meineVerbuende]);

  const zieltageAn = isVorgangssystemEnabled();
  const meilensteineAn = isMeilensteinMonitoringEnabled();
  if (!zieltageAn && !meilensteineAn) return null;

  const sichtbar = anlaesse.slice(0, MAX_ZEILEN);
  const rest = anlaesse.length - sichtbar.length;
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
        <span className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]">
          {anlaesse.length > 0 ? bilanzText(anlaesse) : '0'}
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
          {sichtbar.map(z => (
            <button
              key={z.id}
              type="button"
              title={z.grund}
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
              <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]">
                {z.grund}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums" style={{ color: farbe(z) }}>
                {ueberTageText(z.ueberTage)}
              </span>
            </button>
          ))}
          {rest > 0 && (
            <p className="pt-0.5 text-[11px] text-[var(--tf-text-tertiary)]">+{rest} weitere</p>
          )}
        </div>
      )}
      {(unbewertet > 0 || nurEine) && (
        <p className="pt-1 text-[11px] text-[var(--tf-text-tertiary)]">
          {unbewertet > 0
            && `${unbewertet} nicht bewertbar — für ihren Status sind keine Zieltage gepflegt. `}
          {nurEine}
        </p>
      )}
    </WidgetShell>
  );
}
