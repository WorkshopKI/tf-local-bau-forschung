/**
 * Die Zeile „Gesucht wird" unter den Suchoptionen.
 *
 * Zerlegung und Wirkung stehen in der reinen
 * [deutung.ts](src/plugins/suche/deutung.ts); hier wird gerendert und geklickt.
 *
 * Farbcode wie in der Trefferliste: gelb = so getippt, türkis = über den
 * Wortstamm dazugekommen. Zwei Orte, eine Bedeutung — sonst müsste man die
 * Legende zweimal lernen.
 */
import { X, Loader2 } from 'lucide-react';
import { VERKNUEPFUNG_OPERATOR, type SuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import { TREFFERFELD_LABEL } from '@/core/services/search/trefferstelle';
import type { Frageplan } from '@/core/services/search/frageplan';
import { baueWortChips, type DeutungsChip } from './deutung';

/**
 * Wie viele Varianten-Chips die Zeile zeigt.
 *
 * Gesucht wird mit ALLEN eingesammelten Varianten (siehe `VARIANTEN_MAX` in der
 * Suchstufe) — angezeigt nur die ersten paar, weil eine Zeile mit vierzig Chips
 * niemand liest. Die nicht gezeigten bleiben aktiv; sie verschwinden aus der
 * Sicht, nicht aus der Suche.
 */
const VARIANTEN_SICHTBAR = 8;

/**
 * Die Chips eines Frageplans.
 *
 * Dieselbe Form wie die Wort-Chips — die Zeile hat EINEN Chip-Mechanismus, nicht
 * zwei. Ein Leitbegriff ist die Einheit, die abgewählt wird; seine Schreibweisen
 * hängen als Zusatz am Chip und stehen vollständig im Tooltip.
 */
interface PlanChip extends DeutungsChip {
  /** Wie viele Schreibweisen hinter diesem Begriff stehen (ohne ihn selbst). */
  weitere: number;
  /** Alle Nadeln, für den Tooltip. */
  nadeln: readonly string[];
  /** Einschränkung statt Alternative. */
  pflicht: boolean;
}

function bauePlanChips(plan: Frageplan, abgewaehlt: readonly string[]): PlanChip[] {
  const aus = new Set(abgewaehlt.map(w => w.toLowerCase()));
  return plan.leitbegriffe.map(b => ({
    wort: b.begriff,
    wert: b.begriff,
    feld: b.feld,
    aktiv: !aus.has(b.begriff.toLowerCase()),
    weitere: Math.max(0, b.nadeln.length - 1),
    nadeln: b.nadeln,
    pflicht: b.pflicht,
  }));
}

export function DeutungsZeile({
  query,
  verknuepfung,
  abgewaehlteWoerter,
  onToggleWort,
  plan,
  abgewaehlteBegriffe,
  onToggleBegriff,
  varianten,
  abgewaehlteVarianten,
  onToggleVariante,
  onVariantenPruefen,
  variantenPruefungLaeuft = false,
  variantenGeprueft = false,
  stammSuche,
  onStammSucheAn,
}: {
  query: string;
  verknuepfung: SuchVerknuepfung;
  abgewaehlteWoerter: readonly string[];
  onToggleWort: (wort: string) => void;
  /** Der Frageplan, falls mit natürlicher Sprache gesucht wurde. */
  plan?: Frageplan | null;
  abgewaehlteBegriffe?: readonly string[];
  onToggleBegriff?: (begriff: string) => void;
  varianten: readonly string[];
  abgewaehlteVarianten: readonly string[];
  onToggleVariante: (v: string) => void;
  /** „Von der KI prüfen" — fehlt, wenn der Build die interne Prüfung nicht mitbringt. */
  onVariantenPruefen?: () => void;
  variantenPruefungLaeuft?: boolean;
  /** Schon geprüft? Dann kein zweiter Lauf auf dasselbe Ergebnis. */
  variantenGeprueft?: boolean;
  stammSuche: boolean;
  onStammSucheAn: () => void;
}): React.ReactElement | null {
  const planChips = plan ? bauePlanChips(plan, abgewaehlteBegriffe ?? []) : null;
  const chips: readonly DeutungsChip[] = planChips
    ?? baueWortChips(query, verknuepfung, abgewaehlteWoerter);
  if (chips.length === 0) return null;
  const toggle = planChips ? (onToggleBegriff ?? onToggleWort) : onToggleWort;
  // Ein Plan verknüpft seine Themen immer mit ODER — die eingestellte Verknüpfung
  // gilt dort nicht, und die Zeile darf nichts anderes behaupten.
  const operator = VERKNUEPFUNG_OPERATOR[planChips ? 'oder' : verknuepfung];
  const ausVarianten = new Set(abgewaehlteVarianten.map(v => v.toLowerCase()));
  // Sobald ein Teil sein Feld nennt, laufen Dokumente und Ähnlichkeit nicht mit
  // (siehe feldpraefix.ts). Das steht hier, weil die Zeile ohnehin sagt, was aus
  // der Eingabe geworden ist — eine stille Abschaltung wäre der Defekt. Ein Plan
  // schränkt zusätzlich über seine Pflichtteile ein.
  const feldSuche = chips.some(c => c.feld !== undefined)
    || (planChips?.some(c => c.pflicht) ?? false);

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[10px] px-3 py-2"
      style={{ background: 'var(--tf-desk)', border: '0.5px solid var(--tf-border)' }}
    >
      <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
        {planChips ? 'Gesucht wurde nach' : 'Gesucht wird'}
      </span>

      {chips.map((chip, i) => {
        const p = planChips?.[i];
        // Aus Teilen zusammengesetzt statt aneinandergehängt: leere Teile
        // hinterlassen sonst führende Leerzeichen im Tooltip.
        const titelTeile = [
          chip.feld ? `Nur im Feld „${TREFFERFELD_LABEL[chip.feld]}".` : '',
          p?.pflicht ? 'Einschränkung — muss zutreffen.' : '',
          p && p.weitere > 0 ? `Schreibweisen: ${p.nadeln.join(', ')}.` : '',
          chip.aktiv ? `„${chip.wert}" nicht mitsuchen` : `„${chip.wert}" wieder mitsuchen`,
        ].filter(Boolean);
        return (
          <span key={chip.wort} className="inline-flex items-center gap-x-2">
            {i > 0 && (
              <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
                {/* Eine Einschränkung ist keine Alternative — sie MUSS zutreffen. */}
                {p?.pflicht ? 'UND NUR' : operator}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggle(chip.wort)}
              title={titelTeile.join(' ')}
              aria-pressed={chip.aktiv}
              className={`inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[12px] cursor-pointer transition-opacity ${chip.aktiv ? '' : 'opacity-45 line-through'}`}
              style={{ background: chip.aktiv ? 'var(--tf-highlight)' : 'transparent',
                border: chip.aktiv ? '0.5px solid transparent' : '0.5px solid var(--tf-border)' }}
            >
              {/* Das Feld steht im Chip, nicht als eigenes Etikett daneben: es
                  gehört zu diesem einen Wort, nicht zur Anfrage. */}
              {chip.feld && (
                <span className="text-[var(--tf-text-secondary)]">
                  {TREFFERFELD_LABEL[chip.feld]}:
                </span>
              )}
              <span className="text-[var(--tf-text)]">{chip.wert}</span>
              {/* Die Zahl sagt, dass hinter dem Begriff mehr steckt als sein
                  Wortlaut — der Tooltip nennt es vollständig. Vierzig Chips
                  nebeneinander läse niemand. */}
              {p && p.weitere > 0 && (
                <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">+{p.weitere}</span>
              )}
              <X size={11} className="text-[var(--tf-text-tertiary)]" aria-hidden />
            </button>
          </span>
        );
      })}

      {/* Die Stamm-Varianten. Sie stehen nur da, wenn der Bestand sie
          tatsächlich hergegeben hat — eine leere Liste bleibt leer statt eine
          Überschrift ohne Inhalt zu zeigen. Im Frage-Modus gibt es sie nicht:
          dort hat die KI die Wortformen bereits benannt, und sie stehen an ihren
          Leitbegriffen. */}
      {!planChips && stammSuche && varianten.length > 0 && (
        <>
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">auch als</span>
          {varianten.slice(0, VARIANTEN_SICHTBAR).map(v => {
            const aktiv = !ausVarianten.has(v.toLowerCase());
            return (
              <button
                key={v}
                type="button"
                onClick={() => onToggleVariante(v)}
                title={aktiv ? `„${v}" nicht mitsuchen` : `„${v}" wieder mitsuchen`}
                aria-pressed={aktiv}
                className={`inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[12px] cursor-pointer transition-opacity ${aktiv ? '' : 'opacity-45 line-through'}`}
                style={{ background: aktiv ? 'var(--tf-highlight-aehnlich)' : 'transparent',
                  border: aktiv ? '0.5px solid transparent' : '0.5px solid var(--tf-border)' }}
              >
                <span className="text-[var(--tf-text)]">{v}</span>
                <X size={11} className="text-[var(--tf-text-tertiary)]" aria-hidden />
              </button>
            );
          })}

          {/* Der Wortstamm ist sprachlich, nicht fachlich: „normotherme" teilt
              ihn mit „Normung" und handelt von etwas anderem. Was übrig bleibt,
              braucht Bedeutung — auf Wunsch, nicht bei jedem Tastendruck. Die
              KI wählt danach dieselben Chips ab, die auch der Nutzer abwählen
              könnte; nichts davon ist endgültig. */}
          {onVariantenPruefen && (
            <button
              type="button"
              onClick={onVariantenPruefen}
              disabled={variantenPruefungLaeuft || variantenGeprueft}
              title={variantenGeprueft
                ? 'Die interne KI hat diese Liste geprüft. Was sie aussortiert hat, steht '
                  + 'durchgestrichen daneben und lässt sich einzeln zurückholen.'
                : 'Die interne KI sortiert die Wörter aus, die nur zufällig denselben '
                  + 'Wortstamm haben. Ein Lauf, ein paar Sekunden — die Wortformen selbst '
                  + 'bleiben auch ohne KI nutzbar.'}
              className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer disabled:cursor-default disabled:hover:text-[var(--tf-text-tertiary)]"
              style={{ border: '0.5px dashed var(--tf-border)' }}
            >
              {variantenPruefungLaeuft && (
                <Loader2 size={11} className="animate-spin" aria-hidden />
              )}
              {variantenGeprueft ? 'von der KI geprüft'
                : variantenPruefungLaeuft ? 'prüfe …' : 'von der KI prüfen'}
            </button>
          )}
        </>
      )}

      {feldSuche && (
        <span
          className="text-[11px] text-[var(--tf-text-tertiary)]"
          title="Ein genanntes Feld können weder der Dokumentenindex noch die Ähnlichkeitssuche einhalten — sie würden Treffer beisteuern, die außerhalb des Feldes liegen. Ohne Feldangabe laufen beide wie gewohnt mit."
        >
          · nur in den Antragsfeldern
        </span>
      )}

      {/* Was aus der Frage NICHT umgesetzt wurde. Steht hier, weil die Zeile
          ohnehin sagt, was aus der Eingabe geworden ist — eine stillschweigend
          verworfene Hälfte der Frage wäre genau der Defekt, gegen den sie
          geschrieben ist. */}
      {planChips && plan && plan.ignoriert.length > 0 && (
        <span
          className="text-[11px] text-[var(--tf-text-tertiary)]"
          title={`Nicht in die Suche übersetzt: ${plan.ignoriert.join('; ')}`}
        >
          · nicht berücksichtigt: {plan.ignoriert.join(' · ')}
        </span>
      )}

      {/* Einladung statt Leerstelle: wer die Stammsuche nicht kennt, sieht hier,
          dass es sie gibt — an der Stelle, wo ihre Wirkung erscheinen würde. */}
      {!planChips && !stammSuche && (
        <button
          type="button"
          onClick={onStammSucheAn}
          title="Wortstamm-Varianten mitsuchen — „Normen“ findet dann auch „Normung“"
          className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
          style={{ border: '0.5px dashed var(--tf-border)' }}
        >
          + Wortformen
        </button>
      )}
    </div>
  );
}
