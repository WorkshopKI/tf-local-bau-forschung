// Kurzprofil am Zeiger: hovert man den Antragsteller einer Teilvorhaben-Zeile,
// stehen seine übrigen Anträge mit Status da — ohne die Detailseite zu verlassen.
//
// Radix' HoverCard statt des projekteigenen Tooltips, aus denselben Gründen wie
// bei `FeedbackCommentHover`: der Tooltip ist `pointer-events-none` (nicht
// scrollbar, nicht klickbar), und hier soll man aus der Liste heraus einen
// anderen Antrag öffnen können. Der Inhalt liegt im Portal — ein Klick darin
// erreicht die aufklappbare TV-Zeile darunter also nicht.
//
// Der Inhalt wird erst bei offener Karte gerechnet: der Filter läuft über die
// ~12k Slim-Records des Programms, und sichtbar ist immer höchstens eine Karte.

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { formatGermanDate } from '@/core/services/csv';
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import { getStatusVariant } from '@/core/utils/status-mappings';
import { statusKurzLabel, statusLabel } from '@/core/utils/status-wert-labels';
import { findAntraegeVonAntragsteller, type AntragstellerProfil } from './antragstellerProfil';
import { findFieldValue } from './fieldLookup';

// Sitz und Art des Antragstellers. AFS **vor** AST — umgekehrt zu `partnerRows`,
// weil der angezeigte Name aus `ORG_AFS` kommt: Name und Ort sollen aus derselben
// Quelle stammen, sonst steht im Kopf eine Stadt, die nicht zur Firma darüber gehört.
const ORT_ALIASES = ['ort_afs', 'ORT_AFS', 'ort_ast', 'ORT_AST'];
const TYP_ALIASES = ['ast_typ', 'ATTR_TEXT', 'attribut', 'ATTR_AUFB'];

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** Die nicht-leeren Töpfe als Kurztext — „1 bewilligt · 2 abgelehnt". */
function bilanzText(p: AntragstellerProfil): string {
  const teile: string[] = [];
  if (p.bewilligt > 0) teile.push(`${p.bewilligt} bewilligt`);
  if (p.abgelehnt > 0) teile.push(`${p.abgelehnt} abgelehnt/zurückgezogen`);
  if (p.inArbeit > 0) teile.push(`${p.inArbeit} in Arbeit`);
  if (p.abgeschlossen > 0) teile.push(`${p.abgeschlossen} abgeschlossen`);
  if (p.sonstige > 0) teile.push(`${p.sonstige} sonstige`);
  return teile.join(' · ');
}

interface Props {
  /** Das betrachtete Teilvorhaben — liefert Name, Sitz und Art. */
  tv: Antrag;
  /** Angezeigter Antragsteller-Name (bereits auf „—" veroderter Wert der Zeile). */
  name: string;
  /** In-Memory-Slim-Liste des Programms (aus `useAntraegeStore`). */
  alleAntraege: readonly AntragListItem[];
  /** Verbund-ID des geöffneten Verbundes — markiert Geschwister-Teilvorhaben. */
  verbundId: string | null;
  onOpenAntrag: (aktenzeichen: string) => void;
  /** Der Namens-Text selbst; wird per `asChild` zum Trigger. */
  children: React.ReactNode;
}

