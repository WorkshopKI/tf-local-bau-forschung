/**
 * Fundstellen-Chip mit Auszug-Popover (Paket 2). Monochromer `§ 3.1`-Chip; auf
 * Hover/Fokus erscheint ein leichtes Popover mit Kapiteltitel + ~300-Zeichen-Auszug
 * ab Span-Beginn (aus `VbSektion.start` gegen das VB-Markdown geschnitten). Ist ein
 * Lesemodus verfügbar (Context `useLesemodusSprung`), wird der Chip KLICKBAR und
 * springt „Im Antrag öffnen" zur Sektion; sonst bleibt er ein reiner Hover-Chip.
 * Wird von Abdeckung/Steckbrief/Zahlen/Fragen genutzt (in der Layout-Schicht).
 */
import { useMemo } from 'react';
import type { VbSektion } from './gliederung';
import { useLesemodusSprung } from './lesemodusSprung';

const AUSZUG_LEN = 300;

/** Kurz-Label eines Chips: Kapitelnummer, sonst die Kurz-ID. */
export function fundstelleLabel(sektion: VbSektion): string {
  return `§ ${sektion.nummer ?? sektion.id}`;
}

/**
 * Reines Popover (Kapiteltitel + Auszug), das auf Hover/Fokus eines
 * `group`-Elternteils erscheint. Wird von `FundstelleChip` (Abdeckung/Steckbrief)
 * UND den Karten-Knoten der `StrukturKarte` genutzt — muss in einem Element mit
 * Klasse `group` liegen.
 */
export function FundstellePopover({
  sektion, vbMarkdown,
}: {
  sektion: VbSektion;
  vbMarkdown: string | null;
}): React.ReactElement {
  const sprungbar = !!useLesemodusSprung();
  const kapitel = `${sektion.nummer ? `${sektion.nummer} ` : ''}${sektion.titel}`.trim();
  const auszug = useMemo(() => {
    if (!vbMarkdown) return null;
    const roh = vbMarkdown.slice(sektion.start, sektion.start + AUSZUG_LEN).trim();
    if (!roh) return null;
    return sektion.end - sektion.start > AUSZUG_LEN ? `${roh} …` : roh;
  }, [vbMarkdown, sektion.start, sektion.end]);

  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-max max-w-[420px] rounded-lg p-3 text-left shadow-lg group-hover:block group-focus-within:block bg-[var(--tf-bg)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="mb-1 block text-[12px] font-medium text-[var(--tf-text)]">{kapitel}</span>
      {auszug ? (
        <span className="block whitespace-pre-wrap text-[11.5px] leading-snug text-[var(--tf-text-secondary)]">{auszug}</span>
      ) : (
        <span className="block text-[11.5px] text-[var(--tf-text-tertiary)]">Auszug derzeit nicht verfügbar.</span>
      )}
      <span className="mt-2 block text-[10.5px] text-[var(--tf-text-tertiary)]">
        {sprungbar ? 'Klick öffnet die Stelle im Lesemodus.' : 'Sprung ins Original folgt mit dem Lesemodus.'}
      </span>
    </span>
  );
}

export function FundstelleChip({
  sektion, vbMarkdown,
}: {
  sektion: VbSektion;
  vbMarkdown: string | null;
}): React.ReactElement {
  const springeZu = useLesemodusSprung();
  const chipKlassen =
    'rounded px-1 py-0.5 text-[11px] whitespace-nowrap text-[var(--tf-text-secondary)] outline-none hover:bg-[var(--tf-hover)] focus:bg-[var(--tf-hover)]';
  return (
    <span className="relative inline-flex group">
      {springeZu ? (
        <button
          type="button"
          onClick={() => springeZu(sektion.id)}
          className={`${chipKlassen} cursor-pointer`}
          style={{ border: '0.5px solid var(--tf-border)' }}
          title="Im Antrag öffnen"
        >
          {fundstelleLabel(sektion)}
        </button>
      ) : (
        <span
          tabIndex={0}
          className={`${chipKlassen} cursor-help`}
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          {fundstelleLabel(sektion)}
        </span>
      )}
      <FundstellePopover sektion={sektion} vbMarkdown={vbMarkdown} />
    </span>
  );
}
