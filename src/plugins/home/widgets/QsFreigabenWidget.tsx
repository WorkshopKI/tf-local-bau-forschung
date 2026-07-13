/**
 * QS-Freigaben-Widget (Home, Hauptbereich — Phase 3 v1.1).
 *
 * Read-only + Navigation: listet lokale Artefakt-Entwürfe, die noch nicht
 * freigegeben sind (Entwurf ≠ Entscheidung). Das Widget gibt NIE frei — beide
 * Aktionen navigieren nur in die Artefakt-/Verbund-Oberfläche. Lazy: der IDB-
 * Bulk-Read (`entries`) läuft erst ausgeklappt.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useAntraegeStore } from '@/plugins/antraege/store';
import {
  antragMatchesBearbeiter,
  bearbeiterScopeLabel,
  parseBearbeiterFilter,
} from '@/plugins/antraege/bearbeiterFilter';
import type { AntragListItem } from '@/core/services/csv/types';
import type { WorkflowRun } from '@/plugins/antraege/gutachten/types';
import {
  baueQsFreigabenZeilen,
  zaehleProTyp,
  type QsFreigabeZeile,
  type QsRunEintrag,
  type QsScopeInfo,
} from './qsFreigaben';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const RUN_PREFIX = 'workflow-run:';
const LEGACY_PREFIX = 'gutachten-workflow:';
const DEFAULT_MAX = 4;

/** Typ-Badge über bestehende semantische Tokens (kein neues Theme-Token). */
const TYP_BADGE_KLASSE: Record<string, string> = {
  ga: 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]',
  nf: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
  abl: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
  rne: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
  precheck: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]',
};
const BADGE_FALLBACK = 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]';

