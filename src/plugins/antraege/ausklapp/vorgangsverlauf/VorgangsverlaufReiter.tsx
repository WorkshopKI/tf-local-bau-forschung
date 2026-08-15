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
 * **Die Chronik steht offen, aber im Ausschnitt; die beiden anderen Blöcke sind
 * zu.** Hier wird eine Tabellenzeile aufgeklappt, um schnell zu sehen, was mit
 * dem Antrag los ist — dafür zeigt die Chronik ihre {@link FENSTER} jüngsten
 * Zeilen, mit einem Schalter darüber, der die Zahl der älteren ansagt. Einen
 * Scrollbereich bekommt sie weiterhin nicht: ein Kasten, in dem zehn von 22
 * Terminen stehen, ohne dass es jemand sagt, liest sich als der ganze Verlauf.
 * Die volle Geschichte steht hinter dem Schalter und auf der Detailseite.
 *
 * **Der Ausklapp persistiert nichts** (`ausklappZustand.ts`) — weder die beiden
 * Klapp-Zustände noch „Nebensächliches" noch das aufgeklappte Fenster: alle
 * hängen an lokalem `useState`, nicht an `useTimelinePrefs`. Sonst schriebe das
 * Aufklappen einer Tabellenzeile die Voreinstellung der Detailseite um.
 */
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  baueChronik, baueZurueckgenommene, verlaufKennzahlen,
  type AntragsChronikMitId, type FeldVorkommen, type MappingVersion,
  type OffenesPaarJeTv,
} from '@/core/status';
import { StatusChronik } from '../../status/StatusChronik';
import { JournalNullpunkt } from '../../status/JournalNullpunkt';
import { VerlaufKennzahlenZeile } from '../../status/VerlaufKennzahlenZeile';
import { VorgangsRaster } from './VorgangsRaster';
import { OhneDatumBlock } from './OhneDatumBlock';
import { baueOhneDatum } from './ohneDatum';
import type { VorgangsverlaufModell } from './vorgangsverlaufModell';

export interface VorgangsverlaufReiterProps {
  modell: VorgangsverlaufModell;
  /** Wechselt auf den Zeitverlauf; `null` = es gibt keinen (Flag aus). */
  onZeitverlauf: (() => void) | null;
  /** Die Statuseinträge DIESER Zeile — Verbundzeile: alle Teilvorhaben. */
  vorkommen: readonly FeldVorkommen[];
  /** `null` = keine Fassung geladen; dann bleiben Chronik und Wertblock weg. */
  version: MappingVersion | null;
  /** Halb offene Kürzel-Paare der Teilvorhaben DIESER Zeile — fertig gerechnet. */
  offenePaare?: readonly OffenesPaarJeTv[];
  /** Journal-Chroniken der Teilvorhaben dieser Zeile; `null` = kein Journal. */
  chroniken?: readonly AntragsChronikMitId[] | null;
  /** Nullpunkt des Journals — gehört unter jede Chronik (§12.2). */
  journalAb?: string | null;
  /** `true`, solange gelesen wird; dann ist `chroniken === null` kein Befund. */
  journalLaden?: boolean;
  /**
   * Aktenzeichen → laufende Nummer, über den GANZEN Verbund gebaut (`tvAchse`).
   * Damit tragen die Träger-Marken hier dieselbe Beschriftung wie auf der
   * Detailseite; ohne sie fallen sie auf die Endung des Aktenzeichens zurück.
   */
  tvNummern?: ReadonlyMap<string, number>;
  /** Anzahl Teilvorhaben des Verbunds — für „alle N". */
  tvGesamt?: number;
}

/**
 * Wie viele Chronik-Zeilen dieser Wirt zuerst zeigt.
 *
 * **Acht.** Gemessen über 13 090 Vorgänge trägt die Chronik im Median 22
 * Termine, p90 32 — bei 19 px Zeilenhöhe 500–700 px, die sich zwischen Kopfkarte
 * und Fristblock in eine aufgeklappte Tabellenzeile schieben. Wer eine Zeile
 * aufklappt, fragt „was ist zuletzt passiert"; die ganze Geschichte steht einen
 * Klick weiter — hier über den Schalter, sonst auf der Detailseite.
 */
const FENSTER = 8;

const EYEBROW = 'uppercase tracking-wider text-[11px] text-[var(--tf-text-tertiary)]';

function Abschnitt({ titel, children }: {
  titel: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={EYEBROW}>{titel}</span>
      {children}
    </div>
  );
}

/**
 * Abschnitt, der zugeklappt anfängt — für alles, was man **nachschlägt**, statt
 * es beim Aufklappen der Zeile lesen zu wollen.
 *
 * Der `hinweis` steht im geschlossenen Zustand und sagt, was drinsteckt; ohne
 * ihn wäre die Überschrift eine Tür ohne Schild. Inhalt wird bei „zu" nicht
 * gerendert — diese Blöcke haben keinen Zustand, den ein Unmount verlöre.
 */
