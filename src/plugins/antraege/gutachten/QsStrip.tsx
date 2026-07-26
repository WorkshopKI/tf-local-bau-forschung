/**
 * Abschnitts-QS direkt unter dem bewerteten Text: einklappbarer Block mit
 * „n von m Kriterien ok" im Kopf, je Nicht-ok-Kriterium eine Zeile, und Klick
 * springt an die referenzierten Sätze.
 *
 * Der Sprung nutzt den BESTEHENDEN Fundstellen-Mechanismus der Karte
 * (`data-satz-index` + Scroll/Highlight) — kein zweiter Highlight-Pfad, keine
 * eigene Satz-Zerlegung. Seit v2.337 ist das die einzige QS-Anzeige; das rechte
 * Kontext-Panel zeigt sie nicht mehr doppelt.
 */
import { AmpelGruppe } from './AmpelGruppe';
import { QsHinweisList } from './QsHinweisList';
import { qsKriterienStand } from './abschnittAnzeige';
import type { QsAbnahme, QsBefund } from './types';

export function QsStrip({
  befunde, abnahme, satzAnzahl, onZeigeSatz,
}: {
  befunde: QsBefund[];
  abnahme?: QsAbnahme;
  /** Satzzahl des LIVE-Textes — begrenzt veraltete Referenzen nach einer Bearbeitung. */
  satzAnzahl: number;
  onZeigeSatz: (satzIndex: number) => void;
}): React.ReactElement | null {
  if (befunde.length === 0 && !abnahme) return null;
  const { ok, gesamt } = qsKriterienStand(befunde);
  const summary = gesamt > 0
    ? `${ok} von ${gesamt} ${gesamt === 1 ? 'Kriterium' : 'Kriterien'} ok`
    : 'noch keine Befunde';
  const level = befunde.some(b => b.bewertung !== 'ok') ? 'hinweis' : 'ok';

  return (
    <div className="g-qsstrip">
      <AmpelGruppe
        label="Abschnitts-QS"
        level={level}
        summary={summary}
        count={gesamt}
        defaultOpen={level !== 'ok'}
      >
        {abnahme?.veraltet && (
          <div className="g-qs-veraltet">
            Stand vor der letzten Änderung — der Text wurde seither bearbeitet.
          </div>
        )}
        <QsHinweisList befunde={befunde} satzAnzahl={satzAnzahl} onZeigeSatz={onZeigeSatz} />
      </AmpelGruppe>
    </div>
  );
}
