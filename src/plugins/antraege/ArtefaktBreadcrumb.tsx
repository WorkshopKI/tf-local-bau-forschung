/**
 * Werkstatt-Breadcrumb (Journey-Paket 2 Phase 7): schlanke, sticky Rückzeile über
 * den Artefakt-Werkstätten (Gutachten / Nachforderung) — `← {Akronym} · {Phase}`.
 * Klick scrollt zurück zum Verbund-Kopf.
 *
 * Inline-Modell: die Werkstätten sind Abschnitte derselben Detailseite (keine
 * separate Route). Die Artefakt-Leiste sitzt im Kopf und ist beim Arbeiten in der
 * Werkstatt weggescrollt — die Breadcrumb bringt den Kopf per Klick zurück.
 */
import { ArrowLeft } from 'lucide-react';

interface Props {
  akronym: string;
  /** Amtliche Phase (Stepper-Station bzw. Terminal-Label). */
  phase: string | null;
  onBack: () => void;
}

export function ArtefaktBreadcrumb({ akronym, phase, onBack }: Props): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onBack}
      className="sticky top-[34px] z-20 -mx-6 mb-3 px-6 py-2 flex items-center gap-2 text-[12.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-primary)] transition-colors"
      style={{ background: 'var(--tf-bg)', borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <ArrowLeft size={14} className="shrink-0" />
      <span className="font-medium text-[var(--tf-text)]">{akronym}</span>
      {phase ? (
        <>
          <span className="text-[var(--tf-text-tertiary)]">·</span>
          <span>{phase}</span>
        </>
      ) : null}
    </button>
  );
}
