/**
 * Die Probe am echten Fall: „und was passiert bei **diesem** Vorgang?"
 *
 * Das ist die Frage, die im Termin ständig gestellt wird, und sie war bisher nur
 * über den Umweg Antragssuche → Detailseite zu beantworten — mit gewechseltem
 * Kontext und ohne den Entwurf, an dem gerade gearbeitet wird. Hier läuft sie
 * gegen die Regeln, die im Editor stehen.
 *
 * **Ausgewertet wird nichts nachgebaut.** Das `TodoErgebnis` kommt fertig aus
 * der Engine und wird von denselben Bausteinen angezeigt wie am Antrag
 * (`TodoAnzeige.tsx`). Ein eigener Herleitungs-Pfad liefe beim ersten Sonderfall
 * auseinander.
 *
 * Ein Durchgang über den Bestand je Probe — derselbe Preis wie bei den anderen
 * Läufen, und derselbe Grund für den Knopf. Der Betrachtungsbereich ist ein
 * expliziter Parameter (Pitfall #46): ein Aktenzeichen außerhalb wird als solches
 * benannt, nicht als „unbekannt" ausgegeben.
 */
import { useCallback, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useBereich } from '@/core/hooks/useBereich';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import {
  jederVorgang, baueTodoKontext, ermittleTodo, istImBereich, normKey,
  type MappingVersion, type Rolle, type TodoErgebnis,
} from '@/core/status';

/** Warum die Probe nichts liefert — die beiden Fälle sind NICHT dasselbe. */
export type ProbeLeer = 'unbekannt' | 'ausserhalb';

export interface ProbeErgebnis {
  aktenzeichen: string;
  ergebnis: TodoErgebnis;
  /** Der Regelsatz, gegen den geprüft wurde — gehört an jede Aussage. */
  rolle: Rolle;
}

export interface ProbeLauf {
  /** Ergebnis der letzten Probe; `null`, solange keine lief oder keine traf. */
  treffer: ProbeErgebnis | null;
  /** Wenn nichts traf: warum. */
  leer: ProbeLeer | null;
  aktion: UseAsyncActionResult<[string]>;
}

export function useRegelProbelauf(version: MappingVersion | null, rolle: Rolle): ProbeLauf {
  const idb = useStorage().idb;
  const bereich = useBereich();
  const stichtagRef = useRef<string>(new Date().toISOString());
  const [treffer, setTreffer] = useState<ProbeErgebnis | null>(null);
  const [leer, setLeer] = useState<ProbeLeer | null>(null);

  const starte = useCallback(async (eingabe: string): Promise<void> => {
    setTreffer(null);
    setLeer(null);
    if (!version) return;
    const gesucht = normKey(eingabe);
    if (!gesucht) return;
    const regeln = version.todoRegeln ?? [];
    const stichtag = stichtagRef.current;

    // `jederVorgang` kennt keinen Abbruch — das ist in Ordnung: der Durchgang
    // kostet dasselbe wie jeder andere Lauf hier, und ein zweiter Datenweg für
    // einen Einzelfall wäre eine zweite Quelle für dieselbe Frage.
    let gefunden: ProbeErgebnis | null = null;
    let ausserhalb = false;
    await jederVorgang(idb, version, ({ aktenzeichen, unterprogrammId, vorkommen }) => {
      if (gefunden || normKey(aktenzeichen) !== gesucht) return;
      if (!istImBereich(unterprogrammId, bereich.menge)) { ausserhalb = true; return; }
      gefunden = {
        aktenzeichen,
        rolle,
        ergebnis: ermittleTodo(regeln, baueTodoKontext(vorkommen), stichtag, { rolle }),
      };
    });

    if (gefunden) setTreffer(gefunden);
    else setLeer(ausserhalb ? 'ausserhalb' : 'unbekannt');
  }, [idb, version, rolle, bereich.menge]);

  return { treffer, leer, aktion: useAsyncAction(starte) };
}
