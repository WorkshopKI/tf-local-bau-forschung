/**
 * Einmaliger Hinweis auf den Rechtsklick (Handoff §2.3, Screenshot 01).
 *
 * Ein Rechtsklick auf eine Seite ist nichts, was man erwartet — ohne Hinweis
 * fände den Weg nur, wer ihn zufällig probiert. Er verschwindet dauerhaft mit
 * „Verstanden" UND sobald das Menü einmal offen war: wer den Weg gefunden hat,
 * braucht den Zettel nicht mehr.
 *
 * localStorage statt IDB — ein Boolean-Flag, wie `teamflow_tour_completed`
 * (CLAUDE.md: localStorage nur für einfache Flags).
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export const HINWEIS_LS_KEY = 'teamflow_home_anpassen_hinweis_gesehen';

/** Defensive Hülle: Vitest läuft in node, `file://` kann localStorage sperren. */
function gesehen(): boolean {
  try {
    return typeof localStorage !== 'undefined'
      && localStorage.getItem(HINWEIS_LS_KEY) === '1';
  } catch {
    return true;
  }
}

export function merkeHinweisGesehen(): void {
  try {
    localStorage.setItem(HINWEIS_LS_KEY, '1');
  } catch {
    // Ohne localStorage erscheint der Hinweis eben erneut — kein Fehlerfall.
  }
}

export function RechtsklickHinweis(): React.ReactElement | null {
  const [zeigen, setZeigen] = useState(false);
  // Erst nach dem Mount lesen: `gesehen()` fasst localStorage an, das im
  // SSR-freien, aber gesperrten `file://`-Fall werfen kann.
  useEffect(() => { setZeigen(!gesehen()); }, []);
  if (!zeigen) return null;

  const schliessen = (): void => { merkeHinweisGesehen(); setZeigen(false); };

  return (
    <div
      // Rechtsbündig unter dem Seitenkopf (Handoff-Screenshot 01) — dort, wo auch
      // der Knopf „Startseite anpassen" steht, auf den er hinweist.
      className="relative mb-4 ml-auto max-w-[330px] rounded-[10px] px-[13px] py-[11px] text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)]"
      style={{ border: '0.5px solid var(--tf-border-hover)', background: 'var(--tf-card-surface)' }}
    >
      <button
        type="button"
        onClick={schliessen}
        aria-label="Hinweis schließen"
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-[6px] text-[var(--tf-text-tertiary)] cursor-pointer hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
      >
        <X size={13} aria-hidden />
      </button>
      <p className="pr-7 font-medium text-[var(--tf-text)]">Neu: Rechtsklick auf die Startseite</p>
      <p className="mt-0.5 pr-7">
        Widgets ein- und ausblenden, sortieren und die Darstellung wechseln — ohne Umweg über die
        Einstellungen. Was nur eine einzelne Karte betrifft, steht im ⋯ ihres Kopfes.
      </p>
      <button
        type="button"
        onClick={schliessen}
        className="mt-2 text-[12px] text-[var(--tf-primary)] cursor-pointer hover:underline"
      >
        Verstanden
      </button>
    </div>
  );
}
