/**
 * „Meilensteine diese Woche" (Home-Widget, Hauptbereich).
 *
 * Beantwortet die Frage, mit der der Arbeitstag beginnt: **was ist jetzt
 * dringend?** Zeigt je Zeile den überfälligen oder in den nächsten sieben Tagen
 * fälligen Meilenstein eines Verbunds, am weitesten überfällig zuerst.
 *
 * Datenbasis ist der einmal berechnete Dashboard-Aggregat (`ctx.data.meineAntraege`
 * — bereits bearbeiter-gescoped und verbund-dedupliziert) geschnitten mit der
 * Meilenstein-Projektion. Die Bewertung wird NICHT dupliziert, nur konsumiert;
 * die Schwellen („überfällig", „fällig") kommen unverändert aus der Engine.
 *
 * Read-only. Geladen wird nur, wenn das Widget ausgeklappt ist.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { isMeilensteinMonitoringEnabled } from '@/config/feature-flags';
import { listProgramme, listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import {
  freigegebeneFassung, holeProjektion, ladePlan,
  type MeilensteinKnoten, type MstZustand, type VerbundMeilensteine,
} from '@/core/meilensteine';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const MAX_ZEILEN = 5;
const MS_TAG = 86_400_000;

const FARBE: Record<'gerissen' | 'faellig', string> = {
  gerissen: 'var(--tf-danger-text)',
  faellig: 'var(--tf-warning-text)',
};

interface Faellig {
  verbundId: string;
  akronym: string;
  nummer: string;
  label: string;
  zustand: Extract<MstZustand, 'gerissen' | 'faellig'>;
  restTage: number | null;
}

/** Bewertungen + Plan-Knoten → die dringendsten Punkte. Rein. */
export function baueFaelligeZeilen(
  bewertungen: readonly VerbundMeilensteine[],
  knoten: readonly MeilensteinKnoten[],
  akronymVon: (verbundId: string) => string,
  heuteMs: number,
): Faellig[] {
  const byId = new Map(knoten.map(k => [k.id, k]));
  const out: Faellig[] = [];
  for (const b of bewertungen) {
    for (const e of b.ergebnisse) {
      if (e.zustand !== 'gerissen' && e.zustand !== 'faellig') continue;
      const k = byId.get(e.knotenId);
      if (!k) continue;
      const sollMs = e.sollDatum ? new Date(e.sollDatum).getTime() : NaN;
      out.push({
        verbundId: b.verbundId,
        akronym: akronymVon(b.verbundId),
        nummer: k.nummer,
        label: k.label,
        zustand: e.zustand,
        restTage: Number.isNaN(sollMs) ? null : Math.ceil((sollMs - heuteMs) / MS_TAG),
      });
    }
  }
  return out.sort((a, b) => {
    const ra = a.restTage ?? Number.POSITIVE_INFINITY;
    const rb = b.restTage ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return a.akronym.localeCompare(b.akronym, 'de');
  });
}

export function MeilensteineWidget({
  instanz, ctx, onToggleEingeklappt,
}: WidgetProps): React.ReactElement | null {
  const { navigate } = useNavigation();
  const idb = useStorage().idb;
  const aktiv = !instanz.eingeklappt;

  const [knoten, setKnoten] = useState<MeilensteinKnoten[]>([]);
  const [bewertungen, setBewertungen] = useState<VerbundMeilensteine[]>([]);
  const [laden, setLaden] = useState(false);

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
    if (!aktiv || !isMeilensteinMonitoringEnabled() || meineVerbuende.size === 0) {
      setBewertungen([]);
      setKnoten([]);
      return;
    }
    let abgebrochen = false;
    setLaden(true);
    void (async () => {
      try {
        const geladen = await ladePlan(idb);
        const plan = freigegebeneFassung(geladen.plan);
        if (!plan) {
          if (!abgebrochen) { setBewertungen([]); setKnoten([]); }
          return;
        }
        const jetzt = new Date().toISOString();
        const programme = await listProgramme(idb);
        const alle: VerbundMeilensteine[] = [];
        for (const p of programme) {
          const schemas = await listSchemasByProgramm(idb, p.id);
          const projektion = await holeProjektion(idb, p.id, plan, schemas, jetzt);
          alle.push(...projektion.verbuende);
        }
        if (abgebrochen) return;
        setKnoten(plan.knoten);
        setBewertungen(alle.filter(b => meineVerbuende.has(b.verbundId)));
      } catch {
        if (!abgebrochen) { setBewertungen([]); setKnoten([]); }
      } finally {
        if (!abgebrochen) setLaden(false);
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktiv, meineVerbuende]);

  const zeilen = useMemo(
    () => baueFaelligeZeilen(bewertungen, knoten, id => meineVerbuende.get(id) ?? id, Date.now()),
    [bewertungen, knoten, meineVerbuende],
  );

  if (!isMeilensteinMonitoringEnabled()) return null;

  const sichtbar = zeilen.slice(0, MAX_ZEILEN);
  const rest = zeilen.length - sichtbar.length;
  const scope = ctx.data.bearbeiterFilterActive && ctx.data.bearbeiterTokens.length > 0
    ? `Kürzel ${ctx.data.bearbeiterTokens.join(', ')}`
    : 'Alle Bearbeiter';

  return (
    <WidgetShell
      titel="Meilensteine diese Woche"
      meta={scope}
      variante={instanz.bereich === 'seite' ? 'seite' : 'haupt'}
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        <span className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]">
          {zeilen.length.toLocaleString('de-DE')} offen
        </span>
      }
    >
      {laden ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">Bewertet …</p>
      ) : zeilen.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">
          Kein Meilenstein überfällig oder diese Woche fällig.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sichtbar.map(z => (
            <button
              key={`${z.verbundId}:${z.nummer}`}
              type="button"
              onClick={() => navigate('antraege', { selectedId: z.verbundId })}
              className="flex w-full items-center gap-2 min-w-0 rounded-[10px] bg-[var(--tf-bg)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--tf-bg-secondary)] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              <span
                aria-hidden
                className="shrink-0 inline-block rounded-full"
                style={{ width: 7, height: 7, background: FARBE[z.zustand] }}
              />
              <span className="shrink-0 max-w-[38%] truncate text-[13px] font-medium text-[var(--tf-text)]">
                {z.akronym}
              </span>
              <span className="shrink-0 text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">
                {z.nummer}
              </span>
              <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]" title={z.label}>
                {z.label}
              </span>
              <span
                className="shrink-0 text-[11px] tabular-nums"
                style={{ color: FARBE[z.zustand] }}
              >
                {z.restTage === null
                  ? '—'
                  : z.restTage < 0 ? `${-z.restTage} T über` : `in ${z.restTage} T`}
              </span>
            </button>
          ))}
          {rest > 0 && (
            <p className="pt-0.5 text-[11px] text-[var(--tf-text-tertiary)]">+{rest} weitere</p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
