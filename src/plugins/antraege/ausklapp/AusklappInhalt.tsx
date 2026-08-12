/**
 * Der Inhalt des aufgeklappten Bereichs: **Kopfkarte, zwei Reiter, ein Panel**.
 *
 * Die Reihenfolge ist die des Entwurfs und zugleich die Reihenfolge der Fragen:
 * *Wie weit über der Frist? · Woran hängt es? · Was ist zu tun?* — und darunter
 * der Nachweis, in Zahlen (Vorgangsverlauf) oder auf einer Achse (Zeitverlauf).
 *
 * **Die Karte steht über beiden Reitern**, nicht in einem. Sie beantwortet die
 * Frage, wegen der jemand aufklappt; der Reiter darunter beantwortet nur, warum
 * die Antwort stimmt.
 *
 * Alles Gerechnete kommt fertig herein — hier wird nur zusammengesetzt.
 */
import { useMemo } from 'react';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { offenePaareJeTeilvorhaben, type WaechterErgebnis } from '@/core/status';
import { KopfAktionen } from './kopfkarte/KopfAktionen';
import { KopfKarte } from './kopfkarte/KopfKarte';
import { baueKopfModell } from './kopfkarte/kopfkarteModell';
import { findeBlocker } from './kopfkarte/blocker';
import { liegtBei } from './kopfkarte/liegtBei';
import { baueAufgabe } from './kopfkarte/aufgabe';
import type { ZeilenTodo } from './useZeilenTodo';
import { baueStufen, type MeilensteinLage } from './meilensteinLage';
import { VorgangsverlaufReiter } from './vorgangsverlauf/VorgangsverlaufReiter';
import { baueVorgangsverlauf } from './vorgangsverlauf/vorgangsverlaufModell';
import { ZeitverlaufReiter } from './zeitverlauf/ZeitverlaufReiter';
import type { ReiterId } from './ausklappZustand';
import type { ZeilenVerlauf } from './useZeilenVerlauf';

export interface AusklappInhaltProps {
  zeilenKey: string;
  verbundId: string | null;
  istVerbundZeile: boolean;
  daten: ZeilenVerlauf;
  waechter: WaechterErgebnis | null;
  /** Die To-do-Auswertung der Zeile — Aufgabe und Adresse. */
  todo: ZeilenTodo;
  /** Zieltage des laufenden Schritts aus dem Statuskatalog. */
  zieltage: number | null;
  haengtFest: { art: 'verbund' | 'tv'; id: string } | null;
  stichtag: string;
  reiter: ReiterId;
  onReiter: (r: ReiterId) => void;
  /** Ist der Zeitverlauf gebaut (`vorgangssystem`)? */
  zeitverlaufAn: boolean;
  lage: MeilensteinLage;
  melden: (knotenId: string, text: string, tage?: number) => Promise<void>;
  nurLokal: boolean;
}

