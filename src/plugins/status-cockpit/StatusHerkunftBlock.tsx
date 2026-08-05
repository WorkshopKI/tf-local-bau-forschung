/**
 * „Wodurch dieser Status entsteht" — die Trigger-Tabelle von der anderen Seite.
 *
 * Am Antrag beantwortet die Herleitung „warum steht DIESER Vorgang hier". Hier
 * steht die umgekehrte Frage, und sie ist im Termin die häufigere: Das
 * Fachsystem liefert zu einem Status nur die Bezeichnung — welche Kürzel ihn
 * setzen, sagt allein die Trigger-Tabelle. Damit wird „wie grenzen sich 31, 33
 * und 34 ab?" belegbar statt Auslegungssache.
 *
 * **Nur lesend.** Trigger werden hier nicht bearbeitet; sie sind Fremddaten aus
 * der Zuarbeit und werden unter „Referenzdaten" eingelesen.
 *
 * Reine Anzeige: Auswahl, Bündelung und Satzbau macht `trigger-herkunft.ts`,
 * die Zeichen-Erklärungen `trigger-erklaerung.ts`. Hier wird kein Satz gebaut —
 * sonst wäre die Darstellung in der node-only Testumgebung nicht prüfbar.
 */
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ErklaerterSatz } from '@/plugins/antraege/status/ErklaerterSatz';
import {
  baueLegende, erklaerKatalog, herkunftZuStatus, richtlinienSatz,
  type HerkunftEbene, type MappingVersion, type TriggerStand,
} from '@/core/status';
import { zaehlwort } from '@/core/utils/zaehlwort';

const UEBERSCHRIFT = 'Wodurch dieser Status entsteht';
const labelKlasse = 'text-[11px] uppercase tracking-wide text-[var(--tf-text-tertiary)]';
const leiseKlasse = 'text-[11.5px] text-[var(--tf-text-tertiary)]';

/** Was der Weg setzt — ausgeschrieben, damit „TV" niemanden raten lässt. */
const EBENE_TEXT: Record<HerkunftEbene, string> = {
  TV: 'setzt den Teilvorhaben-Status',
  VB: 'setzt den Verbund-Status',
  beides: 'setzt Teilvorhaben- und Verbund-Status',
  unbekannt: 'Ebene der Bezugsdatei nicht gedeutet',
};

function Rahmen({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <section className="flex flex-col gap-1.5 pt-1 border-t border-[var(--tf-border)]">
      <h4 className={labelKlasse}>{UEBERSCHRIFT}</h4>
      {children}
    </section>
  );
}

export function StatusHerkunftBlock({ code, version, trigger }: {
  code: number;
  version: MappingVersion;
  trigger: TriggerStand;
}): React.ReactElement {
  const zeilen = trigger.datei?.trigger ?? [];
  const herkunft = useMemo(
    () => herkunftZuStatus(zeilen, code, erklaerKatalog(version), baueLegende(version.textbausteine)),
    [zeilen, code, version],
  );

  // Drei Zustände, drei Antworten. „Keine Trigger-Tabelle" und „kein Weg" sehen
  // gleich aus, wenn man sie gleich behandelt — der eine ist aber eine fehlende
  // Datei und der andere ein Befund.
  if (trigger.datei === null) {
    return (
      <Rahmen>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          Die Trigger-Tabelle ist nicht eingelesen. Sie steht unter{' '}
          <strong>Referenzdaten</strong> auf dieser Seite — ohne sie lässt sich nicht sagen,
          welche Kürzel diesen Status setzen.
        </p>
      </Rahmen>
    );
  }

  if (herkunft.gruppen.length === 0) {
    return (
      <Rahmen>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          Die Trigger-Tabelle kennt keinen Weg zu diesem Status.
        </p>
        <p className={leiseKlasse}>
          Das ist eine Aussage, kein Fehler: der Wert wird dann von Hand gesetzt oder stammt
          aus einer Richtlinie, deren Trigger nicht in der Zuarbeit stehen.
        </p>
      </Rahmen>
    );
  }

  return (
    <Rahmen>
      <p className={leiseKlasse}>
        {zaehlwort(herkunft.gruppen.length, 'Kürzel setzt', 'Kürzel setzen')} diesen Status
        {herkunft.programme.length > 0 && `, ${richtlinienSatz(herkunft.programme)}`}.
      </p>

      <ul className="flex flex-col gap-2">
        {herkunft.gruppen.map(g => (
          <li key={g.kuerzel} className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="font-mono text-[12px] text-[var(--tf-text)]">{g.kuerzel}</span>
              <span className="text-[12.5px] text-[var(--tf-text)]">{g.label}</span>
              {/* Leere Rollen heißen „von jedem zu setzen", nie „von niemandem"
                  (Pitfall #43) — `rollenText` liefert dafür „alle". */}
              <span className={leiseKlasse}>· {g.rollenText}</span>
              {g.unbekannt && <Badge variant="warning">nicht im Kürzel-Katalog</Badge>}
            </span>

            {g.wirkungen.map((w, i) => (
              <div key={i} className="pl-3 flex flex-col gap-0.5">
                <span className="text-[12px] leading-[1.35] text-[var(--tf-text-secondary)]">
                  <ErklaerterSatz segmente={w.segmente} />
                </span>
                <span className={leiseKlasse}>
                  {EBENE_TEXT[w.ebene]}
                  {w.programme.length > 0 && ` · ${richtlinienSatz(w.programme)}`}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </Rahmen>
  );
}
