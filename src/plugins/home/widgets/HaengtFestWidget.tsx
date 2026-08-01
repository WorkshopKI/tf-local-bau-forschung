/**
 * „Hängt fest" (Home-Widget) — der Stillstands-Wächter auf der Startseite.
 *
 * Beantwortet die zweite Frage des Arbeitstags: **was liegt zu lange still?**
 * Nicht „was ist fällig" (das machen die Meilensteine), sondern „wo ist seit
 * Zieltagen nichts mehr passiert".
 *
 * Zwei Dinge sind Absicht:
 *
 * - **Es zeigt nur die eigenen Vorgänge**, gescoped über den bereits berechneten
 *   Dashboard-Aggregat (`ctx.data.meineAntraege`) — kein zweiter Bearbeiter-Filter.
 * - **`unbewertet` wird gezählt, nicht gezeigt.** Vorgänge, für deren Status
 *   niemand Zieltage gepflegt hat, sind kein Alarm; sie verschwiegen wäre aber
 *   auch falsch, denn sie sagen, wie belastbar die Zahl daneben ist.
 *
 * Geladen wird nur, wenn das Widget ausgeklappt ist.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  getVerbund, listAntraegeByVerbund, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import {
  getAktiveVersion, ladeAktiveVersion, baueFeldAufloesung, sammleVorkommen,
  findeStatusCode, pruefeStillstand, ROLLE_LABEL,
  type WaechterErgebnis,
} from '@/core/status';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const MAX_ZEILEN = 10;

interface Zeile {
  verbundId: string;
  akronym: string;
  statusRoh: string;
  waechter: WaechterErgebnis;
}

/** Wessen Schreibtisch — als kurzes Wort für die Zeile. */
function rolleText(w: WaechterErgebnis): string {
  if (w.rolle === null) return '';
  return w.rolle === 'ast' ? 'ASt' : ROLLE_LABEL[w.rolle];
}

export function HaengtFestWidget({ instanz, ctx, onToggleEingeklappt }: WidgetProps): React.ReactElement | null {
  const idb = useStorage().idb;
  const { navigate } = useNavigation();
  const aktiv = !instanz.eingeklappt;
  // EIN Stichtag je Mount, in die reine Engine injiziert.
  const heuteRef = useRef<string>(new Date().toISOString());

  const [laden, setLaden] = useState(false);
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [unbewertet, setUnbewertet] = useState(0);

  /** Die eigenen Verbünde aus dem geteilten Aggregat — kein zweiter Filter. */
  const meineVerbuende = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of ctx.data.meineAntraege) {
      if (!a.verbund_id || m.has(a.verbund_id)) continue;
      m.set(a.verbund_id, a.acronym ?? a.verbund_titel ?? a.title ?? a.verbund_id);
    }
    return m;
  }, [ctx.data.meineAntraege]);

  useEffect(() => {
    if (!aktiv || !isVorgangssystemEnabled() || meineVerbuende.size === 0) {
      setZeilen([]);
      setUnbewertet(0);
      return;
    }
    let abgebrochen = false;
    setLaden(true);
    void (async () => {
      try {
        const version = getAktiveVersion() ?? await ladeAktiveVersion(idb);
        const schemaCache = new Map<string, Awaited<ReturnType<typeof listSchemasByProgramm>>>();
        const treffer: Zeile[] = [];
        let ohneZiel = 0;

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
          treffer.push({ verbundId, akronym, statusRoh, waechter });
        }

        if (abgebrochen) return;
        treffer.sort((a, b) => (b.waechter.tage ?? 0) - (a.waechter.tage ?? 0));
        setZeilen(treffer);
        setUnbewertet(ohneZiel);
      } catch {
        if (!abgebrochen) { setZeilen([]); setUnbewertet(0); }
      } finally {
        if (!abgebrochen) setLaden(false);
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktiv, meineVerbuende]);

  if (!isVorgangssystemEnabled()) return null;

  const sichtbar = zeilen.slice(0, MAX_ZEILEN);
  const rest = zeilen.length - sichtbar.length;
  const scope = ctx.data.bearbeiterFilterActive && ctx.data.bearbeiterTokens.length > 0
    ? `Kürzel ${ctx.data.bearbeiterTokens.join(', ')}`
    : 'Alle Bearbeiter';

  return (
    <WidgetShell
      titel="Hängt fest"
      meta={scope}
      variante={instanz.bereich === 'seite' ? 'seite' : 'haupt'}
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        <span className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]">
          {zeilen.length.toLocaleString('de-DE')}
        </span>
      }
    >
      {laden ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">Bewertet …</p>
      ) : zeilen.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">
          Kein Vorgang über seinen Zieltagen.
          {unbewertet > 0 && ` (${unbewertet} nicht bewertbar — für ihren Status sind keine Zieltage gepflegt.)`}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sichtbar.map(z => (
            <button
              key={z.verbundId}
              type="button"
              title={z.waechter.grund}
              onClick={() => navigate('antraege', { selectedId: z.verbundId })}
              className="flex w-full items-center gap-2 min-w-0 rounded-[10px] bg-[var(--tf-bg)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--tf-bg-secondary)] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              <span
                aria-hidden
                className="shrink-0 inline-block rounded-full"
                style={{ width: 7, height: 7, background: 'var(--tf-warning-text)' }}
              />
              <span className="shrink-0 max-w-[38%] truncate text-[13px] font-medium text-[var(--tf-text)]">
                {z.akronym}
              </span>
              <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]">
                {z.waechter.paar
                  ? `${z.waechter.paar.gesetzt} gesetzt, ${z.waechter.paar.fehlt} fehlt`
                  : z.statusRoh}
              </span>
              {rolleText(z.waechter) && (
                <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">
                  {rolleText(z.waechter)}
                </span>
              )}
              <span
                className="shrink-0 text-[11px] tabular-nums"
                style={{ color: 'var(--tf-warning-text)' }}
              >
                {z.waechter.tage} T
              </span>
            </button>
          ))}
          {rest > 0 && (
            <p className="pt-0.5 text-[11px] text-[var(--tf-text-tertiary)]">+{rest} weitere</p>
          )}
          {unbewertet > 0 && (
            <p className="pt-0.5 text-[11px] text-[var(--tf-text-tertiary)]">
              {unbewertet} nicht bewertbar — für ihren Status sind keine Zieltage gepflegt.
            </p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
