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
import { ArrowLeft, X } from 'lucide-react';
import { rueckwegSatz } from '@/core/nav/rueckwegSatz';

/**
 * Rahmen einer Werkstatt-Sektion: Trennstrich nach oben + Sprung-Anker.
 *
 * `empty:hidden` (siehe Modulkopf) blendet den Rahmen aus, sobald die Sektion
 * nichts rendert — inklusive Marge und Padding, weil `display: none` beides
 * mitnimmt.
 */
export function Sektionsrahmen({ id, children }: {
  id: string;
  children: React.ReactNode;
}): React.ReactElement {
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
 * Panel-Hülle des Details: Rückweg links, Schließen rechts, darunter der Inhalt.
 *
 * Der Rückweg sagt seine Aussage aus („Zurück zum Vorgangs-Board"); die Herkunft
 * liefert dazu nur den NAMEN der Seite, die Fügung kommt aus `rueckwegSatz`
 * (im Deutschen entscheidet das Wort über den Artikel: „zur Suche", „zu den
 * Dokumenten"). Er stand bis
 * v4.82 als 12,5-px-Sekundärtext hier und wurde übersehen — der einzige Weg
 * zurück zu einer Trefferliste, in Hint-Größe. Jetzt Brotkrumen-Gewicht:
 * Primärfarbe, 13,5 px, normale Strichstärke (der volle Satz trägt sich selbst,
 * halbfett drängte er sich vor den Titel darunter), mit einer Hover-Fläche als
 * echtes Klickziel.
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
          <button
            type="button"
            onClick={zurueck.onClick}
            className="-ml-1.5 inline-flex items-center gap-1.5 rounded-[7px] px-1.5 py-1 text-[13.5px] font-normal text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
          >
            <ArrowLeft size={15} aria-hidden /> {rueckwegSatz(zurueck.label)}
          </button>
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
