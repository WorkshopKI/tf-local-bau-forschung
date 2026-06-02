/**
 * AutoTagToggleWand — Toggle-Pill-Wand für automatisch aus den historischen
 * Anträgen abgeleitete Technologie-Tags. Pro Pill aktiv/inaktiv per Klick
 * (inaktiv = im Team-Profil ausgeblendet, schreibt `ausgeblendeteAutoTags`).
 *
 * Layout-konstant: Haken-Slot wird auch im Inaktiv-State gerendert
 * (`invisible`), damit kein horizontaler Shift entsteht (CLAUDE.md Pitfall #14).
 * Inaktiv-Variante ist outline-only + durchgestrichen — bewusst NICHT
 * `opacity-40`, weil das wie disabled wirkt.
 *
 * Extrahiert aus `einstellungen/MeineTechnologienTab.tsx`, damit der Self-
 * Service-Tab UND die PL-Bearbeiten-Maske (`MaInlineDetail.tsx`) dieselbe Wand
 * nutzen.
 */
import { Tooltip } from '@/ui';

const LONG_TAG_THRESHOLD = 38;

/**
 * Kürzt einen WZ-Tag der Form "präfix (a, b, c, d, e)" auf
 * "präfix (a, b, …)" wenn er zu lang ist. Tags ohne Klammer werden nur dann
 * abgekürzt wenn sie über die Schwelle gehen — dann ellipsen wir am Ende.
 */
function truncateWZ(label: string): { short: string; truncated: boolean } {
  if (label.length <= LONG_TAG_THRESHOLD) return { short: label, truncated: false };
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m && m[1] != null && m[2] != null) {
    const head = m[1].trim();
    const parts = m[2].split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 2) {
      return { short: `${head} (${parts.slice(0, 2).join(', ')}, …)`, truncated: true };
    }
  }
  return { short: label.slice(0, LONG_TAG_THRESHOLD - 1) + '…', truncated: true };
}

export function AutoTagToggleWand({
  tags,
  excluded,
  onToggle,
}: {
  tags: string[];
  excluded: string[];
  onToggle: (tag: string) => void;
}): React.ReactElement {
  const excludedSet = new Set(excluded);
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => {
        const isExcluded = excludedSet.has(tag);
        const active = !isExcluded;
        const { short, truncated } = truncateWZ(tag);
        const button = (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            aria-pressed={active}
            aria-label={`${tag} — ${active ? 'aktiv im Team-Profil. Klicken zum Ausblenden.' : 'ausgeblendet. Klicken zum Aktivieren.'}`}
            className={
              active
                ? 'inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-[var(--tf-bg)] hover:text-[var(--tf-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40'
                : 'inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-tertiary)] bg-transparent px-2.5 py-1.5 rounded-md cursor-pointer hover:text-[var(--tf-text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40'
            }
            style={{
              border: active
                ? '0.5px solid transparent'
                : '0.5px solid var(--tf-border)',
              textDecoration: active ? 'none' : 'line-through',
            }}
          >
            <span aria-hidden className={`text-[9px] leading-none ${active ? '' : 'invisible'}`}>✓</span>
            <span>{short}</span>
          </button>
        );
        if (truncated) {
          return (
            <Tooltip key={tag} text={tag}>
              {button}
            </Tooltip>
          );
        }
        return button;
      })}
    </div>
  );
}
