/**
 * Der **Einsatz-Bestandslauf**: welches Kürzel wird in den aktuellen Richtlinien
 * überhaupt noch gesetzt?
 *
 * Beantwortet genau eine Frage — „gesetzt in den jüngsten
 * {@link EINSATZ_GENERATIONEN} Generationen, ja oder nein?" — und beantwortet
 * sie **ohne Betrachtungsbereich** (Pitfall #46). Das ist Evidenz, kein
 * Arbeitsvorrat: zwei Personen mit verschiedenen Bereichs-Einstellungen sollen
 * dieselbe Ruhe-Liste sehen, sonst streitet der Termin über die Zahl statt über
 * das Kürzel.
 *
 * **Warum ein eigener Hook neben `useVerlaufErhebung`.** Der filtert auf den
 * persönlichen Bereich und rechnet die Verlaufsableitung mit; sein Ergebnis
 * ist damit eine andere Aussage über denselben Bestand. `vorgangs-quelle.ts`
 * legt die Vorarbeit einmal hin, geteilt wird der reine Teil
 * (`kuerzelEinesVorgangs`) — nicht das Ergebnisobjekt.
 *
 * Gerechnet wird auf Knopfdruck, nie beim Reiterwechsel: 14 000 Vorgänge
 * auszuzählen darf das Öffnen einer Tabelle nicht aufhalten. Das Ergebnis
 * veraltet mit jedem Nacht-Export und trägt deshalb seinen Bestandsstempel.
 */
import { useCallback, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import {
  aktuelleProgramme, einsatzJahre, jederVorgang, kuerzelEinesVorgangs, normKey,
  type EinsatzTreffer, type MappingVersion,
} from '@/core/status';

export interface EinsatzLauf {
  /** code (NFC) → Treffer, getrennt nach aktuellen und früheren Generationen. */
  treffer: ReadonlyMap<string, EinsatzTreffer> | null;
  /** Wie viele Vorgänge der Lauf gesehen hat — ohne ihn ist keine 0 einzuordnen. */
  vorgaenge: number;
  /** Davon in den aktuellen Generationen; 0 hieße: die Aussage trägt nicht. */
  vorgaengeAktuell: number;
  /** „2020 + 2025" — die Generationen, gegen die gemessen wurde. */
  jahre: readonly number[];
  dauerMs: number | null;
  aktion: UseAsyncActionResult<[]>;
}

export function useEinsatzErhebung(version: MappingVersion | null): EinsatzLauf {
  const idb = useStorage().idb;
  const [treffer, setTreffer] = useState<ReadonlyMap<string, EinsatzTreffer> | null>(null);
  const [vorgaenge, setVorgaenge] = useState(0);
  const [vorgaengeAktuell, setVorgaengeAktuell] = useState(0);
  const [dauerMs, setDauerMs] = useState<number | null>(null);

  const starte = useCallback(async (): Promise<void> => {
    if (!version) return;
    const begonnen = performance.now();
    const aktuell = aktuelleProgramme();
    const gezaehlt = new Map<string, EinsatzTreffer>();
    let alle = 0;
    let neu = 0;

    await jederVorgang(idb, version, satz => {
      alle++;
      // Ein Vorgang ohne lesbare Programm-Nummer zählt als „früher": geraten
      // wird nicht, und ihn als aktuell zu buchen hielte ein Kürzel wach, für
      // das es keinen Beleg gibt. Im Bestand kommt der Fall nicht vor.
      const istAktuell = typeof satz.unterprogrammId === 'string'
        && aktuell.has(normKey(satz.unterprogrammId));
      if (istAktuell) neu++;
      for (const code of kuerzelEinesVorgangs(satz)) {
        const t = gezaehlt.get(code) ?? { aktuell: 0, frueher: 0 };
        if (istAktuell) t.aktuell++; else t.frueher++;
        gezaehlt.set(code, t);
      }
    });

    setTreffer(gezaehlt);
    setVorgaenge(alle);
    setVorgaengeAktuell(neu);
    setDauerMs(Math.round(performance.now() - begonnen));
  }, [idb, version]);

  return {
    treffer, vorgaenge, vorgaengeAktuell, jahre: einsatzJahre(), dauerMs,
    aktion: useAsyncAction(starte),
  };
}
