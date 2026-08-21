import { ArrowUpRight, X } from 'lucide-react';
import { useModellEskalation } from '@/core/services/ai/modell-eskalation';
import { MODELL_LABEL } from '@/core/services/ai/modell-wahl';

/**
 * Meldet, dass ein Lauf wegen seines Umfangs auf das größere Modell angehoben
 * wurde.
 *
 * **Warum überhaupt eine Meldung.** Der Wechsel passiert automatisch, damit
 * niemand einen langen Lauf mit einem Dialog unterbrechen muss. Ohne Hinweis
 * stünde danach aber eine Antwort da, von der niemand weiß, welches Modell sie
 * erzeugt hat — und genau das ist die Frage, die bei einem unerwarteten Ergebnis
 * als erste gestellt wird.
 *
 * **Einmal in der Shell montiert statt an jeder Arbeitsfläche.** Der Auto-Wechsel
 * greift überall, wo ein Lauf startet: Gutachten, Aufbereitung, Nachforderungen,
 * Chat, Assistent, Feedback. Ein Hinweis je Fläche hieße, ihn sechsmal zu
 * montieren und beim siebten zu vergessen. Im Normalfall rendert die Komponente
 * `null` und kostet nichts.
 *
 * Der Skill-Lauf hält seine Wahl zusätzlich am Ergebnis fest
 * (`SkillRunResult.modellWahl`) — diese Meldung ist die flüchtige Ansage, jener
 * der bleibende Vermerk.
 */
export function ModellEskalationHinweis(): React.ReactElement | null {
  const letzte = useModellEskalation(s => s.letzte);
  const quittiere = useModellEskalation(s => s.quittiere);

  if (!letzte) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-[var(--tf-radius-lg)] px-3 py-2 mb-3 text-[12.5px] leading-[1.5]"
      style={{ background: 'var(--tf-warning-bg)', border: '0.5px solid var(--tf-warning-border)' }}
    >
      <ArrowUpRight className="w-4 h-4 shrink-0 mt-[1px] text-[var(--tf-warning-text)]" aria-hidden />
      <span className="flex-1 min-w-0 text-[var(--tf-text)]">
        Der Umfang ({letzte.zeichen.toLocaleString('de-DE')} Zeichen) passt nicht in das
        Kontextfenster von <strong>{MODELL_LABEL[letzte.von]}</strong> — dieser Lauf ging an{' '}
        <strong>{MODELL_LABEL[letzte.nach]}</strong>.
        {letzte.reichtTrotzdemNicht && (
          <> Auch dort reicht es nicht: der Text wurde zusätzlich gekürzt.</>
        )}
      </span>
      <button
        type="button"
        onClick={quittiere}
        aria-label="Hinweis schließen"
        className="shrink-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}
