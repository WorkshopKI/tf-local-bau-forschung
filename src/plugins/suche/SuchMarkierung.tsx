/**
 * Die Fundstelle im Suchtreffer auszeichnen.
 *
 * Zerlegt wird in der reinen
 * [markierung.ts](src/core/services/search/markierung.ts); hier wird nur
 * gerendert. Zwei Farben, zwei Aussagen: gelb = so getippt, türkis = über den
 * Wortstamm dazugekommen.
 */
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
