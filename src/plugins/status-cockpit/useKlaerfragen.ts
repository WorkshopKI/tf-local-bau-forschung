/**
 * Der **Bestandslauf der Klärfragen** — auf Knopfdruck, ein Durchgang.
 *
 * Dieselbe Begründung wie bei `useVerlaufErhebung`: der Bestand liegt in der
 * Browser-IDB, `jederVorgang` ist aus einem Node-Vitest nicht erreichbar, und
 * eine Node-Fixture des Echtbestands gibt es nicht. Der Knopf ist nicht
 * bequemer, sondern der einzige Weg an die Zahlen.
 *
 * **Kein Betrachtungsbereich** (Pitfall #46), anders als dort: eine Klärfrage
 * ist Evidenz, kein Arbeitsvorrat. Zwei Personen mit verschiedenen
 * Bereichs-Einstellungen sollen dieselbe Datei erzeugen — sonst streitet der
 * Termin darüber, welche Liste gilt.
 */
import { useCallback, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { normalisiereWert, type MappingVersion } from '@/core/status';
import {
  baueKlaerfragen, ladeKlaerfragenBestand,
  type Klaerfrage, type KlaerfragenBestand,
} from '@/core/status/klaerfragen';

export interface KlaerfragenLauf {
  fragen: readonly Klaerfrage[] | null;
  bestand: KlaerfragenBestand | null;
  /** Laufzeit des Durchgangs in Millisekunden. */
  dauerMs: number | null;
  aktion: UseAsyncActionResult<[]>;
}

export function useKlaerfragen(version: MappingVersion | null): KlaerfragenLauf {
  const idb = useStorage().idb;
  const [fragen, setFragen] = useState<readonly Klaerfrage[] | null>(null);
  const [bestand, setBestand] = useState<KlaerfragenBestand | null>(null);
  const [dauerMs, setDauerMs] = useState<number | null>(null);

  const starte = useCallback(async (): Promise<void> => {
    if (!version) return;
    const begonnen = performance.now();
    const gemessen = await ladeKlaerfragenBestand(idb, version);
    // Die Fassung führt einen Wert, wenn sie ihn unter IRGENDEINEM Feld führt —
    // die Frage lautet „kennt sie den Wert", nicht „kennt sie ihn an dieser
    // Spalte". Feld-skopiert gefragt meldete derselbe Wert sich zweimal.
    const fassungsWerte = new Set(version.werte.map(w => normalisiereWert(w.wert)));
    setBestand(gemessen);
    setFragen(baueKlaerfragen({ bestand: gemessen, fassungsWerte }));
    setDauerMs(Math.round(performance.now() - begonnen));
  }, [idb, version]);

  return { fragen, bestand, dauerMs, aktion: useAsyncAction(starte) };
}
