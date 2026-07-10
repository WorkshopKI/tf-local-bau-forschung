/**
 * Fragen-Tab (Paket 4). Aggregiert alle offenen Punkte des Runs zu Prüffragen,
 * gruppiert nach Prüfaspekt (einklappbar, Zähler offen/gesamt), erledigte Einträge
 * dezent. „Erledigt" läuft über die eigene `erledigtePunkte`-Achse (überlebt „Neu
 * aufbereiten"). Export als Markdown in die Zwischenablage — keine NF-Anbindung.
 * Monochrom, Farbe nur über StatusDot.
 */
import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/StatusBadge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { FundstelleChip } from './FundstelleChip';
import { sammleFragen, formatFragenMarkdown, metaStatusText, type FrageEintrag } from './fragen';
import type { BausteinUiState } from './useAufbereitung';
import type { AufbereitungRun } from './types';
import type { AspektMapping } from './aspekte';
import type { ZahlenDaten } from './zahlen';
import type { VbSektion } from './gliederung';

const WARN = 'var(--tf-warning-text)';
const OK = 'var(--tf-success-text)';

interface Props {
  run: AufbereitungRun | null;
  aspekte: BausteinUiState<AspektMapping>;
  zahlen: BausteinUiState<ZahlenDaten>;
  vbMarkdown: string | null;
  toggleErledigt: UseAsyncActionResult<[string]>;
  bausteine: UseAsyncActionResult<[]>;
}

export function FragenTab({ run, aspekte, zahlen, vbMarkdown, toggleErledigt, bausteine }: Props): React.ReactElement {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const modell = useMemo(
    () => (run ? sammleFragen({
      run,
      mapping: aspekte.daten ?? null,
      zahlen: zahlen.daten ?? null,
      status: { aspekte: aspekte.status, zahlen: zahlen.status },
    }) : null),
    [run, aspekte.daten, aspekte.status, zahlen.daten, zahlen.status],
  );
  const erledigt = useMemo(() => new Set(run?.erledigtePunkte ?? []), [run?.erledigtePunkte]);
  const byId = useMemo(() => new Map((run?.gliederung ?? []).map(s => [s.id, s])), [run?.gliederung]);
  const chips = (ids: string[]): React.ReactElement[] =>
    ids.map(id => byId.get(id)).filter((s): s is VbSektion => !!s).map(s => <FundstelleChip key={s.id} sektion={s} vbMarkdown={vbMarkdown} />);

  const kopieren = useAsyncAction(async () => {
    if (modell) await navigator.clipboard.writeText(formatFragenMarkdown(modell, erledigt));
  });

  if (!run || !modell) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        <div className="text-[15px] font-medium text-[var(--tf-text)]">Fragen noch nicht verfügbar</div>
        <div className="max-w-[440px] text-[13px] text-[var(--tf-text-tertiary)]">
          Der Fragen-Tab bündelt alle offenen Punkte — Zeitplan-/Kapazitäts-Befunde sowie fehlende
          Aspekte, Risiken und Zahlen-Widersprüche aus den KI-Bausteinen.
        </div>
        <Button variant="primary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()} className="mt-1">
          {bausteine.busy ? 'KI-Aufbereitung läuft …' : 'KI-Aufbereitung starten'}
        </Button>
      </div>
    );
  }

  const offenGesamt = modell.gruppen.reduce((n, g) => n + g.eintraege.filter(e => !erledigt.has(e.key)).length, 0);
  const bausteineFehlen = modell.meta.some(m => m.status === 'fehlt' || m.status === 'fehler');

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf: Zähler + Export */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] text-[var(--tf-text-secondary)]">
          {offenGesamt} von {modell.gesamt} {modell.gesamt === 1 ? 'Punkt' : 'Punkten'} offen
        </div>
        {modell.gesamt > 0 ? (
          <button
            type="button"
            onClick={() => kopieren.run()}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--tf-primary)] hover:underline"
          >
            <Copy size={12} /> {kopieren.error ? 'Fehler' : 'Als Markdown kopieren'}
          </button>
        ) : null}
      </div>

      {/* Meta: unvollständige Aggregation */}
      {modell.meta.length > 0 ? (
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ border: '0.5px solid var(--tf-warning-border)', background: 'var(--tf-warning-soft)' }}>
          <div className="text-[var(--tf-warning-text)]">Aggregation unvollständig — nicht alle Bausteine sind gelaufen:</div>
          <ul className="mt-1 text-[var(--tf-text-secondary)]">
            {modell.meta.map(m => <li key={m.baustein}>· {m.baustein} {metaStatusText(m.status)}.</li>)}
          </ul>
          {bausteineFehlen ? (
            <Button variant="secondary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()} className="mt-2">
              KI-Aufbereitung starten
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Leerzustände: ehrlich unterschieden */}
      {modell.gesamt === 0 ? (
        modell.meta.length > 0 ? (
          <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
            Noch keine Fragen — die KI-Bausteine sind nicht (vollständig) gelaufen.
          </div>
        ) : (
          <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
            Keine offenen Punkte — alle Bausteine gelaufen, nichts gefunden.
          </div>
        )
      ) : (
        modell.gruppen.map(g => {
          const gkey = g.aspektId ?? 'allgemein';
          const zu = collapsed.has(gkey);
          const offen = g.eintraege.filter(e => !erledigt.has(e.key)).length;
          return (
            <div key={gkey}>
              <SectionHeader
                label={`${g.label} · ${offen}/${g.eintraege.length} offen`}
                collapsible
                collapsed={zu}
                onToggleCollapsed={() => setCollapsed(s => {
                  const n = new Set(s);
                  if (n.has(gkey)) n.delete(gkey); else n.add(gkey);
                  return n;
                })}
              />
              {!zu ? g.eintraege.map(e => (
                <FrageZeile
                  key={e.key}
                  eintrag={e}
                  erledigt={erledigt.has(e.key)}
                  busy={toggleErledigt.busy}
                  onToggle={() => toggleErledigt.run(e.key)}
                  chips={chips}
                />
              )) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

function FrageZeile({
  eintrag, erledigt, busy, onToggle, chips,
}: {
  eintrag: FrageEintrag;
  erledigt: boolean;
  busy: boolean;
  onToggle: () => void;
  chips: (ids: string[]) => React.ReactElement[];
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <StatusDot color={erledigt ? OK : WARN} size={7} className="mt-1.5" title={erledigt ? 'erledigt' : 'offen'} />
      <div className="min-w-0 flex-1">
        <div className={`text-[13px] leading-snug ${erledigt ? 'text-[var(--tf-text-tertiary)] line-through' : 'text-[var(--tf-text)]'}`}>
          {eintrag.frage} <span className="align-middle">{chips(eintrag.sektionIds)}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--tf-text-tertiary)]">{eintrag.quelle}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="shrink-0 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-50"
      >
        {erledigt ? '✓ Erledigt' : 'Als erledigt markieren'}
      </button>
    </div>
  );
}
