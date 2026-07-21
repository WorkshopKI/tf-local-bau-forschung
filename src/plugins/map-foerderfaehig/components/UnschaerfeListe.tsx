/**
 * Unschärfe-Liste: Anspruchsformeln ohne Zahl oder Definition.
 *
 * Eine Liste, die der Fachbereich durchgeht — ausdrücklich KEIN Score. Ein
 * Zähler („7 unscharfe Begriffe") lädt dazu ein, Textqualität zu benoten, und
 * genau das soll dieses Modul nicht. Der Nutzen liegt in den einzelnen Zeilen
 * und darin, dass aus jeder per Klick eine präzise Nachfrage wird.
 *
 * Rein darstellend.
 */
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import type { UnschaerfeBegriff } from '../infografik/substanz';
import { SektionChips } from './SektionChips';

const GRUND_LABEL: Record<UnschaerfeBegriff['grund'], string> = {
  'nicht quantifiziert': 'nicht beziffert',
  'nicht definiert': 'nicht definiert',
};

export function UnschaerfeListe({
  begriffe, gliederung, erledigteAusloeser, onNachfordern,
}: {
  begriffe: readonly UnschaerfeBegriff[];
  gliederung: readonly VbSektion[];
  /** Auslöser, zu denen bereits eine Präzisions-NF vorliegt. */
  erledigteAusloeser: ReadonlySet<string>;
  onNachfordern: (begriff: UnschaerfeBegriff) => void;
}): React.ReactElement {
  if (begriffe.length === 0) {
    return (
      <p className="text-[13px] text-[var(--tf-text-secondary)]">
        Keine unscharfen Anspruchsformeln gefunden — oder der Analyse-Lauf steht noch aus.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] flex items-center gap-1.5">
        <Sparkles size={12} />
        KI-Vorschlag — bitte prüfen. Formulierungen mit Anspruchscharakter, die weder
        Zahl noch Beleg tragen.
      </p>

      {begriffe.map((b, i) => {
        const erledigt = erledigteAusloeser.has(b.begriff);
        return (
          <div
            key={`${b.begriff}-${i}`}
            className="rounded-[var(--tf-radius-md,8px)] px-3 py-2.5"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12.5px] text-[var(--tf-text)] min-w-0">„{b.begriff}"</p>
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0 mt-0.5 font-mono">
                {GRUND_LABEL[b.grund]}
              </span>
            </div>

            {b.kontext.length > 0 && (
              <p className="text-[11.5px] text-[var(--tf-text-secondary)] mt-1 leading-relaxed">
                {b.kontext}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <SektionChips sektionIds={b.sektionIds} gliederung={gliederung} />
              <Button
                variant="ghost" size="sm"
                disabled={erledigt}
                onClick={() => onNachfordern(b)}
              >
                {erledigt ? 'Nachforderung erzeugt' : 'Nachforderung erzeugen'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