export function AntragstellerProfilHover({
  tv, name, alleAntraege, verbundId, onOpenAntrag, children,
}: Props): React.ReactElement {
  const [offen, setOffen] = useState(false);

  const profil = offen
    ? findAntraegeVonAntragsteller({
        name,
        currentAktenzeichen: tv.aktenzeichen,
        currentVerbundId: verbundId,
        antraege: alleAntraege,
      })
    : null;

  const ort = str(findFieldValue(tv, ORT_ALIASES)) ?? str(tv.ort_ast);
  const typ = str(findFieldValue(tv, TYP_ALIASES));
  const meta = [ort, typ].filter(Boolean).join(' · ');

  return (
    // 500 ms wie bei den Feedback-Hovers (DESIGN_GUIDE: keine Tooltip-Delays
    // unter 500 ms) — der geteilte Default des Wrappers bleibt unangetastet.
    <HoverCard open={offen} onOpenChange={setOffen} openDelay={500} closeDelay={200}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      {profil && (
        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="w-[380px] max-w-[380px] p-0"
        >
          <div className="px-3 pt-2.5 pb-2 border-b-[0.5px] border-[var(--tf-border)]">
            {/* Voller Name — die Zeile darunter ist `truncate`, hier steht er ganz. */}
            <div className="text-[12.5px] font-medium leading-snug text-[var(--tf-text)]">
              {profil.name}
            </div>
            {meta ? (
              <div className="mt-0.5 text-[11px] text-[var(--tf-text-tertiary)]">{meta}</div>
            ) : null}
            <div className="mt-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">
              {profil.gesamt === 0 ? (
                'Keine weiteren Anträge dieses Antragstellers.'
              ) : (
                <>
                  <span className="font-medium text-[var(--tf-text)]">
                    {profil.gesamt === 1 ? '1 weiterer Antrag' : `${profil.gesamt} weitere Anträge`}
                  </span>
                  {bilanzText(profil) ? <> · {bilanzText(profil)}</> : null}
                </>
              )}
            </div>
          </div>

          {profil.gesamt > 0 ? (
            // EINE Zeile je Antrag, nicht zwei. Akronym über Kennzeichen
            // gestapelt kostete 44 px je Eintrag — fünf Anträge füllten damit
            // den halben Bildschirm, und die Karte soll im Vorbeigehen lesbar
            // sein. Nebeneinander bleiben beide vollständig lesbar; was nicht
            // passt, kürzt das Akronym, dessen `title` es ganz trägt.
            //
            // Der Chevron, der bis dahin am rechten Rand auf Hover erschien,
            // ist mit demselben Schritt entfallen: er belegte dauerhaft 21 px
            // der 356 px breiten Zeile, um bei Berührung dasselbe zu sagen wie
            // Hintergrund und Zeigerform ohnehin.
            <div className="max-h-[280px] overflow-y-auto py-1">
              {profil.antraege.map(a => (
                <button
                  key={a.aktenzeichen}
                  type="button"
                  onClick={() => { setOffen(false); onOpenAntrag(a.aktenzeichen); }}
                  className="flex w-full items-center gap-2 px-3 py-1 text-left transition-colors cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
                  title={`${a.akronym ?? a.aktenzeichen} öffnen`}
                >
                  <span className="shrink-0 w-[58px] text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
                    {a.antragsdatum ? formatGermanDate(a.antragsdatum) : '—'}
                  </span>
                  {/* Am echten Bestand gemessen: von 6.646 Akronymen sind 51
                      (0,8 %) breiter als die 110 px, die neben dem längsten
                      Status-Badge bleiben; das breiteste misst 127 px. Was
                      gekürzt wird, steht ungekürzt im `title` der Zeile. */}
                  <span className="flex-1 min-w-0 truncate text-[11.5px] font-medium text-[var(--tf-text)]">
                    {a.akronym ?? '—'}
                  </span>
                  {/* Die Marke kürzt NICHT mit: „dieser Ver…" wäre kaputt statt
                      knapp. Sie trifft ohnehin nur 232 Zeilen im ganzen Bestand
                      (108 Verbünde, in denen ein Antragsteller mehrere
                      Teilvorhaben hält) und höchstens zwei in einer Karte. */}
                  {a.imSelbenVerbund ? (
                    <span className="shrink-0 text-[10.5px] text-[var(--tf-text-tertiary)]">
                      dieser Verbund
                    </span>
                  ) : null}
                  <span className="shrink-0 font-mono text-[10.5px] text-[var(--tf-text-tertiary)]">
                    {a.aktenzeichen}
                  </span>
                  {a.status ? (
                    <Badge
                      variant={getStatusVariant(a.status)}
                      className="shrink-0 max-w-[104px] justify-center truncate"
                      title={statusLabel(a.status)}
                    >
                      {statusKurzLabel(a.status)}
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {/* Pitfall #46: kein Zustand ohne sichtbare Aussage — diese Liste
              schaut bewusst über den Betrachtungsbereich hinaus. */}
          <div className="px-3 py-1.5 border-t-[0.5px] border-[var(--tf-border)] text-[10.5px] text-[var(--tf-text-tertiary)]">
            Ganzer Bestand — auch Richtlinien außerhalb der Anzeige.
          </div>
        </HoverCardContent>
      )}
    </HoverCard>
  );
}
