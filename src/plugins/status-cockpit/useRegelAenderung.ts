/**
 * Was der Entwurf gegenüber der aktiven Fassung am Bestand ändern würde.
 *
 * Regeln sind nach dem Veröffentlichen sofort für alle scharf — die Datei liegt
 * auf dem Daten-Share. Diese Zahl steht deshalb neben dem Speichern-Knopf und
 * nicht irgendwo im Editor: sie ist das Letzte, was man vor dem Verteilen wissen
 * will.
 *
 * **Ein Durchgang, zwei Auswertungen.** Der Bestandslauf ist der teure Teil; die
 * Engine zweimal über denselben Kontext laufen zu lassen kostet fast nichts. Zwei
 * getrennte Durchgänge wären dieselbe Arbeit doppelt — und schlimmer: sie
 * könnten auf unterschiedlichen Ständen laufen.
 *
 * Gemessen, nicht geschätzt (siehe `regel-aenderung.ts`). Kein Blockieren des
 * Speicherns: die Zahl davor, die Entscheidung beim Menschen.
 */
import { useCallback, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useBereich } from '@/core/hooks/useBereich';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import {
  jederVorgang, baueTodoKontext, ermittleTodo, istImBereich, vergleicheFassungen,
  type AenderungsBilanz, type MappingVersion, type Rolle, type VerglichenerVorgang,
} from '@/core/status';

export interface AenderungsLauf {
  bilanz: AenderungsBilanz | null;
  /** Wie der Bereich beim Lauf stand — sonst ist `gesamt` nicht einzuordnen. */
  bereichText: string | null;
  aktion: UseAsyncActionResult<[]>;
}

export function useRegelAenderung(
  aktiv: MappingVersion | null, entwurf: MappingVersion | null, rolle: Rolle,
): AenderungsLauf {
  const idb = useStorage().idb;
  const bereich = useBereich();
  const stichtagRef = useRef<string>(new Date().toISOString());
  const [bilanz, setBilanz] = useState<AenderungsBilanz | null>(null);
  const [bereichText, setBereichText] = useState<string | null>(null);

  const starte = useCallback(async (): Promise<void> => {
    if (!entwurf) return;
    const alteRegeln = aktiv?.todoRegeln ?? [];
    const neueRegeln = entwurf.todoRegeln ?? [];
    const stichtag = stichtagRef.current;

    const verglichen: VerglichenerVorgang[] = [];
    // Der Bestand wird über den ENTWURF aufgeschlossen (Feld-Auflösung, Schemas).
    // Zwei verschiedene Fassungen für die Datenbeschaffung zu nehmen hieße, den
    // Vergleich auf zwei verschiedenen Grundmengen zu führen.
    await jederVorgang(idb, entwurf, ({ aktenzeichen, unterprogrammId, vorkommen }) => {
      if (!istImBereich(unterprogrammId, bereich.menge)) return;
      const ctx = baueTodoKontext(vorkommen);
      verglichen.push({
        aktenzeichen,
        vorher: ermittleTodo(alteRegeln, ctx, stichtag, { rolle }),
        nachher: ermittleTodo(neueRegeln, ctx, stichtag, { rolle }),
      });
    });

    setBilanz(vergleicheFassungen(verglichen));
    setBereichText(bereich.menge === null
      ? 'alle Richtlinien'
      : `${bereich.programme.length} Programme (${bereich.programme.join(', ')})`);
  }, [idb, aktiv, entwurf, rolle, bereich.menge, bereich.programme]);

  return { bilanz, bereichText, aktion: useAsyncAction(starte) };
}
