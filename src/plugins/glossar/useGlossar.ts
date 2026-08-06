/**
 * Was das Glossar zur Laufzeit lädt: die geltende Katalog-Fassung, die
 * Trigger-Tabelle und die Vorkommen im Bestand.
 *
 * Bewusst logikfrei — Suche, Gruppierung und Zeilenmodell liegen in
 * `glossarSuche` und `glossarZeilen`. Hier steht nur, was ohne Browser nicht
 * geht.
 *
 * **Fehlt etwas, ist das kein Fehler, sondern eine Auskunft.** Ohne
 * Vorgangssystem gibt es keine Fassung (`version === null`), ohne Import keine
 * Trigger-Tabelle. Beides sagt die Seite an der Stelle, an der es fehlt — die
 * Abkürzungen stehen weiterhin da.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getAktiveVersion, ladeAktiveVersion, ladeTrigger, ladeVorkommen,
  type MappingVersion, type TriggerStand, type VorkommenStand,
} from '@/core/status';

export interface GlossarDaten {
  /** `null` = kein Katalog geladen (ohne Vorgangssystem der Normalfall). */
  version: MappingVersion | null;
  /** `datei === null` = Trigger-Tabelle nicht importiert. */
  trigger: TriggerStand | null;
  /** `null`, solange der Bestands-Durchlauf läuft oder er gescheitert ist. */
  vorkommen: VorkommenStand | null;
  laden: boolean;
}

export function useGlossar(): GlossarDaten {
  const { idb } = useStorage();
  const [version, setVersion] = useState<MappingVersion | null>(null);
  const [trigger, setTrigger] = useState<TriggerStand | null>(null);
  const [vorkommen, setVorkommen] = useState<VorkommenStand | null>(null);
  const [laden, setLaden] = useState(true);
  const laufend = useRef(false);

  const lade = useCallback(async (): Promise<void> => {
    if (laufend.current) return;
    laufend.current = true;
    setLaden(true);
    try {
      // Snapshot schlägt IDB — dasselbe Muster wie Vorgangs-Board und „Zu klären".
      const v = getAktiveVersion() ?? await ladeAktiveVersion(idb);
      setVersion(v);
      setTrigger(await ladeTrigger(idb));

      // NACH der Fassung, nicht davor: die Liste soll stehen, bevor der Zähl-Lauf
      // über 14 000 Anträge beginnt. Scheitert er, bleiben die Zahlen leer — ein
      // Nachschlagewerk funktioniert auch ohne sie.
      void ladeVorkommen(idb, v)
        .then(setVorkommen)
        .catch((err: unknown) => {
          console.warn('[glossar] Vorkommen nicht gezählt:', err);
        });
    } catch (err) {
      // Kein Fehlerzustand nach außen: ohne Fassung zeigt die Seite die
      // Abkürzungen und sagt, was fehlt. Ein roter Balken über einem
      // Nachschlagewerk wäre lauter als der Anlass.
      console.warn('[glossar] Katalog nicht geladen:', err);
    } finally {
      setLaden(false);
      laufend.current = false;
    }
  }, [idb]);

  useEffect(() => { void lade(); }, [lade]);

  return { version, trigger, vorkommen, laden };
}
