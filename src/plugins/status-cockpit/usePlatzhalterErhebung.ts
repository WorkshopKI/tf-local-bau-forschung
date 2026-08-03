/**
 * Zählt die **abgeleiteten Platzhalter** im Bestand — auf Knopfdruck, nicht beim
 * Öffnen.
 *
 * Der Lauf geht über alle Vorgänge des Betrachtungsbereichs und kostet Sekunden.
 * Ihn beim Tab-Wechsel zu starten, hieße den Regel-Editor jedes Mal einfrieren zu
 * lassen, obwohl die Zahl nur für den FB-Termin gebraucht wird. Ein Knopf ist
 * hier ehrlicher als eine Automatik.
 *
 * Der Betrachtungsbereich ist ein **expliziter Parameter** (Pitfall #46) — er
 * kommt aus dem Hook und steht in der Ausgabe, damit die Zahl einzuordnen ist.
 */
import { useCallback, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useBereich } from '@/core/hooks/useBereich';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import {
  jederVorgang, baueTodoKontext, ermittleTodosAlleRollen, fassePlatzhalterZusammen,
  istImBereich,
  type BewerteterVorgang, type MappingVersion, type PlatzhalterErhebung,
} from '@/core/status';

export interface PlatzhalterLauf {
  /** Ergebnis des letzten Laufs; `null`, solange keiner lief. */
  erhebung: PlatzhalterErhebung | null;
  /** Wie der Bereich beim Lauf stand — sonst ist `gesamt` nicht einzuordnen. */
  bereichText: string | null;
  /** Busy/Fehler/Doppelklick-Schutz kommen aus `useAsyncAction` (Pitfall #15). */
  aktion: UseAsyncActionResult<[]>;
}

export function usePlatzhalterErhebung(version: MappingVersion | null): PlatzhalterLauf {
  const idb = useStorage().idb;
  const bereich = useBereich();
  const stichtagRef = useRef<string>(new Date().toISOString());
  const [erhebung, setErhebung] = useState<PlatzhalterErhebung | null>(null);
  const [bereichText, setBereichText] = useState<string | null>(null);

  const starte = useCallback(async (): Promise<void> => {
    if (!version) return;
    const regeln = version.todoRegeln ?? [];
    const bewertet: BewerteterVorgang[] = [];
    await jederVorgang(idb, version, ({ aktenzeichen, unterprogrammId, vorkommen }) => {
      if (!istImBereich(unterprogrammId, bereich.menge)) return;
      bewertet.push({
        aktenzeichen,
        todos: ermittleTodosAlleRollen(regeln, baueTodoKontext(vorkommen), stichtagRef.current),
      });
    });
    setErhebung(fassePlatzhalterZusammen(bewertet, regeln));
    setBereichText(bereich.menge === null
      ? 'alle Richtlinien'
      : `${bereich.programme.length} Richtlinien (${bereich.programme.join(', ')})`);
  }, [idb, version, bereich.menge, bereich.programme]);

  return { erhebung, bereichText, aktion: useAsyncAction(starte) };
}
