import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * 15-px-Info-ⓘ mit KLICK-Popover (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`).
 *
 * Bis v4.27 ein Hover-Tooltip. Der Redesign-Grundsatz lautet „jeder Satz, der
 * ueber eine Zeile hinausgeht, gehoert ins ⓘ" — damit tragen diese Texte jetzt
 * die Erklaerungen, die vorher als Absatz auf der Seite standen. Ein
 * Hover-Tooltip taugt dafuer nicht: er verschwindet beim Lesen, ist per
 * Tastatur muehsam und auf Touch gar nicht erreichbar. Radix regelt „genau
 * eines offen", Esc und Klick daneben.
 *
 * Steht seit v4.33 hier statt in `plugins/einstellungen/_shared` — die
 * Layout-Schicht daneben braucht ihn, und die haben inzwischen zwei Wirte.
 * `settings-primitives.tsx` re-exportiert ihn fuer seine Altnutzer.
 */
export function InfoHint({ text, titel }: { text: string; titel?: string }): React.ReactElement {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={titel ? `Info: ${titel}` : 'Info'}
        className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9.5px] font-medium text-[var(--tf-text-tertiary)] cursor-pointer bg-transparent shrink-0 hover:text-[var(--tf-primary)] hover:border-[var(--tf-primary)] data-[state=open]:text-[var(--tf-primary)] data-[state=open]:border-[var(--tf-primary)] data-[state=open]:bg-[var(--tf-primary-light)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40"
        style={{ border: '0.5px solid var(--tf-border-hover)', lineHeight: 1 }}
      >
        i
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[320px] gap-1 bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] text-[12px] leading-[1.55] px-3 py-2.5 rounded-[var(--tf-radius)] ring-0"
        style={{ border: '0.5px solid var(--tf-border)', boxShadow: 'var(--tf-shadow-dialog)' }}
      >
        {titel && (
          <span className="block text-[12px] font-medium text-[var(--tf-text)]">{titel}</span>
        )}
        {text}
      </PopoverContent>
    </Popover>
  );
}
