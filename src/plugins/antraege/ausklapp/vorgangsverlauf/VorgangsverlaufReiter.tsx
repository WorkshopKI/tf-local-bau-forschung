/**
 * Der Reiter **Vorgangsverlauf** — drei Blöcke auf dieselben Daten.
 *
 * Bis v3.43 stand hier allein die Fristrechnung. Sie beantwortet „warum diese
 * Zahl", nicht „was ist wann passiert" — und trägt deshalb genau zwei
 * Feldkürzel, die beiden Kandidaten für das maßgebliche Datum. Wer den Reiter
 * wegen seines Namens öffnete, fand darin keinen Verlauf.
 *
 * Jetzt in dieser Reihenfolge:
 *
 * 1. **Chronik** — die Termine aus den Datumsfeldern, dieselbe Ansicht wie auf
 *    der Verbund-Detailseite. Bewusst dieselbe {@link StatusChronik} und nicht
 *    eine zweite, kompaktere: zwei Renderer über denselben Daten wären zwei
 *    Wahrheiten, und die Zeile hier soll zeigen, was der Nutzer dort kennt.
 * 2. **Ohne Termin** — die Codes, die der Export nur als Wert führt. Ohne sie
 *    gäbe sich die Chronik für vollständiger aus, als sie ist.
 * 3. **Fristrechnung** — unverändert, nur mit Überschrift, damit sie nicht als
 *    Teil der Chronik gelesen wird.
 *
 * **Der Ausklapp persistiert nichts** (`ausklappZustand.ts`), auch nicht den
 * Schalter „Nebensächliches": er hängt an einem lokalen `useState`, nicht an
 * `useTimelinePrefs`. Sonst schriebe das Aufklappen einer Tabellenzeile die
 * Voreinstellung der Detailseite um.
 */
import { useMemo, useState } from 'react';
import type { FeldVorkommen, MappingVersion } from '@/core/status';
import { StatusChronik } from '../../status/StatusChronik';
import { VorgangsRaster } from './VorgangsRaster';
import { OhneDatumBlock } from './OhneDatumBlock';
import { baueOhneDatum } from './ohneDatum';
import type { VorgangsverlaufModell } from './vorgangsverlaufModell';

/**
 * Höhendeckel der Chronik-Liste im Ausklapp.
 *
 * Gemessen im Bestand (12 357 ANB-Zeilen): Median **22** Termine je Vorgang,
 * p90 = 31, max 47 — bei ~29 px je Zeile also 640 px im Regelfall und 1 350 px
 * im Extrem, in einer Tabellenzeile bei 720–900 px Bildschirmhöhe. 320 px zeigt
 * gut zehn Zeilen; der Zähler darüber bleibt stehen und sagt, wie viele es
 * insgesamt sind. Auf der Detailseite bleibt die Chronik ungedeckelt — dort ist
 * sie die Seite, nicht eine Zeile darin.
 */
const CHRONIK_MAX_HOEHE = 320;

export interface VorgangsverlaufReiterProps {
  modell: VorgangsverlaufModell;
  /** Wechselt auf den Zeitverlauf; `null` = es gibt keinen (Flag aus). */
  onZeitverlauf: (() => void) | null;
  /** Die Statuseinträge DIESER Zeile — Verbundzeile: alle Teilvorhaben. */
  vorkommen: readonly FeldVorkommen[];
  /** `null` = keine Fassung geladen; dann bleiben Chronik und Wertblock weg. */
  version: MappingVersion | null;
}

function Abschnitt({ titel, children }: {
  titel: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="uppercase tracking-wider text-[11px] text-[var(--tf-text-tertiary)]">
        {titel}
      </span>
      {children}
    </div>
  );
}

export function VorgangsverlaufReiter({
  modell, onZeitverlauf, vorkommen, version,
}: VorgangsverlaufReiterProps): React.ReactElement {
  const [zeigeNebensaechlich, setZeigeNebensaechlich] = useState(false);
  const ohneDatum = useMemo(() => baueOhneDatum(vorkommen), [vorkommen]);

  return (
    <div className="flex flex-col gap-4">
      {version !== null && (
        <Abschnitt titel="Chronik">
          <StatusChronik
            vorkommen={vorkommen}
            version={version}
            zeigeNebensaechlich={zeigeNebensaechlich}
            onToggleNebensaechlich={() => setZeigeNebensaechlich(v => !v)}
            maxHoehe={CHRONIK_MAX_HOEHE}
          />
        </Abschnitt>
      )}

      {ohneDatum.length > 0 && (
        <Abschnitt titel="Ohne Termin im Export">
          <OhneDatumBlock eintraege={ohneDatum} />
        </Abschnitt>
      )}

      <Abschnitt titel="Wie die Bearbeitungsfrist zustande kommt">
        <VorgangsRaster modell={modell} onZeitverlauf={onZeitverlauf} />
      </Abschnitt>
    </div>
  );
}
