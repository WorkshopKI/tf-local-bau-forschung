/**
 * Die Fundstelle im Listeneintrag auszeichnen.
 *
 * **Warum überhaupt.** Die Suche greift auch auf Text, der in der Liste gar nicht
 * steht (Erklärung, Spaltenname, Ordner). Ohne Markierung steht dann ein Treffer
 * da, dem man nicht ansieht, warum er einer ist — und daneben einer, dem man es
 * ansähe, wenn man hinschauen dürfte.
 *
 * Die Zerlegung macht `markiere()` in der reinen `glossarSuche.ts`; hier wird nur
 * gerendert. Trifft nichts, kommt genau ein Segment zurück und die Zeile ist
 * Zeichen für Zeichen die alte.
 */
import { markiere, type Suchbegriff } from './glossarSuche';

export function Markiert({ text, begriff }: {
  text: string;
  begriff: Suchbegriff;
}): React.ReactElement {
  return (
    <>
      {markiere(text, begriff).map((s, i) => (
        s.treffer
          ? (
            <mark
              key={i}
              className="rounded-[3px] bg-[var(--tf-primary-light)] px-0.5 text-[var(--tf-primary)]"
            >
              {s.text}
            </mark>
          )
          : <span key={i}>{s.text}</span>
      ))}
    </>
  );
}
