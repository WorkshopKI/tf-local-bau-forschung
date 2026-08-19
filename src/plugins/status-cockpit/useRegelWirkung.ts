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
  /**
   * Je Regel-Id die gemessenen Zahlen; `null`, solange kein Lauf stattfand —
   * **und ebenso, solange ein anderer Regelsatz gezeigt wird als der gemessene**
   * (siehe {@link WirkungsLauf.gemessenerSatz}).
   */
  wirkung: ReadonlyMap<string, RegelWirkung> | null;
  /**
   * Der Regelsatz, unter dem gemessen wurde; `null` ohne Lauf.
   *
   * Gehört an jede Zahl. Am Bild gemessen: nach einem AB-Lauf und einem Klick
   * auf die FB-Pille stand über den AB-Zahlen „12.359 Vorgänge gemessen · …
   * Regelsatz **FB**" — die Kopfzeile nannte den gewählten Satz, die Zahlen
   * kamen aus dem anderen.
   */
  gemessenerSatz: Rolle | null;
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
  const [gemessenerSatz, setGemessenerSatz] = useState<Rolle | null>(null);

  const regeln = useMemo(() => version?.todoRegeln ?? [], [version]);
  // Gegen den GEMESSENEN Satz, nicht gegen den gewählten: sonst meldete jeder
  // Pillen-Klick „Regeln seit dem Lauf geändert" und nannte damit einen Grund,
  // den es nicht gab.
  const jetzige = useMemo(
    () => (gemessenerSatz === null
      ? null
      : wirkungsSignatur(regeln, stichtagRef.current, gemessenerSatz).wert),
    [regeln, gemessenerSatz],
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
    setGemessenerSatz(rolle);
    setSignatur(wirkungsSignatur(alle, stichtag, rolle).wert);
    if (bereich.menge === null) {
      setBereichText('alle Richtlinien');
    } else {
      const zahl = zaehlwort(bereich.programme.length, 'Programm', 'Programme');
      const { jahre, exakt } = generationenVon(bereich.programme);
      setBereichText(exakt ? `Richtlinien ${jahre.join(' + ')} · ${zahl}` : zahl);
    }
  }, [idb, version, rolle, bereich.menge, bereich.programme]);

  // Die Zahlen eines fremden Satzes werden NICHT gezeigt: sie wären je Regel
  // schlicht falsch (eine Sperre greift unter einer anderen Rolle anders), und
  // ein Vermerk daneben machte sie nicht richtiger.
  const fremderSatz = gemessenerSatz !== null && gemessenerSatz !== rolle;
  return {
    wirkung: fremderSatz ? null : wirkung,
    gemessenerSatz,
    gesamt,
    bereichText,
    stichtag: stichtagRef.current,
    veraltet: !fremderSatz && signatur !== null && signatur !== jetzige,
    aktion: useAsyncAction(starte),
  };
}
