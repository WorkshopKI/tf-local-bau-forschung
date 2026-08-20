/**
 * Der Rahmen der Verbund-Detailseite: die Panel-Hülle und der Sektions-Rahmen.
 *
 * Beides trug vorher `VerbundDetail` selbst — die Trennstriche als inline
 * `borderTop` auf sechs handgeschriebenen Wrapper-`div`s. Das hatte eine stille
 * Nebenwirkung: der Wrapper zeichnete Strich und Abstand auch dann, wenn die
 * Sektion darin `null` lieferte. `WiderspruchSection` tut das im Regelfall (kein
 * RNE/ABL-Bescheid), `StatusDetailSection` ohne Katalog-Fassung, `MeilensteinSection`
 * ohne Plan — auf der Seite standen dann Trennstrich plus 48 px Leerraum ohne
 * jeden Inhalt zwischen zwei echten Sektionen.
 *
 * Deshalb liegt der Strich hier als KLASSE (nicht inline, sonst gewönne er gegen
 * jede Variante) zusammen mit `empty:hidden`: ein Rahmen ohne gerendertes Kind
 * nimmt Strich und Abstand mit. Der Preis ist eine CSS-Regel statt einer
 * Bedingung im JSX — dafür muss keine Sektion ihrem Aufrufer verraten, ob sie
 * heute etwas zu sagen hat.
 */
import { X } from 'lucide-react';
import { RueckwegLink } from '@/core/nav/RueckwegLink';
import { useSichtbar } from '@/core/hooks/useSichtbar';
import { abschnittId } from '@/core/sichtbarkeit';
import type { DetailSektionId } from './detailSektionen';

/**
 * Rahmen einer Werkstatt-Sektion: Trennstrich nach oben + Sprung-Anker.
 *
 * `empty:hidden` (siehe Modulkopf) blendet den Rahmen aus, sobald die Sektion
 * nichts rendert — inklusive Marge und Padding, weil `display: none` beides
 * mitnimmt.
 */
export function Sektionsrahmen({ id, sektion, children }: {
  /** DOM-Anker (Sprungziel, Deep-Link) — bleibt, was er ist. */
  id: string;
  /**
   * Katalog-Sektion für Beta/Experte. Nur nötig, wo der Anker anders heißt als
   * die Sektion (`id="nf"` → `nachforderungen`); sonst sind sie dasselbe Wort.
   */
  sektion?: DetailSektionId;
  children: React.ReactNode;
}): React.ReactElement | null {
  // Beta/Experte: der Rahmen ist der gemeinsame Ort der großen Detail-Sektionen.
  const sichtbar = useSichtbar();
  if (!sichtbar(abschnittId('antraege', `detail-${sektion ?? id}`))) return null;
  return (
    <div
      id={id}
      className="mt-3 pt-3 scroll-mt-[80px] border-t-[0.5px] border-[var(--tf-border)] empty:hidden"
    >
      {children}
    </div>
  );
}

/**
 * Hülle für Detail-Sektionen OHNE `Sektionsrahmen` — die Klapp-Karten
 * (`CollapsibleDataSection`) und die drei Blöcke innerhalb der Status-Sektion.
 *
 * Sie bringen ihren eigenen Rahmen mit, brauchen aber dieselbe Beta/Experte-
 * Prüfung. Eigenes Bauteil statt `<WennSichtbar id={abschnittId(…)}>` an jeder
 * Stelle: so entsteht die Katalog-Id genau zweimal in diesem Plugin (hier und
 * im `Sektionsrahmen`) statt neunmal im JSX.
 */
export function WennDetailSektion({ sektion, children }: {
  sektion: DetailSektionId;
  children: React.ReactNode;
}): React.ReactElement | null {
  const sichtbar = useSichtbar();
  if (!sichtbar(abschnittId('antraege', `detail-${sektion}`))) return null;
  return <>{children}</>;
}

/**
 * Panel-Hülle des Details: Rückweg links, Schließen rechts, darunter der Inhalt.
 *
 * Der Rückweg selbst ist seit v4.133 das geteilte
 * [RueckwegLink](../../core/nav/RueckwegLink.tsx) — die Skill-Verwaltung trägt
 * denselben Knopf, und sie darf nicht in dieses Plugin importieren.
 */
export function PanelShell({ onClose, zurueck, children }: {
  onClose: () => void;
  zurueck?: { label: string; onClick: () => void };
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto" style={{ borderLeft: '0.5px solid var(--tf-border)' }}>
      {/* Links der Rückweg (nur wenn es einen gibt), rechts das Schließen. Zwei
          verschiedene Aussagen: „zurück, wo ich herkam" vs. „Detail zu". */}
      {/* `pb-[5px]`: Luft zwischen Rückweg-Zeile und dem Titel darunter — die zwei
          gehören nicht zusammen, standen aber auf Kante. */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 pt-2 pb-[5px] bg-[var(--tf-bg)]">
        {zurueck ? (
          <RueckwegLink label={zurueck.label} onClick={zurueck.onClick} />
        ) : <span />}
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
          aria-label="Detail schließen"
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-6 pb-8">{children}</div>
    </div>
  );
}
