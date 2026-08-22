/**
 * TEILVORHABEN-Liste der Verbund-Detailseite (aus `VerbundDetail` herausgelöst,
 * Journey-Paket 2 Phase 7). Expandable Rows mit Inline-`TvDetailBlock`; Rolle
 * (Konsortialführer/Verbundpartner) per Netzwerk-Heuristik. Reiner Präsentations-
 * baustein — der offene TV + die Toggles kommen vom Aufrufer.
 *
 * Die Zeile ist bewusst KEIN `<button>`, sondern das im Repo etablierte
 * `role="button"`-Div (vgl. `plugins/anfragen/AnfrageListe.tsx`): in einem
 * Button liesse sich der TV-Titel nicht mit der Maus markieren, und der
 * Kopier-Button daneben waere ein verschachteltes `<button>`.
 */
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import { getStatusVariant } from '@/core/utils/status-mappings';
import { statusKurzLabel, statusLabel } from '@/core/utils/status-wert-labels';
import { AntragstellerProfilHover } from './AntragstellerProfilHover';
import { isNetzwerkLead } from './netzwerk';
import { TvDetailBlock } from './TvDetailBlock';
import { TvTitelCopyButton } from './TvTitelCopyButton';

/**
 * Zuwendung des Teilvorhabens als Kurztext — oder `null`, wenn die Zeile dazu
 * nichts sagen kann.
 *
 * Bis v4.122 stand hier ein fester Platzhalter „wird noch ergänzt" mit der
 * Begründung, die Spalten folgten später. Sie sind längst da: `ZUW_MU_FST` ist
 * kanonisch auf `foerdersumme` gemappt (auf 14 225 von 14 225 Records, davon
 * 9 092 ungleich 0), `FST_AZX_GK` auf das Custom-Feld „Zuwendung Bewilligung".
 *
 * Die drei Zustände werden getrennt benannt: bewilligter Betrag · „noch nicht
 * bewilligt" (Betrag steht auf 0 — das ist eine Aussage, kein fehlender Wert) ·
 * gar keine Angabe (dann fällt das Segment weg, statt Leere zu behaupten).
 */
