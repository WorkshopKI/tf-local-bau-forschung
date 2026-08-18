import { RefreshCw } from 'lucide-react';

/**
 * Die Zeile, mit der eine Bestands-Seite sagt, **wie alt ihre Zahlen sind** —
 * samt Ausweg.
 *
 * Vorgangs-Board und Vorgangs-Regeln halten ihr durchgerechnetes Ergebnis über
 * den Seitenwechsel hinweg, sonst kostete jede Rückkehr Sekunden. Ein Cache, der
 * das verschweigt, lässt eine Momentaufnahme wie eine Messung aussehen: der
 * Nutzer liest „412 offene Aufgaben" und weiß nicht, ob das gerade gilt. Genau
 * die Art stillen Rückfalls, gegen die `trigger-share.ts` („ein stiller Rückfall
 * … wäre genau die Art von Unehrlichkeit") und der Wächter („`unbewertet` ist
 * ein eigenes Urteil") argumentieren.
 *
 * Deshalb steht das Alter da, und daneben der Knopf, der es auflöst.
 */
export interface BestandsFrischeProps {
  /** Was gerechnet wurde, in Worten der Seite („12 359 Vorgänge"). */
  umfang: string;
  /** `Date.now()` des Laufs; `0`/`null` = in diesem Aufruf gerechnet. */
  berechnetAm: number | null;
  /** Dauer des letzten echten Laufs in ms; `null` = unbekannt. */
  ladeMs: number | null;
  neuBerechnen: () => void;
  laden?: boolean;
  /** Uhr von aussen — hält die Komponente rein und testbar. */
  jetzt?: number;
}

/**
 * „gerade eben" / „vor 3 min" / „vor 1 h 20 min". Rein.
 *
 * Unter einer Minute bewusst **kein** „vor 0 min": das läse sich wie eine
 * Zeitangabe, wo „frisch" gemeint ist.
 */
export function frischeText(berechnetAm: number, jetzt: number): string {
  const sek = Math.max(0, Math.round((jetzt - berechnetAm) / 1000));
  if (sek < 60) return 'gerade eben berechnet';
  const min = Math.floor(sek / 60);
  if (min < 60) return `berechnet vor ${min} min`;
  const std = Math.floor(min / 60);
  const rest = min % 60;
  return `berechnet vor ${std} h${rest > 0 ? ` ${rest} min` : ''}`;
}

export function BestandsFrische({
  umfang, berechnetAm, ladeMs, neuBerechnen, laden = false, jetzt = Date.now(),
}: BestandsFrischeProps): React.ReactElement {
  return (
    <p className="flex items-center gap-2 text-[12px] text-[var(--tf-text-tertiary)]">
      <span>{umfang}</span>
      <span aria-hidden>·</span>
      <span>
        {berechnetAm ? frischeText(berechnetAm, jetzt) : 'gerade eben berechnet'}
        {ladeMs !== null && ` (${(ladeMs / 1000).toFixed(1)} s)`}
      </span>
      <button
        type="button"
        onClick={neuBerechnen}
        disabled={laden}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5
          text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]
          hover:bg-[var(--tf-hover)] disabled:opacity-50
          focus-visible:outline-2 focus-visible:outline-[var(--tf-primary)]"
      >
        <RefreshCw className={`w-3 h-3${laden ? ' animate-spin' : ''}`} aria-hidden />
        neu berechnen
      </button>
    </p>
  );
}
