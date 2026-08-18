/**
 * Die Trefferliste — Textstelle statt Tabellenzelle.
 *
 * Seitenweise nachladen wie die Tabelle
 * ([SearchResultsTable.tsx](src/plugins/suche/SearchResultsTable.tsx)): eine
 * ODER-Anfrage kann tausende Treffer haben, und die Liste rendert je Zeile
 * deutlich mehr DOM als eine Tabellenzeile.
 */
import { useEffect, useRef, useState } from 'react';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { TrefferZeile } from './TrefferZeile';
import type { AntwortBeleg } from './antwort/genannteTreffer';

/** Zeilen je Nachladeschritt. Kleiner als die 80 der Tabelle — eine Listenzeile
 *  ist etwa dreimal so hoch. */
const SEITE = 30;
/** Wie früh nachgeladen wird (Abstand zum unteren Rand). */
const VORLAUF = '600px';

export function TrefferListe({
  treffer,
  woerter,
  varianten,
  kompakt,
  ausgeklappt,
  auswahl,
  laufendeBegruendung,
  onOeffnen,
  onWarum,
  onAehnliche,
  onUnpassend,
  onWaehlen,
  begruendungHinweis,
  mitBegruendung,
  antwortBelege,
  sprungZiel,
}: {
  treffer: readonly UnifiedSearchResult[];
  woerter: readonly string[];
  varianten: readonly string[];
  kompakt: boolean;
  /** Nur zu einer Frage erklärt die KI den Treffer — siehe `TrefferZeile`. */
  mitBegruendung: boolean;
  ausgeklappt: ReadonlySet<string>;
  auswahl: ReadonlySet<string>;
  laufendeBegruendung: ReadonlySet<string>;
  onOeffnen: (t: UnifiedSearchResult) => void;
  onWarum: (t: UnifiedSearchResult) => void;
  onAehnliche: (t: UnifiedSearchResult) => void;
  onUnpassend: (t: UnifiedSearchResult) => void;
  onWaehlen: (t: UnifiedSearchResult) => void;
  /** Steht im aufgeklappten Bereich, wenn keine Begründung kam — der Grund
   *  gehört dorthin, wo der Nutzer sie erwartet hat. */
  begruendungHinweis?: string | null;
  /** Was die Antwortkarte je Kennzeichen sagt, aus ihrem Text abgetrennt. */
  antwortBelege?: ReadonlyMap<string, AntwortBeleg>;
  /** Kennzeichen, zu dem gesprungen werden soll — der Klick in der Antwort. */
  sprungZiel?: { fkz: string; n: number } | null;
}): React.ReactElement {
  const [sichtbar, setSichtbar] = useState(SEITE);
  const [hervorgehoben, setHervorgehoben] = useState<string | null>(null);
  const sentinel = useRef<HTMLLIElement | null>(null);

  // Neue Treffermenge ⇒ wieder oben anfangen. Ohne das behielte eine neue Suche
  // die Nachlade-Höhe der alten und zeigte sofort 300 Zeilen.
  useEffect(() => { setSichtbar(SEITE); }, [treffer]);

  /**
   * Der Sprung aus der Antwortkarte.
   *
   * Die Liste rendert seitenweise — ein in der Antwort genanntes Vorhaben kann
   * auf Position 200 stehen und damit gar nicht im DOM sein. Deshalb wird
   * ZUERST bis zu seiner Zeile nachgeladen und erst danach gescrollt; ohne den
   * ersten Schritt liefe der Sprung ins Leere, und zwar genau bei den weit
   * hinten stehenden Treffern, für die er am nützlichsten ist.
   */
  useEffect(() => {
    if (!sprungZiel) return;
    const ziel = treffer.find(t => t.fkz === sprungZiel.fkz);
    const index = ziel ? treffer.indexOf(ziel) : -1;
    if (!ziel || index < 0) return;
    setSichtbar(n => Math.max(n, index + 1));
    setHervorgehoben(ziel.id);
    // Ein Frame, damit die eben nachgeladene Zeile im DOM steht.
    const rahmen = requestAnimationFrame(() => {
      document.getElementById(`treffer-${ziel.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    // Die Hervorhebung verblasst: ein Zustand, der bliebe, wäre eine Auswahl
    // ohne Bedienelement — und beim nächsten Sprung wüsste niemand, welche der
    // beiden Zeilen gerade gemeint ist.
    const uhr = setTimeout(() => setHervorgehoben(null), 2600);
    return () => { cancelAnimationFrame(rahmen); clearTimeout(uhr); };
  }, [sprungZiel, treffer]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      eintraege => {
        if (eintraege.some(e => e.isIntersecting)) {
          setSichtbar(n => Math.min(treffer.length, n + SEITE));
        }
      },
      { rootMargin: VORLAUF },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [treffer.length, sichtbar]);

  return (
    <ul
      className="overflow-hidden rounded-[10px]"
      style={{ background: 'var(--tf-sheet)', border: '0.5px solid var(--tf-border)' }}
    >
      {treffer.slice(0, sichtbar).map(t => (
        <TrefferZeile
          key={`${t.type}:${t.id}`}
          treffer={t}
          woerter={woerter}
          varianten={varianten}
          kompakt={kompakt}
          ausgeklappt={ausgeklappt.has(t.id)}
          gewaehlt={auswahl.has(t.id)}
          begruendungLaeuft={laufendeBegruendung.has(t.id)}
          hinweis={begruendungHinweis}
          mitBegruendung={mitBegruendung}
          antwortBeleg={t.fkz ? antwortBelege?.get(t.fkz) : undefined}
          hervorgehoben={hervorgehoben === t.id}
          onOeffnen={() => onOeffnen(t)}
          onWarum={() => onWarum(t)}
          onAehnliche={() => onAehnliche(t)}
          onUnpassend={() => onUnpassend(t)}
          onWaehlen={() => onWaehlen(t)}
        />
      ))}
      {sichtbar < treffer.length && (
        <li ref={sentinel} className="px-3 py-3 text-center text-[11.5px] text-[var(--tf-text-tertiary)]">
          {(treffer.length - sichtbar).toLocaleString('de-DE')} weitere …
        </li>
      )}
    </ul>
  );
}
