/**
 * Der **Stillstands-Wächter einer Tabellenzeile** — einmal gerechnet, von beiden
 * Reitern gelesen.
 *
 * Bis v3.37 rechnete ihn nur der Fristen-Reiter, mitten in
 * `useFristenBandModell`. Seit die Verlaufs-Bahn ihren aktuellen Abschnitt
 * markiert, brauchen ihn beide — und zweimal gerechnet liefen sie beim ersten
 * Sonderfall auseinander (dieselbe Regel, an der `fristAnzeige.ts` seit v3.6
 * hängt). Der Aufruf sitzt deshalb dort, wo beide Reiter hängen
 * ({@link ZeilenBereich}), und das Ergebnis wird durchgereicht.
 *
 * **Er urteilt über den VORGANG, nicht über eine Bahn.** Wer ihn in der Bahn
 * anzeigt, darf die Marke nur an die Spur hängen, die diese Zeile IST — bei
 * einer verdichteten Verbundzeile also an die Verbundbahn, sonst an die des
 * Teilvorhabens. An alle Bahnen geschrieben wäre er schlicht falsch.
 */
import { useMemo } from 'react';
import { findeStatusCode, type MappingVersion } from '@/core/status';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import { pruefeStillstand, type WaechterErgebnis } from '@/core/status/waechter';

export interface WaechterQuelle {
  version: MappingVersion | null;
  /** Status UND Vorkommen DIESER Zeile — nie die einer anderen. */
  vorkommen: readonly FeldVorkommen[];
  statusRoh: unknown;
  /** ISO-Tag. */
  stichtag: string;
  journalAenderung?: string | null;
}

/** `null`, solange kein Katalog geladen ist — dann gibt es nichts zu beurteilen. */
export function useZeilenWaechter(q: WaechterQuelle): WaechterErgebnis | null {
  return useMemo(() => {
    if (!q.version) return null;
    return pruefeStillstand({
      version: q.version,
      vorkommen: q.vorkommen,
      statusCode: findeStatusCode(q.statusRoh)?.eintrag.code ?? null,
      stichtag: q.stichtag,
      ...(q.journalAenderung !== undefined ? { journalAenderung: q.journalAenderung } : {}),
    });
  }, [q.version, q.vorkommen, q.statusRoh, q.stichtag, q.journalAenderung]);
}
