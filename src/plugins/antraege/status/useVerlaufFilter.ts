/**
 * Der geteilte Zustand der Verlaufs-Ansichten: **wer**, **wo**, **nur Lücken**
 * und der Fokus. Eine Auswahl, die beim Wechsel von der Chronik zum Zeitstrahl
 * verfiele, wäre zweimal dieselbe Frage.
 *
 * **Flüchtig, mit Absicht.** Anders als {@link useTimelinePrefs} landet hier
 * nichts in IndexedDB: „nur TV 3" ist eine Aussage über **diesen** Verbund, und
 * sie am nächsten mitzuschleppen hieße, dem Leser einen Filter unterzuschieben,
 * den er für einen anderen Vorgang gesetzt hat. Was bleibt, ist die Ansicht
 * selbst (Chronik/Zeitstrahl, nach Schritt/nach Datum) — die ist eine
 * Gewohnheit, keine Aussage.
 *
 * Die Regeln (erster Klick isoliert, weitere addieren, Abwahl des letzten fällt
 * auf „alle" zurück) stehen rein und node-getestet in `verlauf-filter.ts`; hier
 * hängt nur der React-Zustand daran.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROLLEN, schalteAuswahl, type Rolle } from '@/core/status';

export interface VerlaufFilter {
  /** Gewählte Rollen; leer **oder** vollständig = keine Einschränkung. */
  rollen: ReadonlySet<Rolle>;
  /** Gewählte Bereiche (`verbund` + Aktenzeichen); leer = alle. */
  bereiche: ReadonlySet<string>;
  /** Nur Schritte zeigen, bei denen irgendwo ein Kürzel fehlt. */
  nurLuecken: boolean;
  /** Fokussierte Feld-Id — bleibt über den Ansichtswechsel hinweg stehen. */
  fokus: string | null;
  /** Ist überhaupt etwas eingeschränkt oder fokussiert? */
  aktiv: boolean;
  schalteRolle: (r: Rolle) => void;
  schalteBereich: (b: string) => void;
  /** „Alle" in der Wo-Leiste: hebt die Bereichswahl auf. */
  alleBereiche: () => void;
  setzeNurLuecken: (v: boolean) => void;
  setzeFokus: (feldId: string | null) => void;
  zuruecksetzen: () => void;
}

export function useVerlaufFilter(bereichsIds: readonly string[]): VerlaufFilter {
  const [rollen, setRollen] = useState<ReadonlySet<Rolle>>(() => new Set());
  const [bereiche, setBereiche] = useState<ReadonlySet<string>>(() => new Set());
  const [nurLuecken, setNurLuecken] = useState(false);
  const [fokus, setFokus] = useState<string | null>(null);

  // Der Schlüssel der Bereichsachse — wechselt er, ist ein anderer Verbund
  // geöffnet und jede Auswahl darauf ist gegenstandslos.
  const achse = bereichsIds.join('|');
  useEffect(() => {
    setRollen(new Set());
    setBereiche(new Set());
    setNurLuecken(false);
    setFokus(null);
  }, [achse]);

  // `Esc` hebt den Fokus auf — dieselbe Taste, die auch Popover schließt.
  useEffect(() => {
    if (fokus === null) return;
    const auf = (ev: KeyboardEvent): void => { if (ev.key === 'Escape') setFokus(null); };
    window.addEventListener('keydown', auf);
    return () => window.removeEventListener('keydown', auf);
  }, [fokus]);

  const schalteRolle = useCallback((r: Rolle) => {
    setRollen(w => schalteAuswahl(w, r, ROLLEN));
  }, []);

  const schalteBereich = useCallback((b: string) => {
    setBereiche(w => schalteAuswahl(w, b, bereichsIds));
  }, [bereichsIds]);

  const alleBereiche = useCallback(() => setBereiche(new Set()), []);

  const zuruecksetzen = useCallback(() => {
    setRollen(new Set());
    setBereiche(new Set());
    setNurLuecken(false);
    setFokus(null);
  }, []);

  const aktiv = useMemo(() => {
    const rollenEng = rollen.size > 0 && rollen.size < ROLLEN.length;
    const bereichEng = bereiche.size > 0 && bereiche.size < bereichsIds.length;
    return rollenEng || bereichEng || nurLuecken || fokus !== null;
  }, [rollen, bereiche, bereichsIds.length, nurLuecken, fokus]);

  return {
    rollen, bereiche, nurLuecken, fokus, aktiv,
    schalteRolle, schalteBereich, alleBereiche,
    setzeNurLuecken: setNurLuecken, setzeFokus: setFokus, zuruecksetzen,
  };
}
