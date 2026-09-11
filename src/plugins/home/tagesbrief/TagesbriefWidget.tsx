/**
 * Tagesbrief (Home-Widget, Hauptspalte, Position 0).
 *
 * Beantwortet die eine Frage, die keine der Karten darunter beantwortet: **was
 * zuerst?** Die Karten bleiben das Nachschlagewerk; dieser Text rankt über ihre
 * Grenzen hinweg.
 *
 * **Kein LLM beim Laden.** Der Satzbau ist deterministisch (`punkte.ts` +
 * `baueBrief.ts`); das Modell kommt erst ins Spiel, wenn jemand nachfragt — und
 * dann über das bestehende Assistent-Dock, nicht über ein zweites Chat-Bauteil
 * auf der Startseite.
 *
 * **Die Zeile ist eine Segment-Liste, kein Satz**: die Zahlen und Namen IM Satz
 * sind die Sprungziele, `aria-label` trägt dieselbe Aussage am Stück. Ein
 * fertiger String böte keinem einzelnen Wort einen Anker (Lehre der
 * Nachtlauf-Zeile, v6.1).
 *
 * **Keine Überschneidung mit der Hero-Karte darüber**: deren drei Kacheln zählen
 * ALTER, dieser Brief rechnet FRIST. Zwei Achsen, und keine Zahl steht zweimal.
 */
import { useStore } from 'zustand';
import { MessageCircleQuestion } from 'lucide-react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { isAssistentPanelEnabled } from '@/config/feature-flags';
import { assistentPanelUiStore } from '@/plugins/chat/assistent/panelUiStore';
import { WidgetShell } from '../widgets/WidgetShell';
import type { WidgetProps } from '../widgets/widgetProps';
import { weitereText } from './baueBrief';
import { useTagesbrief } from './useTagesbrief';
import type { BriefPunkt, Segment, Sprungziel } from './typen';

const LEERE_ABWAHL: never[] = [];

export function TagesbriefWidget({
  instanz, ctx, onToggleEingeklappt,
}: WidgetProps): React.ReactElement | null {
  const { navigate } = useNavigation();
  const aktiv = !instanz.eingeklappt;
  const aus = instanz.config.art === 'tagesbrief' ? instanz.config.aus : LEERE_ABWAHL;
  const brief = useTagesbrief(aktiv, ctx, aus);

  // Der Rückfrage-Knopf hängt am Panel-Flag, nicht am Brief-Flag: fehlt das
  // Dock, verschwindet der Knopf — ausblenden, nicht ausgrauen. Der Brief
  // bleibt vollständig, er ist ja deterministisch.
  const panelDa = isAssistentPanelEnabled();
  const oeffneMitFrage = useStore(assistentPanelUiStore, s => s.oeffneMitFrage);

  const springe = (ziel: Sprungziel): void => {
    if (ziel.art === 'antrag') navigate('antraege', { selectedId: ziel.scopeId });
    else navigate(ziel.plugin);
  };

  const segment = (s: Segment, i: number): React.ReactNode => {
    if (s.art === 'text') return <span key={i}>{s.text}</span>;
    return (
      <button
        key={i}
        type="button"
        onClick={() => springe(s.ziel)}
        className="underline decoration-dotted underline-offset-2 text-[var(--tf-primary)] hover:decoration-solid cursor-pointer"
      >
        {s.text}
      </button>
    );
  };

  const zeile = (p: BriefPunkt, i: number): React.ReactElement => (
    <li
      key={`${p.themaId}-${i}`}
      // Was die Maus in mehreren Klickzielen erfährt, bekommt die
      // Vorlesesoftware in einem Stück.
      aria-label={p.satz}
      className="flex items-start gap-1.5 leading-[19px]"
    >
      <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--tf-text-tertiary)]" />
      <span className="min-w-0">
        <span aria-hidden>{p.segmente.map(segment)}</span>
        {panelDa ? (
          <button
            type="button"
            // Die Frage nennt einen Vorgang — also reist er mit. Ohne ihn steht
            // der Assistent auf der Startseite vor „Keine Entität ausgewählt"
            // und antwortet regelkonform, er wisse nichts über genau den
            // Vorgang, nach dem eben gefragt wurde.
            onClick={() => oeffneMitFrage(p.frage, p.gruppe)}
            title="Dazu nachfragen"
            aria-label={`Dazu nachfragen: ${p.frage}`}
            className="ml-1 inline-flex translate-y-[2px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-primary)] cursor-pointer"
          >
            <MessageCircleQuestion size={13} strokeWidth={1.4} />
          </button>
        ) : null}
      </span>
    </li>
  );

  // Semikolon, nicht Komma: die Punkte tragen selbst Namenslisten („bei FB
  // liegen A, B und C"), und ein Komma zwischen ihnen verschwömme mit denen darin.
  const nachsatz = brief.nachsatz.length > 0
    ? `Außerdem: ${brief.nachsatz.map(p => p.satz).join('; ')}.`
    : null;
  const rest = weitereText(brief.weitere);

  return (
    <WidgetShell
      titel="Tagesbrief"
      variante="haupt"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        <span className="text-[12px] text-[var(--tf-text-tertiary)] tabular-nums">
          {/* Eingeklappt rechnet die Karte nicht — dann „—", nicht „0": eine 0
              wäre eine Aussage über den Bestand, die niemand geprüft hat. */}
          {!aktiv ? '—' : brief.laedt ? '…' : String(brief.punkte.length + brief.nachsatz.length)}
        </span>
      }
    >
      <div className="text-[13px] text-[var(--tf-text)]">
        {brief.punkte.length > 0 ? (
          <ul className="space-y-1">{brief.punkte.map(zeile)}</ul>
        ) : null}

        {/* Lade-Zustand: die Rangliste braucht die Kaskade (wer ist dran?) und
            erscheint erst mit ihr; der Nachsatz darf schon stehen. Gesagt wird
            das dort, wo die Rangliste fehlt — oben, nicht unter dem Nachsatz. */}
        {brief.laedt && brief.punkte.length === 0 ? (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Der Brief wird zusammengestellt …</p>
        ) : null}

        {rest ? (
          <p className="mt-1.5 text-[12px] text-[var(--tf-text-tertiary)]">{rest}.</p>
        ) : null}

        {nachsatz ? (
          <p
            className="mt-2 text-[12.5px] text-[var(--tf-text-secondary)] leading-[19px]"
            aria-label={nachsatz}
          >
            <span aria-hidden>
              Außerdem:{' '}
              {brief.nachsatz.map((p, i) => (
                <span key={`${p.themaId}-${i}`}>
                  {p.segmente.map(segment)}
                  {i < brief.nachsatz.length - 1 ? '; ' : '.'}
                </span>
              ))}
            </span>
          </p>
        ) : null}

        {/* Leere braucht eine Erklärung — nicht „nichts zu tun", sondern was
            geprüft wurde. */}
        {brief.leerText ? (
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{brief.leerText}</p>
        ) : null}
      </div>
    </WidgetShell>
  );
}
