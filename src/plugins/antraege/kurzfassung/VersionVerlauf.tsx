/**
 * Aufklappbarer Versionsverlauf unter der aktuellen Kurzfassung: frühere
 * Fassungen vergleichen (Modifier-Label, Datum, Satz-/Zeichenzahl, Prüf-
 * Ergebnis, Volltext) und per „Diese Fassung übernehmen" zurückholen.
 * Self-gated — rendert nichts, wenn kein Verlauf vorhanden ist.
 */
import { CollapsibleSection } from '@/ui';
import { splitSentences } from '@/core/services/skills';
import { CheckList } from './CheckList';
import { versionLabel, formatDate } from './kurzfassung-verlauf';
import type { KurzfassungVersion } from './types';

interface Props {
  versions: KurzfassungVersion[];
  busy: boolean;
  onUebernehmen: (index: number) => void;
}

const BTN_SECONDARY = 'px-3 py-1.5 rounded-[8px] text-[12px] border-[0.5px] border-[var(--tf-border-hover)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed';

export function VersionVerlauf({ versions, busy, onUebernehmen }: Props): React.ReactElement | null {
  if (versions.length === 0) return null;

  return (
    <div className="mt-4">
      <CollapsibleSection label={`Vorfassungen (${versions.length})`} defaultOpen={false}>
        <div className="flex flex-col gap-4 pb-3">
          {/* Neueste Vorfassung zuerst; Original-Index für onUebernehmen erhalten. */}
          {versions.map((v, idx) => ({ v, idx })).reverse().map(({ v, idx }) => {
            const satzanzahl = splitSentences(v.finalerText).length;
            return (
              <div key={idx} className="rounded-[8px] border-[0.5px] border-[var(--tf-border)] p-3">
                <div className="flex items-baseline gap-2 flex-wrap text-[11.5px] text-[var(--tf-text-tertiary)]">
                  <span className="text-[12px] font-medium text-[var(--tf-text-secondary)]">{versionLabel(v)}</span>
                  <span>·</span>
                  <span>generiert am {formatDate(v.erstellt_am)}</span>
                  <span>·</span>
                  <span>{satzanzahl} {satzanzahl === 1 ? 'Satz' : 'Sätze'}</span>
                  <span>·</span>
                  <span>{v.finalerText.length} Zeichen</span>
                  {v.vbGekuerzt ? <><span>·</span><span>VB gekürzt</span></> : null}
                </div>

                <div className="mt-2.5">
                  <CollapsibleSection label="Text anzeigen" defaultOpen={false}>
                    <div className="pb-2">
                      {v.finalerText.split(/\n{2,}/).map((p, pi) => (
                        <p key={pi} className="text-[13px] leading-[1.7] text-[var(--tf-text)] mb-2">{p}</p>
                      ))}
                    </div>
                  </CollapsibleSection>
                </div>

                {v.checks.length > 0 && (
                  <div className="mt-2.5">
                    <CheckList checks={v.checks} />
                  </div>
                )}

                <div className="mt-3">
                  <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => onUebernehmen(idx)}>
                    Diese Fassung übernehmen
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}
