/**
 * Die Fundstelle im Suchtreffer auszeichnen.
 *
 * Zerlegt wird in der reinen
 * [markierung.ts](src/core/services/search/markierung.ts); hier wird nur
 * gerendert. Zwei Farben, zwei Aussagen: gelb = so getippt, türkis = über den
 * Wortstamm dazugekommen.
 *
 * Zwei Wege hinein, weil es zwei Ansichten gibt:
 *
 *  - `SuchMarkierung` bekommt die Wörter als Prop — die Trefferliste hat sie
 *    ohnehin zur Hand.
 *  - `MarkierterText` holt sie aus dem Kontext. Die Tabelle rendert ihre Zellen
 *    über `SearchColumn.render(row)`, eine Signatur ohne Platz für Suchwörter
 *    (sie liegt im geteilten `SortableColumn`-Vertrag). Bis v4.15.0 blieb die
 *    Tabelle deshalb unmarkiert: dieselbe Suche, zwei Ansichten, nur eine mit
 *    sichtbarer Fundstelle. Der Kontext schließt die Lücke, ohne die Signatur
 *    für alle Tabellen der App aufzubohren.
 *
 * Ohne Provider ist der Kontext leer und `MarkierterText` gibt den Text
 * unverändert aus — kein Sonderfall an den Aufrufstellen.
 */
import { createContext, useContext, useMemo } from 'react';
import { markiereText } from '@/core/services/search/markierung';

export function SuchMarkierung({ text, wortlaut, aehnlich = [] }: {
  text: string;
  wortlaut: readonly string[];
  aehnlich?: readonly string[];
}): React.ReactElement {
  return (
    <>
      {markiereText(text, wortlaut, aehnlich).map((s, i) => {
        if (s.art === null) return <span key={i}>{s.text}</span>;
        return (
          <mark
            key={i}
            className="rounded-[3px] px-0.5 text-[var(--tf-text)]"
            style={{
              background: s.art === 'wortlaut'
                ? 'var(--tf-highlight)'
                : 'var(--tf-highlight-aehnlich)',
            }}
          >
            {s.text}
          </mark>
        );
      })}
    </>
  );
}

interface MarkierWoerter {
  /** So getippt — gelb. */
  wortlaut: readonly string[];
  /** Über den Wortstamm dazugekommen — türkis. */
  aehnlich: readonly string[];
}

const LEER: MarkierWoerter = { wortlaut: [], aehnlich: [] };

const SuchMarkierungKontext = createContext<MarkierWoerter>(LEER);

/** Stellt die Suchwörter für alle `MarkierterText` darunter bereit. */
export function SuchMarkierungProvider({ wortlaut, aehnlich, children }: {
  wortlaut: readonly string[];
  aehnlich: readonly string[];
  children: React.ReactNode;
}): React.ReactElement {
  // Der Wert MUSS memoisiert sein: ein frisches Objekt je Render würde jeden
  // `MarkierterText` in der Tabelle neu rendern — bei 80 Zeilen sind das ein
  // paar hundert Komponenten pro Tastendruck, und die `memo`-Hülle der Tabelle
  // hilft dagegen nicht (Kontext-Konsumenten rendern durch sie hindurch).
  const wert = useMemo(() => ({ wortlaut, aehnlich }), [wortlaut, aehnlich]);
  return (
    <SuchMarkierungKontext.Provider value={wert}>
      {children}
    </SuchMarkierungKontext.Provider>
  );
}

/** Text mit markierten Fundstellen — Wörter aus dem Kontext. */
export function MarkierterText({ text }: { text: string }): React.ReactElement {
  const { wortlaut, aehnlich } = useContext(SuchMarkierungKontext);
  if (wortlaut.length === 0 && aehnlich.length === 0) return <>{text}</>;
  return <SuchMarkierung text={text} wortlaut={wortlaut} aehnlich={aehnlich} />;
}