export function AusklappInhalt({
  zeilenKey, verbundId, istVerbundZeile, daten, waechter, todo, zieltage, haengtFest,
  stichtag, reiter, onReiter, zeitverlaufAn, lage, melden, nurLokal,
}: AusklappInhaltProps): React.ReactElement {
  const stufen = useMemo(() => baueStufen(lage), [lage]);
  const befund = useMemo(() => findeBlocker(lage, stichtag), [lage, stichtag]);
  // Ohne Vorgangssystem gibt es die Kaskade in dieser Variante nicht — dann
  // steht keine Aufgaben-Zeile da, und „Liegt bei" nennt genau diesen Grund.
  const aufgabe = useMemo(
    () => (zeitverlaufAn ? baueAufgabe(todo) : null),
    [zeitverlaufAn, todo],
  );
  const zustaendig = useMemo(
    () => liegtBei({
      waechter,
      vorgangssystemAn: zeitverlaufAn,
      aufgabe: {
        ohneRegeln: todo.ohneRegeln,
        uneinig: todo.adresse.uneinig,
        herkunft: todo.adresse.todo?.beschreibung ?? todo.adresse.todo?.regelId ?? null,
      },
    }),
    [waechter, zeitverlaufAn, todo],
  );
  const kopf = useMemo(
    () => (daten.frist === null ? null : baueKopfModell({
      bezug: daten.frist, stichtag, waechter, lage, befund, liegtBei: zustaendig,
    })),
    [daten.frist, stichtag, waechter, lage, befund, zustaendig],
  );
  const raster = useMemo(
    () => (daten.frist === null
      ? null
      : baueVorgangsverlauf({ bezug: daten.frist, zieltage, waechter })),
    [daten.frist, zieltage, waechter],
  );
  // Die halb offenen Kürzel-Paare der Chronik — über `daten.jeTeilvorhaben`,
  // also genau die Teilvorhaben, die DIESE Zeile trägt. Über `daten.vorkommen`
  // gerechnet zeigte eine Verbundzeile zu wenig und eine TV-Zeile Fremdes.
  const offenePaare = useMemo(
    () => (daten.quelle.version === null
      ? []
      : offenePaareJeTeilvorhaben(daten.quelle.version, daten.jeTeilvorhaben, stichtag)),
    [daten.quelle.version, daten.jeTeilvorhaben, stichtag],
  );

  const aktiv: ReiterId = zeitverlaufAn ? reiter : 'vorgangsverlauf';
  const fassung = daten.quelle.version === null ? null : `Fassung ${daten.quelle.version.version}`;

  if (daten.quelle.laden) {
    return <p className="text-[11px] text-[var(--tf-text-tertiary)]">Lädt …</p>;
  }
  if (kopf === null || raster === null) {
    return (
      <p className="text-[11px] text-[var(--tf-text-tertiary)]">Kein Statuskatalog geladen.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <KopfKarte
        modell={kopf}
        befund={befund}
        aufgabe={aufgabe}
        aktionen={(
          <KopfAktionen
            zeilenKey={zeilenKey}
            verbundId={verbundId}
            lage={lage}
            {...(befund.blocker !== null ? { blockerKnotenId: befund.blocker.knotenId } : {})}
            melden={melden}
            nurLokal={nurLokal}
            spuren={daten.spuren}
            fassung={fassung}
            journalAb={daten.journalAb}
            bezugsZeitpunkt={daten.bezugsZeitpunkt}
            zeitverlaufAn={zeitverlaufAn}
          />
        )}
      />

      {zeitverlaufAn && (
        <SegmentedToggle<ReiterId>
          value={aktiv}
          onChange={onReiter}
          ariaLabel="Nachweis"
          options={[
            { id: 'vorgangsverlauf', label: 'Vorgangsverlauf' },
            { id: 'zeitverlauf', label: 'Zeitverlauf' },
          ]}
        />
      )}

      {aktiv === 'vorgangsverlauf' ? (
        // Der Deckel gegen unlesbar lange Zeilen sitzt am Fließtext, nicht am
        // Bereich: die Bahn im Zeitverlauf ist eine Grafik und will jeden Pixel.
        <div className="max-w-[820px]">
          <VorgangsverlaufReiter
            modell={raster}
            onZeitverlauf={zeitverlaufAn ? () => onReiter('zeitverlauf') : null}
            vorkommen={daten.vorkommen}
            version={daten.quelle.version}
            offenePaare={offenePaare}
          />
        </div>
      ) : (
        <ZeitverlaufReiter
          spuren={daten.spuren}
          eigenes={zeilenKey}
          istVerbundZeile={istVerbundZeile}
          journalAb={daten.journalAb}
          journalGenutzt={daten.journalGenutzt}
          laden={daten.laden}
          bezugsZeitpunkt={daten.bezugsZeitpunkt}
          stichtag={stichtag}
          fassung={fassung}
          haengtFest={haengtFest}
          lage={lage}
          stufen={stufen}
          befund={befund}
        />
      )}
    </div>
  );
}