function KlappAbschnitt({ titel, hinweis, children }: {
  titel: string; hinweis?: string; children: React.ReactNode;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        aria-expanded={offen}
        className="flex w-full items-center gap-1.5 cursor-pointer text-left"
      >
        <ChevronRight
          size={11}
          aria-hidden="true"
          className="shrink-0 text-[var(--tf-text-tertiary)] transition-transform duration-150"
          style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className={EYEBROW}>{titel}</span>
        {hinweis !== undefined && (
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">{hinweis}</span>
        )}
      </button>
      {offen && children}
    </div>
  );
}

export function VorgangsverlaufReiter({
  modell, onZeitverlauf, vorkommen, version, offenePaare = [],
  chroniken = null, journalAb = null, journalLaden = false, tvNummern, tvGesamt,
}: VorgangsverlaufReiterProps): React.ReactElement {
  const [zeigeNebensaechlich, setZeigeNebensaechlich] = useState(false);
  // Wie die beiden Klappblöcke darunter: `useState`, nicht `useTimelinePrefs`.
  // Der Ausklapp persistiert nichts — sonst schriebe das Aufklappen einer
  // Tabellenzeile die Voreinstellung der Detailseite um.
  const [alleZeigen, setAlleZeigen] = useState(false);
  const ohneDatum = useMemo(() => baueOhneDatum(vorkommen), [vorkommen]);

  /** Termine, die der Export nicht mehr führt — dieselbe Ableitung wie auf der Detailseite. */
  const zurueckgenommene = useMemo(() => (
    chroniken === null || !version ? [] : baueZurueckgenommene(
      chroniken, version.felder,
      baueChronik(vorkommen, { zeigeNebensaechlich: true }),
      { zeigeNebensaechlich },
    )
  ), [chroniken, version, vorkommen, zeigeNebensaechlich]);

  // Die Kennzahlen kommen aus derselben reinen Funktion wie auf der
  // Detailseite. Wie viele Teilvorhaben der Verbund führt, weiß der Ausklapp
  // nicht — er bekommt die Vorkommen SEINER Zeile —, also zählt er die Träger,
  // die in den Terminen vorkommen, statt eine Zahl zu erfinden.
  const kennzahlen = useMemo(() => {
    const chronik = baueChronik(vorkommen, { zeigeNebensaechlich });
    const traeger = new Set(chronik.flatMap(e => e.tvIds));
    return verlaufKennzahlen(chronik, offenePaare, traeger.size, zurueckgenommene);
  }, [vorkommen, zeigeNebensaechlich, offenePaare, zurueckgenommene]);

  return (
    <div className="flex flex-col gap-4">
      {version !== null && (
        <Abschnitt titel="Chronik">
          {/* Keine Filterleiste und keine Matrix: fünf Datumsspalten passen
              nicht in einen Tabellen-Ausklapp, und auf einer TV-Zeile hätte die
              Matrix genau eine Spalte. Hier steht der Hergang.

              Die Kennzahlen bleiben ungefenstert — sie sagen die Größe des
              VORGANGS an, nicht die der Darstellung. Genau das macht den
              Ausschnitt darunter lesbar: „16 Schritte" oben, acht Zeilen unten
              und ein Schalter, der die Differenz benennt. */}
          <VerlaufKennzahlenZeile kennzahlen={kennzahlen} />
          <StatusChronik
            vorkommen={vorkommen}
            version={version}
            zeigeNebensaechlich={zeigeNebensaechlich}
            onToggleNebensaechlich={() => setZeigeNebensaechlich(v => !v)}
            offenePaare={offenePaare}
            zurueckgenommene={zurueckgenommene}
            fenster={{
              anzahl: FENSTER,
              offen: alleZeigen,
              onUmschalten: () => setAlleZeigen(a => !a),
            }}
            {...(tvNummern ? { tvNummern } : {})}
            {...(tvGesamt !== undefined ? { tvGesamt } : {})}
          />
          <JournalNullpunkt journalAb={journalAb} chroniken={chroniken} laden={journalLaden} />
        </Abschnitt>
      )}

      {ohneDatum.length > 0 && (
        <KlappAbschnitt
          titel="Ohne Termin im Export"
          hinweis={`${ohneDatum.length} ${ohneDatum.length === 1 ? 'Eintrag' : 'Einträge'}`}
        >
          <OhneDatumBlock eintraege={ohneDatum} />
        </KlappAbschnitt>
      )}

      <KlappAbschnitt titel="Wie die Bearbeitungsfrist zustande kommt">
        <VorgangsRaster modell={modell} onZeitverlauf={onZeitverlauf} />
      </KlappAbschnitt>
    </div>
  );
}