function zuwendungText(tv: Antrag): string | null {
  const roh = (tv as unknown as Record<string, unknown>)['Zuwendung Bewilligung'] ?? tv.foerdersumme;
  const n = typeof roh === 'number' ? roh : typeof roh === 'string' ? Number(roh.replace(/[^0-9,.-]/g, '').replace(',', '.')) : NaN;
  if (!Number.isFinite(n)) return null;
  return n === 0 ? 'noch nicht bewilligt' : `${Math.round(n).toLocaleString('de-DE')} €`;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** Normalisiert für den Duplikat-Vergleich Titel↔Antragsteller (Whitespace/Case). */
function sameText(a: string, b: string): boolean {
  const n = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return n(a) === n(b);
}

/** Läuft gerade eine Text-Markierung? Dann darf der Maus-Klick, mit dem die
 *  Markierung endet, die Zeile NICHT auf-/zuklappen (sonst ist der Titel
 *  praktisch nicht markierbar). */
function hatTextMarkierung(): boolean {
  try {
    return (window.getSelection()?.toString() ?? '').trim().length > 0;
  } catch {
    return false;
  }
}

/** TV-Rolle für die Anzeige. Heuristik: Netzwerk-Lead (Suffix 01/02 + vb_phase
 *  1/2) oder — ohne expliziten Lead — der erste TV → Konsortialführer; sonst
 *  Verbundpartner. */
function tvRolle(tv: Antrag, idx: number, sorted: Antrag[]): string {
  if (isNetzwerkLead(tv)) return 'Konsortialführer';
  const anyLead = sorted.some(t => isNetzwerkLead(t));
  if (!anyLead && idx === 0) return 'Konsortialführer';
  return 'Verbundpartner';
}

interface Props {
  tvs: Antrag[];
  /** Verbund-Titel (Kopfzeile). TV-Titel, die ihn nur wiederholen, werden
   *  in der Zeile unterdrückt. */
  verbundTitel: string | null;
  /** In-Memory-Slim-Liste des Programms — Quelle des Antragsteller-Kurzprofils.
   *  Kommt vom Aufrufer, damit dieser Baustein reine Präsentation bleibt. */
  alleAntraege: readonly AntragListItem[];
  /** Verbund-ID des geöffneten Verbundes (markiert Geschwister im Kurzprofil). */
  verbundId: string | null;
  expandedTvAz: string | null;
  onToggle: (aktenzeichen: string) => void;
  onOpenAntrag: (aktenzeichen: string) => void;
}

export function TeilvorhabenListe({ tvs, verbundTitel, alleAntraege, verbundId, expandedTvAz, onToggle, onOpenAntrag }: Props): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {tvs.map((tv, idx) => {
        const tvAntragsteller = strOrNull(tv.antragsteller) ?? '—';
        // TV-Titel = was dieser Partner im Verbund macht. Prominent unter dem
        // Antragsteller; unterdrückt, wenn er (normalisiert) nur den Antragsteller-
        // Namen oder den bereits im Kopf stehenden Verbund-Titel wiederholt.
        const tvTitelRaw = strOrNull(tv.titel);
        const tvTitel =
          tvTitelRaw &&
          !sameText(tvTitelRaw, tvAntragsteller) &&
          (!verbundTitel || !sameText(tvTitelRaw, verbundTitel))
            ? tvTitelRaw
            : null;
        const tvStatus = strOrNull(tv.status);
        const rolle = tvRolle(tv, idx, tvs);
        const zuwendung = zuwendungText(tv);
        const isExpanded = expandedTvAz === tv.aktenzeichen;
        return (
          <div key={tv.aktenzeichen}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => { if (!hatTextMarkierung()) onToggle(tv.aktenzeichen); }}
              onKeyDown={e => {
                // Nur die Zeile selbst — sonst würde Space auf dem fokussierten
                // Kopier-Button zusätzlich auf-/zuklappen.
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(tv.aktenzeichen); }
              }}
              aria-expanded={isExpanded}
              className={`group w-full text-left rounded-[var(--tf-radius)] px-3 py-2 transition-colors cursor-pointer ${
                isExpanded ? 'bg-[var(--tf-primary)]/5' : 'hover:bg-[var(--tf-bg-secondary)]'
              }`}
              style={{
                border: '0.5px solid var(--tf-border)',
                borderLeftWidth: isExpanded ? '2px' : '0.5px',
                borderLeftColor: isExpanded ? 'var(--tf-primary)' : 'var(--tf-border)',
              }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] tabular-nums w-8 pt-0.5">
                  TV {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {/* KEIN `title` mehr am Namen: neben einem HoverCard-Trigger
                      stünden sonst zwei Blasen übereinander. Den vollen Namen
                      trägt jetzt der Kopf der Karte. Die gepunktete Linie
                      erscheint erst beim Überfahren der Zeile — dieselbe Regel
                      wie beim ⓘ der Statuszellen: sichtbar, wenn man hinsieht,
                      still im Ruhezustand. */}
                  <AntragstellerProfilHover
                    tv={tv}
                    name={tvAntragsteller}
                    alleAntraege={alleAntraege}
                    verbundId={verbundId}
                    onOpenAntrag={onOpenAntrag}
                  >
                    <div
                      tabIndex={0}
                      className="text-[13px] font-medium text-[var(--tf-text)] truncate cursor-help underline decoration-dotted decoration-transparent group-hover:decoration-[var(--tf-text-tertiary)] underline-offset-2 focus-visible:decoration-[var(--tf-text-tertiary)] outline-none"
                    >
                      {tvAntragsteller}
                    </div>
                  </AntragstellerProfilHover>
                  {tvTitel ? (
                    // Titel: markierbar (Zeile ist kein Button) + Kopier-Icon
                    // bei Hover/Fokus — kopiert den VOLLEN Titel, auch den von
                    // `line-clamp-2` abgeschnittenen Teil.
                    <div className="flex items-start gap-1 mt-0.5">
                      <span
                        className="min-w-0 text-[12.5px] text-[var(--tf-text-secondary)] leading-snug line-clamp-2"
                        title={tvTitel}
                      >
                        {tvTitel}
                      </span>
                      <span className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <TvTitelCopyButton titel={[tvTitel]} title="Teilvorhaben-Titel kopieren" />
                      </span>
                    </div>
                  ) : null}
                  <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                    {rolle} · <span className="font-mono">{tv.aktenzeichen}</span>
                    {zuwendung ? <>{' '}· Zuwendung: {zuwendung}</> : null}
                  </div>
                </div>
                {tvStatus ? (
                  <Badge
                    variant={getStatusVariant(tvStatus)}
                    className="shrink-0 min-w-[100px] justify-center whitespace-nowrap"
                    title={statusLabel(tvStatus)}
                  >
                    {statusKurzLabel(tvStatus)}
                  </Badge>
                ) : null}
                <span className="shrink-0 text-[var(--tf-text-tertiary)] pt-0.5">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              </div>
            </div>
            {isExpanded ? (
              <div className="mt-3 mb-3 ml-3 pl-4 pb-2" style={{ borderLeft: '2px solid var(--tf-primary)' }}>
                <TvDetailBlock aktenzeichen={tv.aktenzeichen} onOpenAntrag={onOpenAntrag} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
