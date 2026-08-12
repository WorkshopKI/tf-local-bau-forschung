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
}: {
  treffer: readonly UnifiedSearchResult[];
  woerter: readonly string[];
  varianten: readonly string[];
  kompakt: boolean;
  ausgeklappt: ReadonlySet<string>;
  auswahl: ReadonlySet<string>;
  laufendeBegruendung: ReadonlySet<string>;
  onOeffnen: (t: UnifiedSearchResult) => void;
  onWarum: (t: UnifiedSearchResult) => void;
  onAehnliche: (t: UnifiedSearchResult) => void;
  onUnpassend: (t: UnifiedSearchResult) => void;
  onWaehlen: (t: UnifiedSearchResult) => void;
}): React.ReactElement {
  const [sichtbar, setSichtbar] = useState(SEITE);
  const sentinel = useRef<HTMLLIElement | null>(null);

  // Neue Treffermenge ⇒ wieder oben anfangen. Ohne das behielte eine neue Suche
  // die Nachlade-Höhe der alten und zeigte sofort 300 Zeilen.
  useEffect(() => { setSichtbar(SEITE); }, [treffer]);

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
