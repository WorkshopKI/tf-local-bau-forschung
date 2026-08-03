// Initialen-Avatar für Feedback-Autoren + Kommentare (Redesign v2.199).
// Deterministische Farbe aus dem Namen (5-Farb-Palette) — so bleibt eine Person
// über Liste/Board/Drawer hinweg farblich wiedererkennbar. „Du" → Initialen „DU".
//
// Die Palette liegt bewusst als JS-Konstante vor (nicht als --tf-*-Token): es sind
// dekorative, per-Name variierende Werte (dynamische Inline-Farbe erlaubt); die
// mittlere Helligkeit trägt Weiß-Text in Light + Dark.
import { initialenVon } from '@/core/utils/profil-anzeige';

const AV_COLORS = [
  'hsl(215 40% 50%)',
  'hsl(265 35% 55%)',
  'hsl(150 38% 42%)',
  'hsl(15 55% 52%)',
  'hsl(38 60% 48%)',
] as const;

export function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length;
  return AV_COLORS[h] ?? AV_COLORS[0];
}

export function avatarInitials(name: string): string {
  if (name.trim().toLowerCase() === 'du') return 'DU';
  return initialenVon(name);
}

interface Props {
  name: string;
  /** Durchmesser in px (Liste 20, Board 17). */
  size?: number;
  className?: string;
}

export function FeedbackAvatar({ name, size = 20, className }: Props): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-medium shrink-0 ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: avatarColor(name),
        fontSize: Math.round(size * 0.42),
      }}
      title={name}
      aria-hidden
    >
      {avatarInitials(name)}
    </span>
  );
}
