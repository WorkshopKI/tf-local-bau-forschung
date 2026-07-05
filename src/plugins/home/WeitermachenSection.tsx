import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useStorage } from '@/core/hooks/useStorage';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { getWorkflowRun } from '@/plugins/antraege/gutachten/workflow-store';
import {
  listeArbeitskontext, type ArbeitskontextEintrag,
} from '@/core/services/personal-storage/arbeitskontext-log';
import {
  beschreibeArbeitskontext, relativeZeit, type ArbeitskontextAnzeige,
} from './arbeitskontext-anzeige';

const LIMIT = 3;

interface WeitermachenRow {
  key: string;
  anzeige: ArbeitskontextAnzeige;
  /** Voller Router-Pfad inkl. Deep-Link-Query (`?ziel=…&abschnitt=…`). */
  target: string;
}

/**
 * Baut das Deep-Link-Ziel: echter Verbund → Verbund-Route, sonst (Solo-/Pseudo-
 * Antrag) die Antrags-Route (die daraus einen Pseudo-Verbund rendert). `ziel`
 * scrollt die Detailseite zum Abschnitt, `abschnitt` springt (nur GA) den Schritt.
 */
function buildTarget(eintrag: ArbeitskontextEintrag, istEchterVerbund: boolean): string {
  const base = istEchterVerbund
    ? `/antraege/verbund/${encodeURIComponent(eintrag.verbundKey)}`
    : `/antraege/${encodeURIComponent(eintrag.verbundKey)}`;
  const params = new URLSearchParams();
  params.set('ziel', eintrag.typ === 'nachforderung' ? 'nf' : 'gutachten');
  if (eintrag.typ === 'gutachten' && eintrag.abschnittId) {
    params.set('abschnitt', eintrag.abschnittId);
  }
  return `${base}?${params.toString()}`;
}

/**
 * „Weitermachen"-Karte (Home, oberste Section): die drei jüngsten Arbeitskontexte
 * (Gutachten/Nachforderungen/Kurzfassung) mit Deep-Link zurück in die Werkstatt.
 * Quelle ist das REIN LOKALE Arbeitskontext-Log (IDB, nie auf dem Share) —
 * siehe arbeitskontext-log.ts. Leer ⇒ rendert nichts.
 */
export function WeitermachenSection(): React.ReactElement | null {
  const storage = useStorage();
  const antraege = useAntraegeStore(s => s.antraege);
  const verbundById = useAntraegeStore(s => s.verbundById);
  const [rows, setRows] = useState<WeitermachenRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const eintraege = await listeArbeitskontext(storage.idb, LIMIT).catch(() => []);
      if (cancelled || eintraege.length === 0) { if (!cancelled) setRows([]); return; }
      const out: WeitermachenRow[] = [];
      for (const e of eintraege) {
        const verbund = verbundById.get(e.verbundKey);
        const antrag = verbund ? null : antraege.find(a => a.aktenzeichen === e.verbundKey);
        const info = verbund
          ? { akronym: verbund.akronym ?? null, titel: verbund.titel ?? null }
          : antrag
            ? { akronym: antrag.akronym ?? null, titel: antrag.titel ?? null }
            : null;
        // Live-Status des Gutachten-Abschnitts aus dem Workflow-Store (nie der
        // geloggte Status). Nur für GA-Einträge mit Abschnitt relevant.
        let abschnittStatus: string | undefined;
        if (e.typ === 'gutachten' && e.abschnittId && info) {
          const run = await getWorkflowRun(storage.idb, e.verbundKey, 'ga').catch(() => null);
          abschnittStatus = run?.schritte[e.abschnittId]?.status;
        }
        const anzeige = beschreibeArbeitskontext(e, info, abschnittStatus);
        if (!anzeige) continue; // Antrag/Verbund nicht mehr gefunden → überspringen
        out.push({ key: `${e.typ}:${e.verbundKey}`, anzeige, target: buildTarget(e, !!verbund) });
      }
      if (!cancelled) setRows(out);
    })();
    return () => { cancelled = true; };
  }, [storage.idb, antraege, verbundById]);

  if (rows.length === 0) return null;

  return (
    <div className="mb-6">
      <SectionHeader label="Weitermachen" />
      <div
        className="rounded-[var(--tf-radius)] overflow-hidden"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {rows.map((row, i) => (
          <WeitermachenRowView key={row.key} row={row} last={i === rows.length - 1} />
        ))}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
        <Lock size={11} className="shrink-0" />
        <span>
          Verlauf nur lokal auf diesem Gerät ·{' '}
          <Link to="/einstellungen" className="underline hover:no-underline">verwalten</Link>
        </span>
      </p>
    </div>
  );
}

function WeitermachenRowView({ row, last }: { row: WeitermachenRow; last: boolean }): React.ReactElement {
  const navigate = useNavigate();
  const { anzeige } = row;
  const line1 = `${anzeige.akronym} — ${anzeige.kontext}`;
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--tf-bg-secondary)] transition-colors"
      style={last ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <button
        type="button"
        onClick={() => navigate(row.target)}
        className="flex-1 min-w-0 text-left cursor-pointer"
      >
        <div className="text-[13px] truncate" title={line1}>
          <span className="font-medium text-[var(--tf-text)]">{anzeige.akronym}</span>
          <span className="text-[var(--tf-text-secondary)]"> — {anzeige.kontext}</span>
        </div>
        <div className="mt-0.5 text-[11.5px] text-[var(--tf-text-tertiary)] tabular-nums truncate">
          {relativeZeit(anzeige.ts)} · <span className="font-mono">{anzeige.fkz}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => navigate(row.target)}
        className="shrink-0 inline-flex items-center gap-1 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        Weiter <ArrowRight size={13} />
      </button>
    </div>
  );
}
