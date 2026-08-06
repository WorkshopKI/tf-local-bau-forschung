/**
 * Ein Trigger-Satz, in dem die Kürzel und Codes ihre Bedeutung mitbringen.
 *
 * „Wenn VB-Status vor 59, TV hat kein ABB → setze TV-Status 31." ist für den
 * Eingearbeiteten präzise und für alle anderen eine Geheimschrift. Die Zeichen
 * tragen deshalb ihre Erklärung im Tooltip: `ABB` → „Bewilligung", `59` →
 * „bewilligt (ZAH-Phase Begleitung)".
 *
 * **Die gepunktete Linie steht genau da, wo eine Erklärung dranhängt.** Kein
 * Tooltip ohne Geste, keine Geste ohne Tooltip — dann ist ihr Fehlen selbst eine
 * Aussage: dieses Zeichen kennt der Katalog nicht, oder die Zeile ist gar nicht
 * gedeutet. Wer über einem unterstrichenen `ABB` und einem blanken `XYZ` steht,
 * weiß sofort, welches von beiden gepflegt ist.
 *
 * Reine Anzeige: die Zerlegung macht `trigger-satz.ts`, die Erklärung
 * `trigger-erklaerung.ts`. Hier wird nichts nachgeschlagen.
 */
import { Fragment } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import type { ErklaertesSegment, SegmentErklaerung } from '@/core/status';

function Zeichen({ text, erklaerung }: {
  text: string;
  erklaerung: SegmentErklaerung;
}): React.ReactElement {
  return (
    <Tooltip
      maxWidth={240}
      content={
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{erklaerung.titel}</span>
          {erklaerung.zusatz && (
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">{erklaerung.zusatz}</span>
          )}
        </span>
      }
    >
      {/* `tabIndex` statt nur Hover: das Popover hat keinen Focus-Trap, und der
          Tooltip reagiert auf `onFocus`. `aria-label` trägt den Klartext für
          Screenreader — ein natives `title` daneben poppte doppelt auf.
          Doppelpunkt statt Gedankenstrich: manche Erklärungen führen selbst einen
          („FB — fachliche Bearbeitung"), und „TIB — FB — fachliche Bearbeitung"
          ist vorgelesen eine Kette ohne Gefälle. */}
      <span
        tabIndex={0}
        aria-label={`${text}: ${erklaerung.titel}`}
        className="cursor-help underline decoration-dotted decoration-[var(--tf-text-tertiary)] underline-offset-2"
      >
        {text}
      </span>
    </Tooltip>
  );
}

export function ErklaerterSatz({ segmente }: {
  segmente: readonly ErklaertesSegment[];
}): React.ReactElement {
  return (
    <>
      {segmente.map((s, i) => (s.erklaerung
        ? <Zeichen key={i} text={s.text} erklaerung={s.erklaerung} />
        // Die Leerzeichen stehen IN den Text-Segmenten; kein `{' '}` ergänzen,
        // sonst steht plötzlich eines zu viel im Satz.
        : <Fragment key={i}>{s.text}</Fragment>))}
    </>
  );
}