export function QsFreigabenWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
  const antraege = useAntraegeStore(s => s.antraege);
  const verbundById = useAntraegeStore(s => s.verbundById);

  const maxZeilen = instanz.config.art === 'qs-freigaben' ? instanz.config.maxZeilen : DEFAULT_MAX;
  const aktiv = !instanz.eingeklappt; // Lazy: eingeklappt keinen Bulk-Read

  const [runs, setRuns] = useState<QsRunEintrag[]>([]);
  useEffect(() => {
    if (!aktiv) return;
    let cancelled = false;
    void (async () => {
      const eintraege: QsRunEintrag[] = [];
      const gesehen = new Set<string>();
      for (const [key, value] of await storage.idb.entries(RUN_PREFIX)) {
        const rest = key.slice(RUN_PREFIX.length);
        const sep = rest.indexOf(':');
        if (sep < 0) continue;
        const typ = rest.slice(0, sep);
        const scopeId = rest.slice(sep + 1);
        gesehen.add(`${typ}:${scopeId}`);
        eintraege.push({ typ, scopeId, run: value as WorkflowRun });
      }
      // Legacy-GA-Runs (noch nicht promoted) mitlesen — außer schon als workflow-run:ga vorhanden.
      for (const [key, value] of await storage.idb.entries(LEGACY_PREFIX)) {
        const scopeId = key.slice(LEGACY_PREFIX.length);
        if (gesehen.has(`ga:${scopeId}`)) continue;
        eintraege.push({ typ: 'ga', scopeId, run: value as WorkflowRun });
      }
      if (!cancelled) setRuns(eintraege);
    })();
    return () => { cancelled = true; };
  }, [aktiv, storage.idb]);

  const mode = useMemo(
    () => parseBearbeiterFilter(meinKuerzel, profile?.bearbeiter_inkl_begleitung),
    [meinKuerzel, profile?.bearbeiter_inkl_begleitung],
  );

  const scopeIndex = useMemo(() => {
    const byAz = new Map<string, AntragListItem>();
    const byVb = new Map<string, AntragListItem[]>();
    for (const a of antraege) {
      byAz.set(a.aktenzeichen, a);
      const vb = a.verbund_id?.trim();
      if (vb) { const arr = byVb.get(vb); if (arr) arr.push(a); else byVb.set(vb, [a]); }
    }
    return { byAz, byVb };
  }, [antraege]);

  const scopeInfo = useCallback((scopeId: string): QsScopeInfo => {
    const gruppe = scopeIndex.byVb.get(scopeId) ?? (scopeIndex.byAz.has(scopeId) ? [scopeIndex.byAz.get(scopeId)!] : []);
    const verbund = verbundById.get(scopeId);
    const rep = gruppe[0];
    return {
      akronym: verbund?.akronym ?? rep?.akronym,
      titel: verbund?.titel ?? rep?.titel,
      sichtbar: !mode.active || gruppe.some(a => antragMatchesBearbeiter(a, mode)),
    };
  }, [scopeIndex, verbundById, mode]);

  const zeilen = useMemo(
    () => (aktiv ? baueQsFreigabenZeilen(runs, scopeInfo, Date.now()) : []),
    [aktiv, runs, scopeInfo],
  );
  const sichtbar = zeilen.slice(0, maxZeilen);
  const rest = zeilen.length - sichtbar.length;
  const typPills = useMemo(() => zaehleProTyp(zeilen), [zeilen]);

  const openArtefakt = (scopeId: string): void => navigate('antraege', { selectedId: scopeId });

  return (
    <WidgetShell
      titel="QS-Freigaben offen"
      meta={`Entwurf ≠ Entscheidung · ${bearbeiterScopeLabel(mode)}`}
      variante="haupt"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        typPills.length > 0 ? (
          <span className="flex items-center gap-1.5">
            {typPills.map(p => (
              <span key={p.typ} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-semibold tabular-nums ${TYP_BADGE_KLASSE[p.typ] ?? BADGE_FALLBACK}`}>
                {p.badge} {p.count}
              </span>
            ))}
          </span>
        ) : undefined
      }
    >
      {zeilen.length === 0 ? (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-1">
          Keine offenen Entwürfe — alle Artefakte sind freigegeben.
        </p>
      ) : (
        <div className="flex flex-col">
          {sichtbar.map((z, i) => (
            <QsZeile key={z.key} zeile={z} onOpen={() => openArtefakt(z.scopeId)} last={i === sichtbar.length - 1 && rest <= 0} />
          ))}
          {rest > 0 ? (
            <button
              type="button"
              onClick={() => navigate('antraege')}
              className="mt-2 self-start text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              + {rest} weitere →
            </button>
          ) : null}
        </div>
      )}
    </WidgetShell>
  );
}

function QsZeile({ zeile, onOpen, last }: { zeile: QsFreigabeZeile; onOpen: () => void; last: boolean }): React.ReactElement {
  const regelText = zeile.regelnGruen
    ? 'alle Regeln grün'
    : `${zeile.offeneRegeln} ${zeile.offeneRegeln === 1 ? 'Regel offen' : 'Regeln offen'}`;
  const meta = [
    zeile.alterTage !== null ? `Entwurf seit ${zeile.alterTage} T` : null,
    zeile.pflichtfreigabe ? 'Pflichtfreigabe' : null,
  ].filter(Boolean).join(' · ');
  return (
    <div
      className="flex items-center gap-3 py-2"
      style={last ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-[6px] text-[10.5px] font-semibold ${TYP_BADGE_KLASSE[zeile.typ] ?? BADGE_FALLBACK}`}>
        {zeile.typBadge}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[var(--tf-text)] truncate">
          {zeile.titel} · {zeile.untertitel}
        </span>
        <span className="block text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)] truncate">
          {meta}{meta ? ' · ' : ''}
          <span className={zeile.regelnGruen ? 'text-[var(--tf-success-text)]' : 'text-[var(--tf-danger-text)]'}>{regelText}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-[var(--tf-radius)] px-2.5 py-1 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)] cursor-pointer"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {zeile.regelnGruen ? 'Freigeben →' : 'Prüfen →'}
      </button>
    </div>
  );
}
