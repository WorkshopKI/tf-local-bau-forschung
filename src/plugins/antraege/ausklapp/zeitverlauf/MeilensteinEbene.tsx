/**
 * Die **Meilenstein-Ebene** auf der Band-Achse — reine Anzeige.
 *
 * Punkt = erreicht (am Ist-Datum), schraffierter Balken = gerissen (vom Soll
 * bis zum Achsenende), rechts daneben Nummer und Verzugstage. Die Schraffur ist
 * kein Schmuck: eine deckende Fläche läse sich wie ein Abschnitt der Bahn
 * darüber, die Schraffur sagt „das läuft noch".
 *
 * **Was fehlt, wird benannt.** Marken außerhalb der Achse und eine angehaltene
 * Uhr stehen als Satz darunter, nicht als stilles Weglassen.
 */
import { MS_BAHN_H, MS_BALKEN_H, MS_PUNKT, type MsEbeneModell } from './msEbene';

/** Die Schraffur des Verzugs — Token-basiert, damit sie im dunklen Modus mitläuft. */
const SCHRAFFUR = 'repeating-linear-gradient(115deg, var(--tf-danger-text) 0 4px,'
  + ' color-mix(in srgb, var(--tf-danger-text) 45%, var(--tf-bg)) 4px 8px)';

export function MeilensteinEbene({ modell, hervorgehoben, onHover }: {
  modell: MsEbeneModell;
  /** Nummern, die gerade hervorgehoben sind (Hover in der Gliederung). */
  hervorgehoben: (nummer: string) => boolean;
  /** Hover auf einer Marke — koppelt zurück in die Gliederung. */
  onHover: (nummer: string | null) => void;
}): React.ReactElement {
  return (
    <>
      {modell.marken.map(m => {
        const oben = m.bahn * MS_BAHN_H + 2;
        const hell = hervorgehoben(m.nummer);
        const umriss = hell
          ? { outline: '2px solid var(--tf-primary)', outlineOffset: 2 }
          : undefined;
        if (m.art === 'erreicht') {
          return (
            <span
              key={m.knotenId}
              title={m.titel}
              onMouseEnter={() => onHover(m.nummer)}
              onMouseLeave={() => onHover(null)}
              className="absolute rounded-full"
              style={{
                left: m.links,
                top: oben + (MS_BAHN_H - MS_PUNKT) / 2,
                width: MS_PUNKT,
                height: MS_PUNKT,
                background: 'var(--tf-success-text)',
                border: '1.5px solid var(--tf-bg)',
                ...umriss,
              }}
            />
          );
        }
        return (
          <span
            key={m.knotenId}
            title={m.titel}
            onMouseEnter={() => onHover(m.nummer)}
            onMouseLeave={() => onHover(null)}
            className="absolute flex items-center"
            style={{ left: m.links, top: oben + (MS_BAHN_H - MS_BALKEN_H) / 2, height: MS_BALKEN_H }}
          >
            <span
              className="rounded-[2px]"
              style={{ width: m.breite, height: MS_BALKEN_H, background: SCHRAFFUR, ...umriss }}
            />
            <span className="ml-1.5 whitespace-nowrap font-mono text-[10px] leading-none text-[var(--tf-danger-text)]">
              {m.text}
            </span>
          </span>
        );
      })}
    </>
  );
}

/** Was die Ebene nicht zeigen konnte — als eigener Satz, nie als Schweigen. */
export function MeilensteinEbeneFuss({ modell }: { modell: MsEbeneModell }): React.ReactElement | null {
  const teile: string[] = [];
  if (modell.ausserhalb > 0) {
    teile.push(modell.ausserhalb === 1
      ? 'Eine Stufe liegt außerhalb der Achse und ist nicht gezeichnet.'
      : `${modell.ausserhalb} Stufen liegen außerhalb der Achse und sind nicht gezeichnet.`);
  }
  if (modell.hinweis !== null) teile.push(modell.hinweis);
  if (teile.length === 0) return null;
  return (
    <p className="text-[11px] text-[var(--tf-text-tertiary)]">{teile.join(' ')}</p>
  );
}
