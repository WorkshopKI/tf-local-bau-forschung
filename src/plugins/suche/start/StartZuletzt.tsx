/**
 * Reiter „Zuletzt" — der Wiedereinstieg.
 *
 * Drei Gruppen, die alle von der Person selbst kommen: was zuletzt gesucht
 * wurde, was sich im Verlauf hält, was gemerkt ist. Sie standen bis v4.72 als
 * drei gleich große Spalten nebeneinander, obwohl zwei davon aus DERSELBEN
 * Verlaufsliste stammen und die dritte bei den meisten leer ist („Noch nichts
 * gemerkt." als halbe Seitenbreite).
 *
 * „Häufig gesucht" steht deshalb hier und nicht beim Stöbern: es ist eigener
 * Verlauf, keine Eigenschaft des Bestands.
 */
import { Bookmark, Clock, TrendingUp } from 'lucide-react';
import { veraenderungText, type GespeicherteSuche } from '../gespeicherteSuchen';
import { FussSatz, MehrZeile, Spalte, trefferText, Zeile } from './StartBausteine';

export interface StartEintrag {
  query: string;
  /** Trefferzahl aus dem Probelauf. `null` = nicht ermittelbar. */
  treffer: number | null;
}

export function StartZuletzt({
  letzte,
  haeufig,
  gespeichert,
  gespeicherteTreffer,
  onSuche,
  onEntferneLetzte,
  onEntferneGespeicherte,
  max,
  onMehr,
}: {
  letzte: readonly StartEintrag[];
  haeufig: readonly StartEintrag[];
  gespeichert: readonly GespeicherteSuche[];
  gespeicherteTreffer: ReadonlyMap<string, number>;
  onSuche: (query: string) => void;
  onEntferneLetzte: (query: string) => void;
  onEntferneGespeicherte: (id: string) => void;
  /** Im Kurzformat des Reiters „Alle" gesetzt — dort zählt nur der Anfang. */
  max?: number;
  onMehr?: () => void;
}): React.ReactElement {
  const kurz = max !== undefined;
  const gesamt = letzte.length + haeufig.length + gespeichert.length;
  const letzteSicht = kurz ? letzte.slice(0, max) : letzte;
  const restNachLetzte = kurz ? Math.max(0, max - letzteSicht.length) : Number.MAX_SAFE_INTEGER;
  const gespeichertSicht = kurz ? gespeichert.slice(0, restNachLetzte) : gespeichert;

  return (
    <div className="flex flex-col gap-5">
      <Spalte titel="Zuletzt gesucht" leer="Noch nichts gesucht.">
        {letzteSicht.map(e => (
          <Zeile
            key={e.query}
            icon={<Clock size={12} aria-hidden />}
            text={e.query}
            rechts={trefferText(e.treffer)}
            onClick={() => onSuche(e.query)}
            onEntfernen={() => onEntferneLetzte(e.query)}
            titel={`„${e.query}" suchen`}
          />
        ))}
      </Spalte>

      {/* Im Kurzformat entfällt die Gruppe: sie ist die zweite Hälfte derselben
          Liste und stünde direkt unter ihrem eigenen Anfang. */}
      {!kurz && haeufig.length > 0 && (
        <Spalte titel="Häufig gesucht">
          {haeufig.map(e => (
            <Zeile
              key={e.query}
              icon={<TrendingUp size={12} aria-hidden />}
              text={e.query}
              rechts={trefferText(e.treffer)}
              onClick={() => onSuche(e.query)}
              titel={`„${e.query}" suchen`}
            />
          ))}
        </Spalte>
      )}

      {gespeichertSicht.length > 0 && (
        <Spalte titel="Gemerkt">
          {gespeichertSicht.map(g => {
            const aktuell = gespeicherteTreffer.get(g.id) ?? null;
            const diff = veraenderungText(g, aktuell);
            return (
              <Zeile
                key={g.id}
                icon={<Bookmark size={12} aria-hidden />}
                text={g.name}
                rechts={
                  <>
                    {diff && <span className="mr-2 text-[var(--tf-success-text)]">{diff}</span>}
                    {trefferText(aktuell)}
                  </>
                }
                onClick={() => onSuche(g.query)}
                onEntfernen={() => onEntferneGespeicherte(g.id)}
                titel={`„${g.query}" suchen`}
              />
            );
          })}
        </Spalte>
      )}

      {kurz && onMehr && gesamt > letzteSicht.length + gespeichertSicht.length && (
        <MehrZeile text={`alle ${gesamt.toLocaleString('de-DE')} ansehen`} onClick={onMehr} />
      )}

      {/* Ein Satz statt einer leeren Spalte: dass man Suchen merken kann, ist
          eine Information — eine halbe Seitenbreite „Noch nichts gemerkt." ist
          keine. */}
      {!kurz && gespeichert.length === 0 && (
        <FussSatz>
          Gemerkt ist noch nichts — nach einer Suche steht oben „Diese Suche speichern".
        </FussSatz>
      )}
    </div>
  );
}
