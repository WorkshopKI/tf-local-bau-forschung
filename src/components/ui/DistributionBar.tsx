/**
 * DistributionBar — generischer, domänenfreier Segment-Balken (shared Layout-Schicht).
 *
 * Voll-Breite Flex-Leiste: jedes Segment ist proportional zu seinem `count`
 * (`flexGrow`), zeigt die Zahl zentriert (ab genügend Breite) und öffnet beim
 * Hover den mitgelieferten `tooltip` (shared `Tooltip`-Primitive). Optional folgt
 * eine segment-ausgerichtete Legende darunter.
 *
 * Bewusst OHNE Farb-/Domänen-Wissen: Farben (`color`/`textColor`, Token-Strings),
 * Labels und Tooltip-Inhalt kommen vom Aufrufer. So kann sowohl die Home-Page
 * (Quartals-Rückstand) als auch später andere Verteilungen denselben Balken nutzen.
 */
import { Tooltip } from '@/components/ui/Tooltip';

export interface DistributionSegment {
  /** Stabiler React-Key. */
  key: string;
  /** Anzahl → Segment-Breite (flexGrow) + Zahl im Segment. */
  count: number;
  /** Hintergrundfarbe (Token-String, z.B. `var(--tf-…, fallback)`). */
  color: string;
  /** Farbe der Zahl im Segment (Token-String). */
  textColor: string;
  /** Kurzlabel unter dem Balken (Legende). */
  legendLabel: string;
  /** Reicher Hover-Inhalt (z.B. eine Mini-Tabelle der Einträge). */
  tooltip: React.ReactNode;
}

interface DistributionBarProps {
  segments: DistributionSegment[];
  /** Legende unter dem Balken anzeigen (Default true). */
  showLegend?: boolean;
  /** Balkenhöhe in px (Default 20, Handoff-Maß). */
  height?: number;
  /** Max. Breite des Segment-Tooltips in px (Default 440). */
  tooltipMaxWidth?: number;
}

const BAR_RADIUS = 4;
/**
 * Zahl im Segment erst ab diesem Anteil zeigen (sonst zu eng).
 *
 * 0.08 → 0.04 (v2.372.2): bei vier Segmenten fiel ausgerechnet die älteste
 * Kohorte durch (49 von 638 = 7,7 %) — der Wert, der am meisten weh tut, war
 * der einzige ohne Zahl. 4 % sind bei der Home-Balkenbreite (~1090 px) noch
 * ~44 px, also reichlich für eine zweistellige Zahl bei 10,5 px Schriftgröße.
 * Wer noch schmaler wird, bekommt die Zahl in der Legende (siehe unten).
 */
const SHOW_LABEL_MIN_SHARE = 0.04;

export function DistributionBar({
  segments,
  showLegend = true,
  height = 20,
  tooltipMaxWidth = 440,
}: DistributionBarProps): React.ReactElement {
  const total = segments.reduce((s, seg) => s + seg.count, 0);

  return (
    <div>
      <div className="flex w-full" style={{ height, gap: 2, borderRadius: BAR_RADIUS }}>
        {segments.map((seg) => {
          if (seg.count <= 0) return null;
          const share = total > 0 ? seg.count / total : 0;
          const showLabel = share >= SHOW_LABEL_MIN_SHARE;
          // Der Tooltip-Wrapper IST das Flex-Item (flexGrow ∝ count); das Segment-div
          // füllt ihn (w-full h-full) — so bleibt das Flex-Layout erhalten.
          return (
            <Tooltip
              key={seg.key}
              maxWidth={tooltipMaxWidth}
              wrapperClassName="flex"
              wrapperStyle={{ flexGrow: seg.count, flexBasis: 0, minWidth: 6, height: '100%' }}
              content={seg.tooltip}
            >
              <div
                className="flex items-center justify-center h-full w-full"
                style={{ background: seg.color, borderRadius: 3 }}
              >
                {showLabel && (
                  <span
                    className="font-medium"
                    style={{ fontSize: 10.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: seg.textColor }}
                  >
                    {seg.count}
                  </span>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>

      {showLegend && (
        <div className="flex mt-2" style={{ gap: 2 }}>
          {segments.map((seg) => {
            if (seg.count <= 0) return null;
            // Zu schmal für die Zahl IM Balken → sie wandert in die Legende.
            // Sonst stünde sie nur im Hover-Tooltip, und der ist für Touch und
            // Tastatur unerreichbar (v2.372.2).
            const share = total > 0 ? seg.count / total : 0;
            const zahlInLegende = share < SHOW_LABEL_MIN_SHARE;
            return (
              <span
                key={seg.key}
                className="inline-flex items-center gap-1.5 min-w-0 whitespace-nowrap text-[11.5px] text-[var(--tf-text-secondary)]"
                style={{ flexGrow: seg.count, flexBasis: 0 }}
              >
                <span
                  aria-hidden
                  style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flex: 'none' }}
                />
                <span className="truncate">
                  {seg.legendLabel}
                  {zahlInLegende ? <span className="tabular-nums"> {seg.count}</span> : null}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
