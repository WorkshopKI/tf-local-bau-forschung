/**
 * Die Befunde für die AB-Runde — auf Knopfdruck, ein Durchgang über den Bestand.
 *
 * Derselbe Grund wie bei den anderen Erhebungen: der Lauf kostet Sekunden, und
 * er wird nicht bei jedem Tab-Wechsel gebraucht, sondern vor einem Termin. Ein
 * Knopf ist hier ehrlicher als eine Automatik.
 *
 * **Warum ein Knopf und kein Wegwerf-Skript**: der Bestand liegt in der
 * Browser-IDB, `jederVorgang` ist aus einem Node-Vitest nicht erreichbar, und
 * eine Node-Fixture des Echtbestands gibt es nicht. Der Knopf ist damit nicht
 * bequemer, sondern der einzige Weg an die Zahlen — und die PreCheck-Lücke und
 * die Feldpflege sind Fragen, die nach jedem Import erneut anstehen.
 *
 * Der Betrachtungsbereich ist ein **expliziter Parameter** (Pitfall #46) und
 * steht in der Ausgabe, damit die Zahl einzuordnen ist.
 */
import { useCallback, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useBereich } from '@/core/hooks/useBereich';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { generationenVon } from '@/core/status/betrachtungsbereich';
import { zaehlwort } from '@/core/utils/zaehlwort';
import {
  jederVorgang, baueTodoKontext, ermittleTodo, erhebeTerminBefunde, istImBereich, todoFeld,
  REGELSATZ_DEFAULT,
  type MappingVersion, type TerminBefunde, type TerminFall,
} from '@/core/status';

/** Der Status, dessen PreCheck-Lücke gemessen wird: 34 „bearbeitungsreif". */
export const BEFUND_STATUS_CODE = 34;
/** Die Regel, deren Verdecker gesucht werden: R8 „RNE versandt, Frist läuft". */
export const BEFUND_REGEL_ID = 'r8';

export interface TerminLauf {
  befunde: TerminBefunde | null;
  /** Wie der Bereich beim Lauf stand — sonst ist `gesamt` nicht einzuordnen. */
  bereichText: string | null;
  stichtag: string;
  aktion: UseAsyncActionResult<[]>;
}

export function useTerminErhebung(version: MappingVersion | null): TerminLauf {
  const idb = useStorage().idb;
  const bereich = useBereich();
  const stichtagRef = useRef<string>(new Date().toISOString());
  const [befunde, setBefunde] = useState<TerminBefunde | null>(null);
  const [bereichText, setBereichText] = useState<string | null>(null);

  const starte = useCallback(async (): Promise<void> => {
    if (!version) return;
    const regeln = version.todoRegeln ?? [];
    const stichtag = stichtagRef.current;

    const faelle: TerminFall[] = [];
    await jederVorgang(idb, version, ({ aktenzeichen, unterprogrammId, record, vorkommen }) => {
      if (!istImBereich(unterprogrammId, bereich.menge)) return;
      faelle.push({
        aktenzeichen,
        statusRoh: record.status,
        vbPhaseRoh: record.vb_phase,
        vorkommen,
        // Ausgewertet wird der AB-Satz: R8 trägt keinen eigenen `regelsatz`,
        // unter einer fremden Rolle überspränge der Treffer-Pass sie ganz.
        ergebnis: ermittleTodo(regeln, baueTodoKontext(vorkommen), stichtag, {
          rolle: REGELSATZ_DEFAULT,
        }),
      });
    });

    setBefunde(erhebeTerminBefunde(faelle, {
      statusCode: BEFUND_STATUS_CODE,
      // Spaltennamen über `todoFeld()`, nie als `D_`-Literal (Pitfall #44).
      precheckFelder: [todoFeld('PC+'), todoFeld('XPC+')],
      paare: [
        { feldId: todoFeld('AVK'), vergleichFeldId: todoFeld('VV') },
        { feldId: todoFeld('AAR'), vergleichFeldId: todoFeld('VV') },
      ],
      regelId: BEFUND_REGEL_ID,
    }));

    if (bereich.menge === null) {
      setBereichText('alle Richtlinien');
    } else {
      const zahl = zaehlwort(bereich.programme.length, 'Programm', 'Programme');
      const { jahre, exakt } = generationenVon(bereich.programme);
      setBereichText(exakt ? `Richtlinien ${jahre.join(' + ')} · ${zahl}` : zahl);
    }
  }, [idb, version, bereich.menge, bereich.programme]);

  return {
    befunde, bereichText, stichtag: stichtagRef.current, aktion: useAsyncAction(starte),
  };
}
