/**
 * Misst, was jede To-do-Regel am Bestand tut — **auf Knopfdruck**, nicht beim
 * Öffnen und schon gar nicht beim Tippen.
 *
 * Derselbe Grund wie bei `usePlatzhalterErhebung`: der Lauf geht über alle
 * Vorgänge des Betrachtungsbereichs und kostet Sekunden. Ihn an den Tab-Wechsel
 * oder an jede Bedingungs-Änderung zu hängen, hieße den Regel-Editor einfrieren
 * zu lassen. Ein Knopf ist hier ehrlicher als eine Automatik.
 *
 * **Veraltung statt Neuberechnung.** Wird nach einem Lauf umsortiert, eine Regel
 * bearbeitet oder stillgelegt, sind die Zahlen nicht mehr gültig — sie werden
 * dann als veraltet gekennzeichnet und nicht still weiterbenutzt. Automatisch
 * neu zu rechnen wäre die teure Antwort auf eine Frage, die niemand gestellt
 * hat.
 *
 * Der Betrachtungsbereich ist ein **expliziter Parameter** (Pitfall #46) — er
 * kommt aus dem Hook und steht in der Ausgabe, damit die Zahl einzuordnen ist.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useBereich } from '@/core/hooks/useBereich';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { generationenVon } from '@/core/status/betrachtungsbereich';
import { zaehlwort } from '@/core/utils/zaehlwort';
import {
  jederVorgang, baueTodoKontext, ermittleTodo, erhebeRegelWirkung, wirkungsSignatur,
  istImBereich,
  type BewerteterLauf, type MappingVersion, type RegelWirkung, type Rolle,
} from '@/core/status';

export interface WirkungsLauf {
  /** Je Regel-Id die gemessenen Zahlen; `null`, solange kein Lauf stattfand. */
  wirkung: ReadonlyMap<string, RegelWirkung> | null;
  /** Wie viele Vorgänge der Lauf ausgewertet hat — ohne sie ist keine Zahl einzuordnen. */
  gesamt: number;
  /** Wie der Bereich beim Lauf stand. */
  bereichText: string | null;
  /** ISO des Laufs. */
  stichtag: string;
  /**
   * Haben sich die Regeln seit dem Lauf geändert? Dann gelten die Zahlen als
   * „Stand vor der letzten Änderung" und werden gekennzeichnet, nicht verworfen:
   * eine Größenordnung von vorhin ist mehr wert als gar keine, solange dransteht,
   * dass sie von vorhin ist.
   */
  veraltet: boolean;
  /** Busy/Fehler/Doppelklick-Schutz aus `useAsyncAction` (Pitfall #15). */
  aktion: UseAsyncActionResult<[]>;
}

export function useRegelWirkung(version: MappingVersion | null, rolle: Rolle): WirkungsLauf {
  const idb = useStorage().idb;
  const bereich = useBereich();
  const stichtagRef = useRef<string>(new Date().toISOString());
  const [wirkung, setWirkung] = useState<ReadonlyMap<string, RegelWirkung> | null>(null);
  const [gesamt, setGesamt] = useState(0);
  const [bereichText, setBereichText] = useState<string | null>(null);
  const [signatur, setSignatur] = useState<string | null>(null);

  const regeln = useMemo(() => version?.todoRegeln ?? [], [version]);
  const jetzige = useMemo(
    () => wirkungsSignatur(regeln, stichtagRef.current, rolle).wert,
    [regeln, rolle],
  );

  const starte = useCallback(async (): Promise<void> => {
    if (!version) return;
    const alle = version.todoRegeln ?? [];
    const stichtag = stichtagRef.current;
    const laeufe: BewerteterLauf[] = [];
    await jederVorgang(idb, version, ({ aktenzeichen, unterprogrammId, vorkommen }) => {
      if (!istImBereich(unterprogrammId, bereich.menge)) return;
      // EIN Engine-Lauf je Vorgang. Sieger und `weitereTreffer` liefern beide
      // Zahlen; ein zweiter Durchgang für „trifft zu" wäre ein zweiter
      // Evaluator (siehe `regel-wirkung.ts`).
      laeufe.push({
        aktenzeichen,
        ergebnis: ermittleTodo(alle, baueTodoKontext(vorkommen), stichtag, { rolle }),
      });
    });

    setWirkung(erhebeRegelWirkung(laeufe, alle));
    setGesamt(laeufe.length);
    setSignatur(wirkungsSignatur(alle, stichtag, rolle).wert);
    if (bereich.menge === null) {
      setBereichText('alle Richtlinien');
    } else {
      const zahl = zaehlwort(bereich.programme.length, 'Programm', 'Programme');
      const { jahre, exakt } = generationenVon(bereich.programme);
      setBereichText(exakt ? `Richtlinien ${jahre.join(' + ')} · ${zahl}` : zahl);
    }
  }, [idb, version, rolle, bereich.menge, bereich.programme]);

  return {
    wirkung,
    gesamt,
    bereichText,
    stichtag: stichtagRef.current,
    veraltet: signatur !== null && signatur !== jetzige,
    aktion: useAsyncAction(starte),
  };
}
