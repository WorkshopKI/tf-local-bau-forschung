/**
 * Der **Bestandslauf des Haltedatums** — was die dritte Quelle wirklich ändert.
 *
 * Dieselbe Bauform wie `useVerlaufErhebung`, aus demselben Grund: `jederVorgang`
 * liegt in der Browser-IDB, aus einem Node-Vitest nicht erreichbar, und eine
 * Node-Fixture des Echtbestands gibt es nicht.
 *
 * **Der Lauf rechnet jeden Vorgang ZWEIMAL** — einmal ohne, einmal mit der
 * Verlaufsquelle — und stellt beides gegenüber. Ohne diesen Doppellauf wäre
 * jede Zahl eine Behauptung über einen Zustand, den niemand mehr sehen kann.
 *
 * **Die Zustandsmatrix muss diagonal sein.** `berechneFrist` liest das
 * Haltedatum erst IM `angehalten`-Zweig, nachdem der Zustand feststeht; die
 * neue Quelle kann ihn also nicht bewegen. Eine Zahl außerhalb der Diagonale
 * ist deshalb kein Erfolg, sondern ein Fehler — sie wird gezählt, damit sie
 * auffällt, statt weggelassen zu werden.
 *
 * Der Betrachtungsbereich ist ein **expliziter Parameter** (Pitfall #46) und
 * steht in der Ausgabe.
 */
import { useCallback, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useBereich } from '@/core/hooks/useBereich';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { generationenVon } from '@/core/status/betrachtungsbereich';
import { zaehlwort } from '@/core/utils/zaehlwort';
import { findeStatusCode, jederVorgang, istImBereich, ladeTrigger, type MappingVersion } from '@/core/status';
import { fristFuerVorkommen } from '@/core/status/frist-bezug';
import type { HaltedatumQuelle } from '@/core/status/haltedatum';
import type { FristZustand } from '@/core/services/csv/frist-ergebnis';
import type { VerlaufsBezug, VerlaufsBezugTv } from '@/core/status/verlauf';
import { baueVerlaufFuerVorgang } from '@/core/status/verlauf/fuer-vorgang';
import { haltedatumAusSpuren } from '@/core/status/verlauf/haltedatum-aus-verlauf';
import {
  leereFristBefunde, nimmFristAuf, type FristBefunde,
} from './fristErhebung';

export interface FristLauf {
  befunde: FristBefunde | null;
  bereichText: string | null;
  dauerMs: number | null;
  stichtag: string;
  aktion: UseAsyncActionResult<[]>;
}

interface Gepuffert extends VerlaufsBezugTv {
  programm: string;
}

export function useFristErhebung(version: MappingVersion | null): FristLauf {
  const idb = useStorage().idb;
  const bereich = useBereich();
  const stichtagRef = useRef<string>(new Date().toISOString().slice(0, 10));
  const [befunde, setBefunde] = useState<FristBefunde | null>(null);
  const [bereichText, setBereichText] = useState<string | null>(null);
  const [dauerMs, setDauerMs] = useState<number | null>(null);

  const starte = useCallback(async (): Promise<void> => {
    if (!version) return;
    const begonnen = performance.now();
    const stand = await ladeTrigger(idb);
    const trigger = stand.datei?.trigger ?? [];

    const jeVerbund = new Map<string, Gepuffert[]>();
    await jederVorgang(idb, version, ({ aktenzeichen, unterprogrammId, verbundId, record, vorkommen }) => {
      if (!istImBereich(unterprogrammId, bereich.menge)) return;
      const schluessel = verbundId ?? `einzel:${aktenzeichen}`;
      const eintrag: Gepuffert = {
        aktenzeichen, statusTvRoh: record.status, vorkommen,
        vbPhaseRoh: record.vb_phase, programm: String(unterprogrammId ?? ''),
      };
      const liste = jeVerbund.get(schluessel);
      if (liste) liste.push(eintrag); else jeVerbund.set(schluessel, [eintrag]);
    });

    const bilanz = leereFristBefunde();
    const stichtag = stichtagRef.current;
    for (const [schluessel, tvs] of jeVerbund) {
      const erstes = tvs[0];
      if (!erstes) continue;
      const alleVorkommen = tvs.flatMap(t => t.vorkommen);
      const statusVbRoh = erstes.vorkommen.find(v => v.feld.feldId === 'verbund_status')?.wert ?? '';

      // Ohne die neue Quelle — der Stand vor v3.30.
      const vorher = fristFuerVorkommen(version, alleVorkommen, statusVbRoh, stichtag);

      // Erster Verlaufslauf mit dem STICHTAG: `baueUebergaenge` braucht den
      // Bezugszeitpunkt nicht, die Kanten sind also dieselben wie im
      // endgültigen Lauf. Genau darauf steht die zweistufige Auflösung.
      const bezug: VerlaufsBezug = {
        verbundId: schluessel.startsWith('einzel:') ? null : schluessel,
        statusVbRoh,
        vbPhaseRoh: erstes.vbPhaseRoh,
        programm: erstes.programm || null,
        bezugsZeitpunkt: stichtag,
        teilvorhaben: tvs,
      };
      const spuren = baueVerlaufFuerVorgang(bezug, version, trigger, null);
      const code = findeStatusCode(statusVbRoh)?.eintrag.code ?? null;
      const halt = haltedatumAusSpuren(
        spuren, 'verbund', bezug.verbundId ?? '', code,
      );
      const nachher = fristFuerVorkommen(
        version, alleVorkommen, statusVbRoh, stichtag, { verlauf: halt },
      );
      nimmFristAuf(bilanz, vorher.ergebnis, nachher.ergebnis, schluessel, halt?.kuerzel ?? null);
    }

    setBefunde(bilanz);
    setDauerMs(Math.round(performance.now() - begonnen));
    if (bereich.menge === null) {
      setBereichText('alle Richtlinien');
    } else {
      const zahl = zaehlwort(bereich.programme.length, 'Programm', 'Programme');
      const { jahre, exakt } = generationenVon(bereich.programme);
      setBereichText(exakt ? `Richtlinien ${jahre.join(' + ')} · ${zahl}` : zahl);
    }
  }, [idb, version, bereich.menge, bereich.programme]);

  return {
    befunde, bereichText, dauerMs,
    stichtag: stichtagRef.current, aktion: useAsyncAction(starte),
  };
}

export type { FristBefunde, FristZustand, HaltedatumQuelle };
