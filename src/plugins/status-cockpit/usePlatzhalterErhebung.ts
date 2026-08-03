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
import { generationenVon } from '@/core/status/betrachtungsbereich';
import {
  jederVorgang, baueTodoKontext, ermittleTodosAlleRollen, fassePlatzhalterZusammen,
  erhebeBlindeFlecken, erhebeKuerzelKarte, istImBereich, normKey, ladeTrigger,
  type BewerteterVorgang, type BlindeFleckenErhebung, type FleckenFall,
  type KuerzelKarteZeile, type MappingVersion, type PlatzhalterErhebung, type Rolle,
} from '@/core/status';

export interface ErhebungsErgebnis {
  platzhalter: PlatzhalterErhebung;
  flecken: BlindeFleckenErhebung;
  /** Je Rolle die Kürzel-Landkarte — berechnet, sobald sie gebraucht wird. */
  karte: (rolle: Rolle) => KuerzelKarteZeile[];
}

export interface PlatzhalterLauf {
  /** Ergebnis des letzten Laufs; `null`, solange keiner lief. */
  erhebung: ErhebungsErgebnis | null;
  /** Wie der Bereich beim Lauf stand — sonst ist `gesamt` nicht einzuordnen. */
  bereichText: string | null;
  /** ISO des Laufs — gehört auf jedes Blatt des Exports. */
  stichtag: string;
  /** Busy/Fehler/Doppelklick-Schutz kommen aus `useAsyncAction` (Pitfall #15). */
  aktion: UseAsyncActionResult<[]>;
}

export function usePlatzhalterErhebung(version: MappingVersion | null): PlatzhalterLauf {
  const idb = useStorage().idb;
  const bereich = useBereich();
  const stichtagRef = useRef<string>(new Date().toISOString());
  const [erhebung, setErhebung] = useState<ErhebungsErgebnis | null>(null);
  const [bereichText, setBereichText] = useState<string | null>(null);

  const starte = useCallback(async (): Promise<void> => {
    if (!version) return;
    const regeln = version.todoRegeln ?? [];
    const stichtag = stichtagRef.current;
    // EIN Durchgang über den Bestand für alle drei Auswertungen: er ist der
    // teure Teil (Sekunden über 7 000 Vorgänge), das Zusammenfassen danach ist
    // billig. Drei Läufe wären dreimal dieselbe Arbeit.
    const bewertet: BewerteterVorgang[] = [];
    const flecken: FleckenFall[] = [];
    const proCode = new Map<string, number>();
    await jederVorgang(idb, version, ({ aktenzeichen, unterprogrammId, vorkommen }) => {
      if (!istImBereich(unterprogrammId, bereich.menge)) return;
      bewertet.push({
        aktenzeichen,
        todos: ermittleTodosAlleRollen(regeln, baueTodoKontext(vorkommen), stichtag),
      });
      flecken.push({ aktenzeichen, vorkommen });
      for (const v of vorkommen) {
        if (!v.feld.code) continue;
        const k = normKey(v.feld.code);
        proCode.set(k, (proCode.get(k) ?? 0) + 1);
      }
    });

    const trigger = (await ladeTrigger(idb)).datei?.trigger ?? [];
    setErhebung({
      platzhalter: fassePlatzhalterZusammen(bewertet, regeln),
      flecken: erhebeBlindeFlecken(flecken, version, regeln, stichtag),
      karte: (rolle: Rolle) => erhebeKuerzelKarte(version, proCode, trigger, rolle),
    });
    // Der Export wird Monate später gelesen — deshalb die Generationen beim
    // Namen nennen, nicht „letzte 3". Und Programme als Programme zählen: die
    // Liste enthält 12 Programme aus 3 Richtlinien, nicht 12 Richtlinien.
    if (bereich.menge === null) {
      setBereichText('alle Richtlinien');
    } else {
      const zahl = `${bereich.programme.length} Programme`;
      const { jahre, exakt } = generationenVon(bereich.programme);
      const kopf = exakt ? `Richtlinien ${jahre.join(' + ')} · ${zahl}` : zahl;
      setBereichText(`${kopf} (${bereich.programme.join(', ')})`);
    }
  }, [idb, version, bereich.menge, bereich.programme]);

  return {
    erhebung, bereichText, stichtag: stichtagRef.current, aktion: useAsyncAction(starte),
  };
}
