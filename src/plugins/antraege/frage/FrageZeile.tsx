/**
 * Der Umschalter **Suche mit: Stichworten / einer Frage** und die Zeile, die
 * sagt, was die Frage gesetzt hat.
 *
 * Wortlaut und Muster von
 * [SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx): die App nennt
 * dieses Verfahren überall „Frage", und zwei Namen dafür wären einer zu viel.
 *
 * **Die Zeile trägt, was keine Pille hat.** Status, Variante, Projektart,
 * PreCheck, Jahr und Stillstand erscheinen ohnehin als Pille oder Chip und sind
 * dort korrigierbar; hier stehen die Themen-Begriffe, der Kürzel-Ausschnitt, das
 * vom Bestand nicht Gedeckte und das Nicht-Übersetzte. Alles zusammen noch
 * einmal aufzuzählen machte die Zeile zur zweiten Wahrheit neben den Pillen.
 */
import { Loader2, X } from 'lucide-react';
import type { AntragsFrageErgebnis } from './useAntragsFrage';

/** Die beiden Suchweisen — wortgleich zur Dokumenten-Suche. */
const SUCHART_PRAEFIX = 'Suche mit: ';

const FRAGE_TITEL = 'Die interne KI übersetzt die Frage in Filter — Status, Variante, '
  + 'Projektart, PreCheck, Jahr, Bearbeiter, Stillstand. Was sie gesetzt hat, steht danach '
  + 'als Pille und ist einzeln korrigierbar. Filter, die die Frage nicht nennt, bleiben stehen.';

const STICHWORT_TITEL = 'Wortlaut über Aktenzeichen, Akronym, Titel, Antragsteller und Ort. '
  + 'Wähle „einer Frage", um stattdessen in ganzen Sätzen zu fragen.';

interface Props {
  frage: AntragsFrageErgebnis;
}

export function FrageUmschalter({ frage }: Props): React.ReactElement {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] shrink-0 whitespace-nowrap">
      <select
        value={frage.nlModus ? 'frage' : 'stichwort'}
        onChange={e => frage.setNlModus(e.target.value === 'frage')}
        title={frage.nlModus ? FRAGE_TITEL : STICHWORT_TITEL}
        className="h-7 rounded border border-[var(--tf-border)] bg-[var(--tf-bg)] px-1.5 text-[11.5px] text-[var(--tf-text)] cursor-pointer"
      >
        <option value="stichwort">{SUCHART_PRAEFIX}Stichworten</option>
        <option value="frage">{SUCHART_PRAEFIX}einer Frage</option>
      </select>
      {frage.laeuft ? (
        <Loader2 size={12} className="animate-spin text-[var(--tf-text-tertiary)]" aria-label="Frage wird übersetzt" />
      ) : null}
    </label>
  );
}

/** Ein Abschnitt der Deutungszeile — Beschriftung plus Aufzählung. */
function Teil({ titel, werte, ton }: {
  titel: string;
  werte: readonly string[];
  ton?: 'warnung';
}): React.ReactElement | null {
  if (werte.length === 0) return null;
  return (
    <span className={ton === 'warnung' ? 'text-[var(--tf-warning-text,var(--tf-text-secondary))]' : ''}>
      <span className="text-[var(--tf-text-tertiary)]">{titel} </span>
      {werte.join(' · ')}
    </span>
  );
}

export function FrageDeutung({ frage }: Props): React.ReactElement | null {
  const { plan, wirkung, fehler, laeuft, nlModus, verwirfDeutung } = frage;
  if (!nlModus) return null;

  // Der Fehlerfall zuerst und für sich: es gibt dann keine Deutung, weil nichts
  // gesetzt wurde. Genau das sagt die Meldung auch.
  if (fehler !== null) {
    return (
      <div className="mt-1 flex items-start gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">
        <span className="flex-1">{fehler}</span>
        <button
          type="button"
          onClick={verwirfDeutung}
          className="shrink-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
          aria-label="Meldung schließen"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  if (laeuft || !plan || !wirkung) return null;

  // Was ohnehin als Pille steht, wiederholt die Zeile nicht — sie trägt die
  // Achsen ohne eigenes Bedienelement und alles, was NICHT gewirkt hat.
  const themen = plan.leitbegriffe.map(b => b.begriff);
  const kuerzel = plan.bearbeiter;
  const nichts = wirkung.gesetzt.length === 0;

  return (
    <div className="mt-1 flex items-start gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] flex-wrap">
      {nichts ? (
        <span>Aus dieser Frage ließ sich kein Filter ableiten.</span>
      ) : (
        <span>
          <span className="text-[var(--tf-text-tertiary)]">Gesetzt: </span>
          {wirkung.gesetzt.join(' · ')}
        </span>
      )}
      <Teil titel="Themen:" werte={themen} />
      <Teil titel="Bearbeiter:" werte={kuerzel} />
      <Teil titel="ohne Wirkung:" werte={wirkung.ohneWirkung} ton="warnung" />
      <Teil titel="nicht berücksichtigt:" werte={plan.ignoriert} ton="warnung" />
      <button
        type="button"
        onClick={verwirfDeutung}
        className="ml-auto shrink-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
        aria-label="Deutung ausblenden"
        title="Blendet nur diese Zeile aus — die gesetzten Filter bleiben."
      >
        <X size={12} />
      </button>
    </div>
  );
}
